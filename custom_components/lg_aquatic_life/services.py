# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""Actions of the integration (dose, prime, calibrate, schedules, boost, history, ...).

Every action takes ``device_id``: a pump device (``LGAL Doser … › Pump 1``) or the doser itself
plus ``pump`` (1–5). ``stop`` on the doser itself stops all pumps.
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse, callback
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN, MAX_PUMPS
from .doser import TIERS, DoserCoordinator

ATTR_DEVICE = "device_id"
ATTR_PUMP = "pump"

_TIME = vol.Match(r"^([01]\d|2[0-3]):[0-5]\d$")
_WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

BASE = {
    vol.Required(ATTR_DEVICE): cv.string,
    vol.Optional(ATTR_PUMP): vol.All(vol.Coerce(int), vol.Range(min=1, max=MAX_PUMPS)),
}
SPEED = vol.In(TIERS)

SCHEMAS: dict[str, vol.Schema] = {
    "dose": vol.Schema({**BASE, vol.Required("amount"): vol.All(vol.Coerce(float), vol.Range(min=0.001, max=10000)), vol.Optional("speed"): SPEED}),
    "stop": vol.Schema(BASE),
    "prime": vol.Schema(
        {
            **BASE,
            vol.Optional("action", default="start"): vol.In(["start", "beat", "stop"]),
            vol.Optional("duration"): vol.All(vol.Coerce(float), vol.Range(min=0.5, max=600)),
            vol.Optional("speed"): SPEED,
        }
    ),
    "calibrate": vol.Schema(
        {
            **BASE,
            vol.Required("action"): vol.In(["start", "apply", "cancel"]),
            vol.Optional("amount"): vol.All(vol.Coerce(float), vol.Range(min=0.001, max=1000)),
            vol.Optional("speed"): SPEED,
        }
    ),
    "set_container": vol.Schema(
        {
            **BASE,
            vol.Optional("capacity"): vol.All(vol.Coerce(float), vol.Range(min=0, max=100000)),
            vol.Optional("remaining"): vol.All(vol.Coerce(float), vol.Range(min=0, max=100000)),
        }
    ),
    "refill": vol.Schema(BASE),
    "set_tube_hours": vol.Schema({**BASE, vol.Optional("hours", default=0): vol.All(vol.Coerce(int), vol.Range(min=0, max=100000))}),
    "set_schedule": vol.Schema(
        {
            **BASE,
            vol.Optional("schedule"): dict,  # the firmware's JSON as is (the cards send this)
            vol.Optional("kind"): vol.In(["none", "spread", "times"]),
            vol.Optional("amount"): vol.All(vol.Coerce(float), vol.Range(min=0, max=10000)),
            vol.Optional("doses"): vol.All(vol.Coerce(int), vol.Range(min=1, max=96)),
            vol.Optional("start"): _TIME,
            vol.Optional("end"): _TIME,
            vol.Optional("times"): [vol.Schema({vol.Required("time"): _TIME, vol.Required("ml"): vol.Coerce(float)})],
            vol.Optional("days"): vol.In(["daily", "weekdays", "interval"]),
            vol.Optional("weekdays"): [vol.In(_WEEKDAYS)],
            vol.Optional("every"): vol.All(vol.Coerce(int), vol.Range(min=1, max=30)),
            vol.Optional("anchor"): cv.date,
            vol.Optional("power_loss"): vol.In(["skip_missed", "catch_up_window"]),
            vol.Optional("catch_up_min"): vol.All(vol.Coerce(int), vol.Range(min=0, max=1440)),
        }
    ),
    "start_boost": vol.Schema(
        {
            **BASE,
            vol.Required("amount"): vol.All(vol.Coerce(float), vol.Range(min=0.02, max=10000)),
            vol.Exclusive("days", "period"): vol.All(vol.Coerce(int), vol.Range(min=1, max=30)),
            vol.Exclusive("doses", "period"): vol.All(vol.Coerce(int), vol.Range(min=1, max=100)),
        }
    ),
    "stop_boost": vol.Schema(BASE),
    "set_lock_rules": vol.Schema(
        {
            **BASE,
            vol.Optional("manual"): vol.In(["reject", "queue"]),
            vol.Optional("rules"): [
                vol.Schema(
                    {
                        vol.Required("pumps"): vol.All([vol.All(vol.Coerce(int), vol.Range(min=1, max=MAX_PUMPS))], vol.Length(2, 2)),
                        vol.Required("gap_min"): vol.All(vol.Coerce(int), vol.Range(min=1, max=1440)),
                    }
                )
            ],
        }
    ),
    "get_history": vol.Schema(
        {
            **BASE,
            vol.Optional("days", default=1): vol.All(vol.Coerce(int), vol.Range(min=1, max=60)),
            vol.Optional("kinds"): [cv.string],
            vol.Optional("limit", default=100): vol.All(vol.Coerce(int), vol.Range(min=1, max=500)),
            vol.Optional("offset", default=0): vol.All(vol.Coerce(int), vol.Range(min=0)),
        }
    ),
    "get_daily_history": vol.Schema(
        {**BASE, vol.Optional("days", default=14): vol.All(vol.Coerce(int), vol.Range(min=1, max=60))}
    ),
}

NEEDS_PUMP = {"dose", "prime", "calibrate", "set_container", "refill", "set_tube_hours", "set_schedule", "start_boost", "stop_boost"}
RESPONSE_ONLY = {"get_history", "get_daily_history"}


