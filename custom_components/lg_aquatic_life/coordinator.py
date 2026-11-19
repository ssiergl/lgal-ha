# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""Base coordinator shared by all LG Aquatic Life device types.

A device type (see ``models.py``) subclasses :class:`LgalCoordinator` and fills ``data`` from
its own endpoints. The base keeps the live WebSocket open (reconnecting with a back-off), turns
authentication failures into a re-authentication flow and offers ``async_command`` for writes.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import Awaitable, Callable
from datetime import timedelta
from typing import Any

import aiohttp

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.exceptions import ConfigEntryAuthFailed, HomeAssistantError, ServiceValidationError
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import DeviceIdentity, LgalApi, LgalApiError, LgalAuthError, LgalConnectionError, LgalSetupRequired
from .const import DOMAIN, SCAN_INTERVAL_NO_WS_S, SCAN_INTERVAL_S

_LOGGER = logging.getLogger(__name__)

WS_RECEIVE_TIMEOUT = 35  # the device pushes at least every 10 s
WS_PING_INTERVAL = 25  # keeps our connection "recent" so the device never closes it as idle
WS_BACKOFF_MAX = 60


class LgalCoordinator[DataT](DataUpdateCoordinator[DataT]):
    """Polls REST, takes pushes over the WebSocket."""

    MODEL_NAME = "LG Aquatic Life"

    def __init__(
        self,
        hass: HomeAssistant,
        entry: ConfigEntry,
        api: LgalApi,
        identity: DeviceIdentity,
    ) -> None:
        super().__init__(
            hass,
            _LOGGER,
            config_entry=entry,
            name=f"{DOMAIN} {identity.hostname or identity.mac}",
            update_interval=timedelta(seconds=SCAN_INTERVAL_NO_WS_S),
        )
        self.api = api
        self.identity = identity
        self.ws_connected = False
        self._ws: aiohttp.ClientWebSocketResponse | None = None
        self._ws_lock = asyncio.Lock()
        self._ws_id = 0
        self._ws_waiters: dict[int, asyncio.Future[dict[str, Any]]] = {}
        self._stopping = False
        self.controller_device_id: str | None = None  # set in async_setup_entry

    # -- errors -------------------------------------------------------------------------

    async def _guard(self, coro: Awaitable[Any]) -> Any:
        """Await a poll request, mapping errors for the update coordinator."""
        try:
            return await coro
        except LgalAuthError as err:
            raise ConfigEntryAuthFailed(
                translation_domain=DOMAIN, translation_key="auth_failed"
            ) from err
        except LgalSetupRequired as err:
            raise UpdateFailed(
                translation_domain=DOMAIN, translation_key="setup_required"
            ) from err
        except LgalConnectionError as err:
            raise UpdateFailed(
                translation_domain=DOMAIN,
                translation_key="cannot_connect",
                translation_placeholders={"host": self.api.host},
            ) from err
        except LgalApiError as err:
            raise UpdateFailed(f"{err.code}: {err.message}") from err

    async def async_command(self, coro: Awaitable[Any], *, refresh: bool = True) -> Any:
        """Run a write and refresh afterwards; errors become user-facing Home Assistant errors."""
        try:
            result = await coro
        except LgalAuthError as err:
            self.config_entry.async_start_reauth(self.hass)
            raise HomeAssistantError(
                translation_domain=DOMAIN, translation_key="auth_failed"
            ) from err
        except LgalConnectionError as err:
            raise HomeAssistantError(
                translation_domain=DOMAIN,
                translation_key="cannot_connect",
                translation_placeholders={"host": self.api.host},
            ) from err
        except LgalApiError as err:
            raise api_error_to_ha(err) from err
        if refresh:
            # at once (not debounced): the change should show right after the action
            await self.async_refresh()
        return result

    # -- WebSocket ------------------------------------------------------------------------

    @callback
    def async_start_live(self) -> CALLBACK_TYPE:
        """Start the live connection; returns a callback that stops it."""
        task = self.config_entry.async_create_background_task(
            self.hass, self._ws_loop(), f"{DOMAIN} live {self.api.host}"
        )

        @callback
        def _stop() -> None:
            self._stopping = True
            task.cancel()
            if self._ws is not None and not self._ws.closed:
                self.hass.async_create_task(self._ws.close())

        return _stop

    def _set_ws_connected(self, connected: bool) -> None:
        if connected == self.ws_connected:
            return
        self.ws_connected = connected
        self.update_interval = timedelta(seconds=SCAN_INTERVAL_S if connected else SCAN_INTERVAL_NO_WS_S)
        self.async_update_listeners()

    async def _ws_loop(self) -> None:
        backoff = 2
        while not self._stopping:
            try:
                ws = await self.api.ws_connect()
            except LgalAuthError:
                _LOGGER.debug("%s: live connection refused (key)", self.api.host)
                ws = None
                backoff = WS_BACKOFF_MAX
            except LgalConnectionError as err:
                _LOGGER.debug("%s: live connection failed: %s", self.api.host, err)
                ws = None
            if ws is not None:
                self._ws = ws
                backoff = 2
                self._set_ws_connected(True)
                try:
                    await self._ws_session(ws)
                except asyncio.CancelledError:
                    raise
                except Exception:  # noqa: BLE001 - never let the live loop die
                    _LOGGER.debug("%s: live connection error", self.api.host, exc_info=True)
                finally:
                    self._ws = None
                    for fut in self._ws_waiters.values():
                        if not fut.done():
                            fut.set_exception(LgalConnectionError("live connection closed"))
                    self._ws_waiters.clear()
                    if not ws.closed:
                        await ws.close()
                    self._set_ws_connected(False)
                    self._on_ws_closed()
            if self._stopping:
                return
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, WS_BACKOFF_MAX)

    async def _ws_session(self, ws: aiohttp.ClientWebSocketResponse) -> None:
        last_ping = time.monotonic()
        while True:
            try:
                msg = await ws.receive(timeout=WS_RECEIVE_TIMEOUT)
            except asyncio.TimeoutError:
                _LOGGER.debug("%s: no status frame for %s s, reconnecting", self.api.host, WS_RECEIVE_TIMEOUT)
                return
            if msg.type in (aiohttp.WSMsgType.CLOSE, aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.CLOSING, aiohttp.WSMsgType.ERROR):
                return
            if msg.type != aiohttp.WSMsgType.TEXT:
                continue
            try:
                frame = json.loads(msg.data)
            except ValueError:
                continue
            if not isinstance(frame, dict):
                continue
            kind = frame.get("type")
            if kind == "status":
                self._on_status_frame(frame)
            elif isinstance(frame.get("id"), int) and (fut := self._ws_waiters.pop(frame["id"], None)):
                if not fut.done():
                    fut.set_result(frame)
            if time.monotonic() - last_ping > WS_PING_INTERVAL:
                last_ping = time.monotonic()
                await self._ws_send({"type": "ping"})

    async def _ws_send(self, message: dict[str, Any]) -> None:
        ws = self._ws
        if ws is None or ws.closed:
            raise LgalConnectionError("live connection is down")
        async with self._ws_lock:
            await ws.send_str(json.dumps(message))

    async def ws_request(self, message: dict[str, Any], timeout: float = 3.0) -> dict[str, Any]:
        """Send a request over the live connection and wait for its answer."""
        self._ws_id += 1
        msg_id = self._ws_id
        fut: asyncio.Future[dict[str, Any]] = self.hass.loop.create_future()
        self._ws_waiters[msg_id] = fut
        try:
            await self._ws_send({**message, "id": msg_id})
            return await asyncio.wait_for(fut, timeout)
        except asyncio.TimeoutError as err:
            raise LgalConnectionError("no answer on the live connection") from err
        finally:
            self._ws_waiters.pop(msg_id, None)

    async def ws_fire(self, message: dict[str, Any]) -> None:
        """Send without waiting for the answer (priming heartbeats)."""
        await self._ws_send(message)

    # -- hooks of the device types ------------------------------------------------------

    def _on_status_frame(self, frame: dict[str, Any]) -> None:
        """A status push of the device."""

    def _on_ws_closed(self) -> None:
        """The live connection is gone (e.g. priming has to stop)."""


