# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""LGAL Doser: dosing pump with one to five pumps (firmware project ``lgal_doser``).

Data sources (see docs/technical.md of the firmware):

* WebSocket ``/api/v1/ws``: live values (activity, progress, container, today's amount) at once.
* ``GET /api/v1/pumps`` and ``GET /api/v1/schedule/status`` every 30 s (10 s without WebSocket).
* ``GET /api/v1/history?from=...`` every 30 s: new events become Home Assistant events.
* Schedules, system info, update state, LED and lock rules every 5 minutes and after changes.

Pumps a board does not have, or that are not fitted, get no entities; the fitting can only
change with a restart of the device, after which the config entry is reloaded.
"""

from __future__ import annotations

import asyncio
import copy
import logging
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import device_registry as dr

from .api import DeviceIdentity, LgalApi, LgalApiError, LgalConnectionError
from .const import DOMAIN, EVENT_DEVICE, MAX_PUMPS, SLOW_INTERVAL_S
from .coordinator import LgalCoordinator, api_error_to_ha

_LOGGER = logging.getLogger(__name__)

PROJECT = "lgal_doser"

MODES = ("auto", "manual_only", "disabled")
TIERS = ("slow", "medium", "fast")  # speed tier 0..2
LIVE_KEYS = ("trigger", "target_ml", "done_ml", "rpm", "prime_s")

PRIME_KEEPALIVE_S = 1.5  # priming held from a card stops when no "beat" came for this long
PRIME_BEAT_S = 0.15  # heartbeat to the device (its dead-man is 500 ms by default)
PRIME_MAX_S = 600  # the device has its own limit (default 60 s)

HISTORY_PAGE = 200
PUMP_EVENT_KINDS = (
    "dose", "skip", "prime", "calib_run", "container", "calibration", "tube",
    "alarm", "alarm_end", "boost", "mode", "schedule", "settings",
)
DEVICE_EVENT_KINDS = ("system", "locks", "alarm", "alarm_end")


@dataclass
class DoserData:
    pumps: dict[int, dict[str, Any]] = field(default_factory=dict)  # GET /api/v1/pumps
    status: dict[int, dict[str, Any]] = field(default_factory=dict)  # GET /api/v1/schedule/status
    schedules: dict[int, dict[str, Any]] = field(default_factory=dict)  # GET /api/v1/pumps/schedule
    clock_valid: bool = False
    now: int | None = None  # device time (UTC seconds) of the last status
    now_local: str | None = None
    info: dict[str, Any] = field(default_factory=dict)  # GET /api/v1/system/info
    release: dict[str, Any] | None = None  # GET /api/v1/ota/release
    ota: dict[str, Any] | None = None  # GET /api/v1/ota/status
    led: dict[str, Any] | None = None  # GET /api/v1/system/led
    locks: dict[str, Any] | None = None  # GET /api/v1/schedule/locks
    live_seq: int | None = None


def utc_dt(value: Any) -> datetime | None:
    """UTC seconds of the device as an aware datetime, None for 0/null."""
    if not isinstance(value, (int, float)) or value <= 0:
        return None
    return datetime.fromtimestamp(value, tz=timezone.utc)


class DoserCoordinator(LgalCoordinator[DoserData]):
    """One LGAL Doser."""

    MODEL_NAME = "LGAL Doser"

    def __init__(self, hass: HomeAssistant, entry, api: LgalApi, identity: DeviceIdentity) -> None:
        super().__init__(hass, entry, api, identity)
        self.fitted: tuple[int, ...] = ()  # pumps with entities, fixed for the life of the entry
        self._slow_at = 0.0  # monotonic time of the last slow refresh
        self._slow_forced = True
        self._hist_cursor: int | None = None
        self._hist_seen: set[tuple] = set()
        self.event_listeners: list[Callable[[dict[str, Any]], None]] = []
        self.pump_device_ids: dict[int, str] = {}  # pump -> device registry id
        self._prime: dict[int, _Priming] = {}
        self._known_names: dict[int, str] = {}
        self.dose_amounts: dict[int, float] = {}  # pump -> amount of the "Dose" button (number entity)

    # -- polling --------------------------------------------------------------------------

    def schedule_slow_refresh(self) -> None:
        """Also read schedules, info and update state on the next refresh."""
        self._slow_forced = True

    async def _async_update_data(self) -> DoserData:
        old = self.data
        data = DoserData() if old is None else copy.copy(old)
        pumps = await self._guard(self.api.get("/api/v1/pumps"))
        data.pumps = {int(p["pump"]): p for p in (pumps or {}).get("pumps", []) if isinstance(p, dict)}
        status = await self._guard(self.api.get("/api/v1/schedule/status"))
        data.status = {int(p["pump"]): p for p in (status or {}).get("pumps", []) if isinstance(p, dict)}
        data.clock_valid = bool((status or {}).get("clock_valid"))
        data.now = (status or {}).get("now")
        data.now_local = (status or {}).get("now_local")
        if not self.fitted:
            self.fitted = tuple(n for n, p in sorted(data.pumps.items()) if p.get("fitted") and 1 <= n <= MAX_PUMPS)

        slow = self._slow_forced or time.monotonic() - self._slow_at >= SLOW_INTERVAL_S
        if slow:
            self._slow_forced = False
            self._slow_at = time.monotonic()
            data.info = await self._guard(self.api.system_info()) or {}
            data.schedules = dict(data.schedules)
            for n in self.fitted:
                try:
                    data.schedules[n] = await self._guard(self.api.get("/api/v1/pumps/schedule", pump=n))
                except Exception:  # noqa: BLE001 - one broken schedule must not hide the rest
                    _LOGGER.debug("Schedule of pump %s not readable", n, exc_info=True)
            data.release = await self._optional("/api/v1/ota/release")
            data.led = await self._optional("/api/v1/system/led")
            data.locks = await self._optional("/api/v1/schedule/locks")
            data.ota = await self._optional("/api/v1/ota/status")
        elif data.ota and data.ota.get("state") in ("running", "rebooting"):
            data.ota = await self._optional("/api/v1/ota/status")
        if data.schedules and data.now_local and old and old.now_local and data.now_local[:10] != old.now_local[:10]:
            self._slow_forced = True  # a new day: today's slots change

        await self._read_history(data)
        self._sync_pump_names(data)
        return data

    async def _optional(self, path: str) -> dict[str, Any] | None:
        """A read that may fail without failing the whole update (e.g. no update source)."""
        try:
            result = await self.api.get(path)
        except LgalApiError as err:
            _LOGGER.debug("%s: %s", path, err)
            return None
        return result if isinstance(result, dict) else None

    # -- history -> events ---------------------------------------------------------------

    async def _read_history(self, data: DoserData) -> None:
        if not data.clock_valid or not data.now:
            return
        if self._hist_cursor is None:
            # start at the current time: the device keeps up to 60 days, which are no news
            self._hist_cursor = int(data.now)
            return
        new: list[dict[str, Any]] = []
        offset = 0
        for _ in range(5):
            try:
                page = await self.api.get("/api/v1/history", **{"from": self._hist_cursor, "limit": HISTORY_PAGE, "offset": offset})
            except (LgalApiError, LgalConnectionError) as err:
                _LOGGER.debug("History not readable: %s", err)
                return
            events = (page or {}).get("events") or []
            new.extend(e for e in events if isinstance(e, dict))
            if not (page or {}).get("more"):
                break
            offset += len(events)
        fresh = []
        for event in reversed(new):  # oldest first
            key = _event_key(event)
            if key in self._hist_seen:
                continue
            self._hist_seen.add(key)
            fresh.append(event)
        if new:
            cursor = max(int(e.get("utc") or 0) for e in new)
            if cursor > self._hist_cursor:
                self._hist_cursor = cursor
            self._hist_seen = {k for k in self._hist_seen if k[0] >= self._hist_cursor}
        for event in fresh:
            self._dispatch_event(event)

    def _dispatch_event(self, event: dict[str, Any]) -> None:
        pump = int(event.get("pump") or 0)
        data = {
            "device_id": self.controller_device_id,
            "pump_device_id": self.pump_device_ids.get(pump),
            "host": self.api.host,
            **event,
        }
        self.hass.bus.async_fire(EVENT_DEVICE, data)
        for listener in list(self.event_listeners):
            try:
                listener(event)
            except Exception:  # noqa: BLE001
                _LOGGER.exception("Event listener failed")

    # -- live push -----------------------------------------------------------------------

    def _on_status_frame(self, frame: dict[str, Any]) -> None:
        if self.data is None:
            return
        data = self.data
        data.live_seq = frame.get("seq")
        if "time_valid" in frame:
            data.clock_valid = bool(frame["time_valid"])
        refresh = False
        for live in frame.get("pumps") or []:
            if not isinstance(live, dict) or not isinstance(live.get("pump"), int):
                continue
            pump = data.pumps.get(live["pump"])
            if pump is None:
                continue
            before = pump.get("activity")
            pump["activity"] = live.get("activity", before)
            pump["phase"] = live.get("phase", pump.get("phase"))
            for key in LIVE_KEYS:
                if key in live:
                    pump[key] = live[key]
                else:
                    pump.pop(key, None)
            container = pump.setdefault("container", {})
            if "remaining_ml" in live:
                container["remaining_ml"] = live["remaining_ml"]
            if "percent" in live:
                container["percent"] = live["percent"]
            if "used_today_ml" in live:
                pump.setdefault("daily", {})["used_ml"] = live["used_today_ml"]
            if isinstance(live.get("last"), dict):
                last = pump.setdefault("last", {})
                if live["last"].get("at") != last.get("at"):
                    last.pop("target_ml", None)  # not part of the push, comes with the next poll
                last.update(live["last"])
            if before != pump["activity"]:
                refresh = True
        self.async_update_listeners()
        if refresh:
            self.hass.async_create_task(self.async_request_refresh())

    def _on_ws_closed(self) -> None:
        # The device stops priming that a closed connection started; the REST fallback takes over
        # for priming that is still held.
        return

    # -- names in the device registry ----------------------------------------------------

    def pump_label(self, n: int, data: DoserData | None = None) -> str | None:
        """The pump's own name, None without one."""
        pump = (data or self.data).pumps.get(n) if (data or self.data) else None
        name = str((pump or {}).get("name") or "").strip()
        return name or None

    def default_pump_name(self, n: int) -> str:
        word = "Pumpe" if (self.hass.config.language or "en").startswith("de") else "Pump"
        return f"{word} {n}"

    def _sync_pump_names(self, data: DoserData) -> None:
        """A pump renamed on the device renames its device here (a name set in HA stays)."""
        registry = dr.async_get(self.hass)
        for n, device_id in self.pump_device_ids.items():
            name = self.pump_label(n, data) or self.default_pump_name(n)
            if self._known_names.get(n) == name:
                continue
            self._known_names[n] = name
            device = registry.async_get(device_id)
            if device is not None and device.name != name:
                registry.async_update_child_device(device_id, name=name)

    # -- views used by the entities ------------------------------------------------------

    def pump(self, n: int) -> dict[str, Any]:
        return (self.data.pumps.get(n) if self.data else None) or {}

    def status(self, n: int) -> dict[str, Any]:
        return (self.data.status.get(n) if self.data else None) or {}

    def schedule(self, n: int) -> dict[str, Any]:
        return (self.data.schedules.get(n) if self.data else None) or {}

    def info(self) -> dict[str, Any]:
        return (self.data.info if self.data else None) or {}

    def pump_alarms(self, n: int) -> dict[str, bool]:
        """The pump's alarm conditions, as doser/alarms.cpp evaluates them for the LED."""
        p, s = self.pump(n), self.status(n)
        active = p.get("mode") != "disabled" and bool(p.get("fitted", True))
        container = p.get("container") or {}
        days = s.get("remaining_days")
        low_days = container.get("low_days") or 0
        warn_days = container.get("warn_days") or 0
        tracked = bool(container.get("tracked"))
        last_skip = s.get("last_skip") or {}
        today = (self.data.now_local or "")[:10] if self.data else ""
        limit_hit = (
            last_skip.get("reason") == "daily_limit"
            and bool(today)
            and str(last_skip.get("local") or "")[:10] == today
            and (s.get("skipped") or 0) > 0
        )
        return {
            "driver_fault": active and (p.get("last") or {}).get("result") == "fault",
            "daily_limit": active and limit_hit,
            "container_low": active and tracked and days is not None and days < low_days,
            "container_warning": active and tracked and days is not None and days < warn_days,
            "tube_worn": active and ((p.get("tube") or {}).get("percent") or 0) >= 100,
            "calibration_due": active
            and bool((p.get("calibration") or {}).get("due") or (p.get("calibration") or {}).get("tube_changed")),
        }

    def device_alarms(self) -> dict[str, Any]:
        """critical / warning of the device plus the condition codes (like the MQTT state)."""
        info = self.info()
        time_info = info.get("time") or {}
        supply = (info.get("supply") or {}).get("state")
        conditions: list[str] = []
        critical = warning = False
        if time_info and time_info.get("rtc_ok") is False:
            critical = True
            conditions.append("rtc_fault")
        if supply == "missing":
            critical = True
            conditions.append("supply_missing")
        if supply == "low":
            warning = True
            conditions.append("supply_low")
        if self.data and not self.data.clock_valid:
            warning = True
            conditions.append("time_invalid")
        for n in self.fitted:
            a = self.pump_alarms(n)
            if a["driver_fault"]:
                critical = True
                conditions.append(f"pump{n}_driver_fault")
            if a["daily_limit"]:
                critical = True
                conditions.append(f"pump{n}_daily_limit")
            if a["container_low"]:
                warning = True
                conditions.append(f"pump{n}_container_low")
            if a["tube_worn"]:
                warning = True
                conditions.append(f"pump{n}_tube_worn")
        return {"critical": critical, "warning": warning, "conditions": conditions}

    # -- commands ------------------------------------------------------------------------

    async def async_dose(self, n: int, ml: float, tier: int | None = None) -> dict[str, Any]:
        return await self.async_command(self.api.post("/api/v1/pumps/dose", pump=n, ml=float(ml), tier=tier))

    async def async_stop(self, n: int = 0) -> None:
        if n:
            await self._prime_cancel(n)
        else:
            for p in list(self._prime):
                await self._prime_cancel(p)
        await self.async_command(self.api.post("/api/v1/pumps/stop", pump=n))

    async def async_settings(self, n: int, **values: Any) -> None:
        await self.async_command(self.api.post("/api/v1/pumps/settings", pump=n, **values))

    async def async_container(self, n: int, capacity_ml: float | None = None, remaining_ml: float | None = None) -> None:
        await self.async_command(
            self.api.post(
                "/api/v1/pumps/container",
                pump=n,
                capacity_ml=None if capacity_ml is None else float(capacity_ml),
                remaining_ml=None if remaining_ml is None else float(remaining_ml),
            )
        )

    async def async_refill(self, n: int) -> None:
        cap = (self.pump(n).get("container") or {}).get("capacity_ml") or 0
        if not cap:
            raise ServiceValidationError(translation_domain=DOMAIN, translation_key="no_container")
        await self.async_container(n, capacity_ml=cap, remaining_ml=cap)

    async def async_tube(self, n: int, hours: int = 0) -> None:
        await self.async_command(self.api.post("/api/v1/pumps/tube", pump=n, hours=int(hours)))

    async def async_calibrate(self, n: int, action: str, ml: float | None = None, tier: int | None = None) -> None:
        params: dict[str, Any] = {"pump": n, "action": action}
        if action == "start":
            params["ml"] = None if ml is None else float(ml)
            params["tier"] = tier
        elif action == "apply":
            params["measured_ml"] = float(ml or 0)
        await self.async_command(self.api.post("/api/v1/pumps/calibrate", **params))

    async def async_set_schedule(self, n: int, schedule: dict[str, Any]) -> dict[str, Any]:
        result = await self.async_command(self.api.put(f"/api/v1/pumps/schedule?pump={n}", schedule), refresh=False)
        if self.data is not None and isinstance(result, dict):
            self.data.schedules[n] = result
        self.schedule_slow_refresh()
        await self.async_refresh()
        return result

    async def async_boost(self, n: int, ml: float | None = None, days: int | None = None, doses: int | None = None) -> None:
        if ml is None:
            await self.async_command(self.api.post("/api/v1/pumps/boost", pump=n, action="stop"))
        else:
            await self.async_command(self.api.post("/api/v1/pumps/boost", pump=n, ml=float(ml), days=days, doses=doses))

    async def async_locks(self, **changes: Any) -> None:
        locks = dict(self.data.locks or {"manual": "reject", "rules": []}) if self.data else {}
        locks.update(changes)
        result = await self.async_command(self.api.put("/api/v1/schedule/locks", locks), refresh=False)
        if self.data is not None and isinstance(result, dict):
            self.data.locks = result
        self.async_update_listeners()

    async def async_led(self, night: dict[str, Any]) -> None:
        result = await self.async_command(self.api.put("/api/v1/system/led", {"night": night}), refresh=False)
        if self.data is not None and isinstance(result, dict):
            self.data.led = result
        else:
            self.schedule_slow_refresh()
            await self.async_refresh()
        self.async_update_listeners()

    async def async_install_update(self) -> None:
        await self.async_command(self.api.post("/api/v1/ota/release/install"), refresh=False)
        self.schedule_slow_refresh()
        await self.async_refresh()

    async def async_check_update(self) -> None:
        await self.async_command(self.api.post("/api/v1/ota/release/check"), refresh=False)
        await asyncio.sleep(3)
        self.schedule_slow_refresh()
        await self.async_refresh()

    async def async_reboot(self) -> None:
        await self.async_command(self.api.post("/api/v1/system/reboot"), refresh=False)

    async def async_history(self, **params: Any) -> dict[str, Any]:
        return await self.async_command(self.api.get("/api/v1/history", **params), refresh=False)

    async def async_daily(self, days: int) -> dict[str, Any]:
        return await self.async_command(self.api.get("/api/v1/history/daily", days=days), refresh=False)

    # -- priming -------------------------------------------------------------------------

    async def async_prime(self, n: int, action: str, duration: float | None = None, tier: int | None = None) -> None:
        """Hold-to-run priming.

        ``start`` with a ``duration`` primes for that long. ``start`` without one primes while
        ``beat`` keeps coming (a card sends it while the button is held) and stops
        ``PRIME_KEEPALIVE_S`` after the last one. ``stop`` ends it at once. The heartbeat to the
        device runs here, every 150 ms, over the WebSocket or else over REST.
        """
        now = time.monotonic()
        current = self._prime.get(n)
        if action == "beat":
            if current is not None and not current.task.done():
                current.deadline = max(current.deadline, now + PRIME_KEEPALIVE_S)
            return
        if action == "stop":
            await self._prime_cancel(n)
            await self.async_command(self.api.post("/api/v1/pumps/prime", pump=n, action="stop"))
            return
        if current is not None and not current.task.done():
            current.deadline = now + (duration if duration else PRIME_KEEPALIVE_S)
            return
        await self._prime_send(n, "start", tier)  # errors (busy, disabled, ...) go to the caller
        priming = _Priming(deadline=now + (min(duration, PRIME_MAX_S) if duration else PRIME_KEEPALIVE_S))
        priming.task = self.config_entry.async_create_background_task(
            self.hass, self._prime_loop(n, priming), f"{DOMAIN} prime {n}"
        )
        self._prime[n] = priming
        self.hass.async_create_task(self.async_request_refresh())

    async def _prime_send(self, n: int, action: str, tier: int | None = None) -> None:
        if self.ws_connected:
            msg: dict[str, Any] = {"type": "prime", "pump": n, "action": action}
            if tier is not None:
                msg["tier"] = tier
            if action == "beat":
                await self.ws_fire(msg)
                return
            try:
                reply = await self.ws_request(msg)
            except LgalConnectionError:
                pass  # fall back to REST below
            else:
                if not reply.get("ok") and action != "stop":
                    raise_device_error(str(reply.get("error") or "internal_error"))
                return
        if action == "start":
            await self.async_command(self.api.post("/api/v1/pumps/prime", pump=n, action="start", tier=tier), refresh=False)
        else:
            await self.api.post("/api/v1/pumps/prime", pump=n, action=action)

    async def _prime_loop(self, n: int, priming: _Priming) -> None:
        try:
            while time.monotonic() < priming.deadline:
                await asyncio.sleep(PRIME_BEAT_S)
                try:
                    await self._prime_send(n, "beat")
                except (LgalApiError, LgalConnectionError):
                    _LOGGER.debug("Priming pump %s: heartbeat failed, stopping", n)
                    break
        finally:
            if self._prime.get(n) is priming:
                self._prime.pop(n, None)
            try:
                await self._prime_send(n, "stop")
            except Exception:  # noqa: BLE001 - the device stops by itself without heartbeat
                _LOGGER.debug("Priming pump %s: stop not delivered", n, exc_info=True)
            self.hass.async_create_task(self.async_request_refresh())

    async def _prime_cancel(self, n: int) -> None:
        priming = self._prime.pop(n, None)
        if priming is not None and priming.task is not None and not priming.task.done():
            priming.deadline = 0
            try:
                await asyncio.wait_for(asyncio.shield(priming.task), 2)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                priming.task.cancel()

    @callback
    def async_shutdown_priming(self) -> None:
        for priming in self._prime.values():
            priming.deadline = 0


@dataclass
class _Priming:
    deadline: float
    task: asyncio.Task | None = None


def _event_key(event: dict[str, Any]) -> tuple:
    return (
        int(event.get("utc") or 0),
        event.get("kind"),
        event.get("pump"),
        event.get("code"),
        event.get("source"),
        event.get("target_ml"),
        event.get("done_ml"),
        event.get("value"),
    )


def raise_device_error(code: str) -> None:
    raise api_error_to_ha(LgalApiError(409, code, code))