def _resolve(hass: HomeAssistant, call: ServiceCall, need_pump: bool) -> tuple[DoserCoordinator, int]:
    """The coordinator and pump number (0 = the device itself) of the call."""
    device_id = call.data[ATTR_DEVICE]
    for entry in hass.config_entries.async_entries(DOMAIN):
        if entry.state is not ConfigEntryState.LOADED:
            continue
        coordinator = entry.runtime_data.coordinator
        pump = 0
        if device_id == coordinator.controller_device_id:
            pump = call.data.get(ATTR_PUMP, 0)
        else:
            pump = next((n for n, d in coordinator.pump_device_ids.items() if d == device_id), -1)
            if pump < 0:
                continue
        if pump and pump not in coordinator.fitted:
            raise ServiceValidationError(
                translation_domain=DOMAIN, translation_key="pump_not_fitted", translation_placeholders={"pump": str(pump)}
            )
        if need_pump and not pump:
            raise ServiceValidationError(translation_domain=DOMAIN, translation_key="pump_required")
        return coordinator, pump
    raise ServiceValidationError(translation_domain=DOMAIN, translation_key="unknown_device")


def _tier(call: ServiceCall) -> int | None:
    speed = call.data.get("speed")
    return TIERS.index(speed) if speed else None


def build_schedule(data: dict[str, Any], current: dict[str, Any]) -> dict[str, Any]:
    """The schedule document from the action's fields (missing fields keep the current plan)."""
    if "schedule" in data:
        return dict(data["schedule"])
    sched = {k: v for k, v in current.items() if k not in ("pump", "grid_min", "today")}
    kind = data.get("kind", sched.get("kind", "none"))
    sched["kind"] = kind
    if kind == "none":
        return {"kind": "none"}
    if kind == "spread":
        for src, dst in (("amount", "ml"), ("doses", "count"), ("start", "start"), ("end", "end")):
            if src in data:
                sched[dst] = data[src]
        sched.pop("times", None)
        missing = [f for f in ("ml", "count", "start") if f not in sched]
        if missing:
            raise ServiceValidationError(
                translation_domain=DOMAIN, translation_key="schedule_incomplete", translation_placeholders={"fields": ", ".join(missing)}
            )
    if kind == "times":
        if "times" in data:
            sched["times"] = data["times"]
        if not sched.get("times"):
            raise ServiceValidationError(
                translation_domain=DOMAIN, translation_key="schedule_incomplete", translation_placeholders={"fields": "times"}
            )
        for key in ("ml", "count", "start", "end"):
            sched.pop(key, None)
    days = dict(sched.get("days") or {"mode": "daily"})
    if "days" in data:
        days = {"mode": data["days"]}
    if "weekdays" in data:
        days["weekdays"] = data["weekdays"]
    if "every" in data:
        days["every"] = data["every"]
    if "anchor" in data:
        days["anchor"] = data["anchor"].isoformat()
    if days.get("mode") == "weekdays":
        days.pop("every", None)
        days.pop("anchor", None)
    elif days.get("mode") == "interval":
        days.pop("weekdays", None)
    else:
        days = {"mode": "daily"}
    sched["days"] = days
    for key in ("power_loss", "catch_up_min"):
        if key in data:
            sched[key] = data[key]
    return sched


async def _handle(hass: HomeAssistant, call: ServiceCall) -> ServiceResponse:
    name = call.service
    coordinator, pump = _resolve(hass, call, name in NEEDS_PUMP)
    data = call.data
    if name == "dose":
        await coordinator.async_dose(pump, data["amount"], _tier(call))
    elif name == "stop":
        await coordinator.async_stop(pump)
    elif name == "prime":
        await coordinator.async_prime(pump, data["action"], data.get("duration"), _tier(call))
    elif name == "calibrate":
        action = data["action"]
        if action == "apply" and "amount" not in data:
            raise ServiceValidationError(translation_domain=DOMAIN, translation_key="measured_required")
        await coordinator.async_calibrate(pump, action, data.get("amount"), _tier(call))
    elif name == "set_container":
        if "capacity" not in data and "remaining" not in data:
            raise ServiceValidationError(translation_domain=DOMAIN, translation_key="container_required")
        await coordinator.async_container(pump, data.get("capacity"), data.get("remaining"))
    elif name == "refill":
        await coordinator.async_refill(pump)
    elif name == "set_tube_hours":
        await coordinator.async_tube(pump, data["hours"])
    elif name == "set_schedule":
        await coordinator.async_set_schedule(pump, build_schedule(dict(data), coordinator.schedule(pump)))
    elif name == "start_boost":
        if "days" not in data and "doses" not in data:
            raise ServiceValidationError(translation_domain=DOMAIN, translation_key="boost_period_required")
        await coordinator.async_boost(pump, data["amount"], data.get("days"), data.get("doses"))
    elif name == "stop_boost":
        await coordinator.async_boost(pump)
    elif name == "set_lock_rules":
        changes = {k: data[k] for k in ("manual", "rules") if k in data}
        await coordinator.async_locks(**changes)
    elif name == "get_history":
        params: dict[str, Any] = {"days": data["days"], "limit": data["limit"], "offset": data["offset"]}
        if pump:
            params["pump"] = pump
        if data.get("kinds"):
            params["kind"] = ",".join(data["kinds"])
        return await coordinator.async_history(**params)
    elif name == "get_daily_history":
        result = await coordinator.async_daily(data["days"])
        result = dict(result or {})
        result["pumps"] = list(coordinator.fitted)
        result["names"] = {str(n): coordinator.pump_label(n) or coordinator.default_pump_name(n) for n in coordinator.fitted}
        return result
    return None


@callback
def async_setup_services(hass: HomeAssistant) -> None:
    async def handler(call: ServiceCall) -> ServiceResponse:
        return await _handle(hass, call)

    for name, schema in SCHEMAS.items():
        hass.services.async_register(
            DOMAIN,
            name,
            handler,
            schema=schema,
            supports_response=SupportsResponse.ONLY if name in RESPONSE_ONLY else SupportsResponse.NONE,
        )