ERROR_KEYS = {
    # dosing
    "pump_busy", "pump_disabled", "pump_not_fitted", "pump_manual_only", "locked",
    "supply_missing", "supply_low", "daily_limit", "time_invalid", "driver_unavailable",
    "dose_too_small", "dose_too_large", "measured_out_of_range", "no_calibration_run",
    "not_priming", "collision_lock", "queue_full", "no_steps", "speed_out_of_range",
    # schedules
    "conflict", "exceeds_daily_limit", "off_grid", "duplicate_time", "invalid_count",
    "invalid_range", "slots_too_dense", "invalid_days", "no_slots", "invalid_lock",
    # firmware update
    "pump_running", "ota_in_progress", "no_source", "no_update",
    # general
    "invalid_param", "setup_required", "storage_error",
}


def api_error_to_ha(err: LgalApiError) -> HomeAssistantError:
    """A device error as a translated Home Assistant error."""
    detail = err.data or {}
    placeholders = {"code": err.code, "message": err.message}
    if err.code == "collision_lock":
        placeholders["retry"] = str(detail.get("retry_local") or "-")
    if err.code == "conflict":
        parts = []
        for c in detail.get("conflicts") or []:
            first, second = c.get("first") or {}, c.get("second") or {}
            parts.append(
                f"{c.get('code', '?')}: P{first.get('pump', '?')} {first.get('time', '')}"
                f" / P{second.get('pump', '?')} {second.get('time', '')}"
            )
        placeholders["conflicts"] = "; ".join(parts) or "-"
    if "field" in detail:
        placeholders["message"] = f"{err.message} ({detail['field']})"
    if "entry" in detail:
        placeholders["message"] = f"{placeholders['message']} [#{detail['entry']}]"
    key = err.code if err.code in ERROR_KEYS else "device_error"
    cls = ServiceValidationError if err.status == 400 else HomeAssistantError
    return cls(translation_domain=DOMAIN, translation_key=f"err_{key}", translation_placeholders=placeholders)


Listener = Callable[[], None]
