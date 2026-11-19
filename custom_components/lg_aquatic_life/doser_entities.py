# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""Entities of the LGAL Doser (device and one set per fitted pump)."""

from __future__ import annotations

from datetime import datetime, time, timezone
from typing import Any

from homeassistant.components.binary_sensor import BinarySensorDeviceClass
from homeassistant.components.button import ButtonDeviceClass
from homeassistant.components.number import NumberMode
from homeassistant.components.sensor import SensorDeviceClass, SensorStateClass
from homeassistant.components.text import TextMode
from homeassistant.const import PERCENTAGE, EntityCategory, UnitOfElectricPotential, UnitOfTime, UnitOfVolume

from .descriptions import (
    LgalBinarySensorDescription,
    LgalButtonDescription,
    LgalEventDescription,
    LgalLocalNumberDescription,
    LgalNumberDescription,
    LgalSelectDescription,
    LgalSensorDescription,
    LgalSwitchDescription,
    LgalTextDescription,
    LgalTimeDescription,
    LgalUpdateDescription,
    ModelEntities,
)
from .doser import DEVICE_EVENT_KINDS, MODES, PUMP_EVENT_KINDS, TIERS, utc_dt

ML = UnitOfVolume.MILLILITERS
RESULTS = ["success", "aborted", "fault", "locked", "supply_missing", "supply_low", "heartbeat_lost", "max_duration"]
ACTIVITIES = ["idle", "dosing", "priming", "calibrating"]


# -- small accessors ---------------------------------------------------------------------


def _p(c, n: int, *path: str, default: Any = None) -> Any:
    value: Any = c.pump(n)
    for key in path:
        if not isinstance(value, dict):
            return default
        value = value.get(key)
    return default if value is None else value


def _s(c, n: int, *path: str, default: Any = None) -> Any:
    value: Any = c.status(n)
    for key in path:
        if not isinstance(value, dict):
            return default
        value = value.get(key)
    return default if value is None else value


def _tracked(c, n: int) -> bool:
    return bool(_p(c, n, "container", "tracked"))


def _container_ml(c, n: int) -> float | None:
    return _p(c, n, "container", "remaining_ml") if _tracked(c, n) else None


def _container_pct(c, n: int) -> float | None:
    return _p(c, n, "container", "percent") if _tracked(c, n) else None


def _progress(c, n: int) -> float | None:
    target, done = _p(c, n, "target_ml"), _p(c, n, "done_ml")
    if not target:
        return None
    return round(min(100.0, 100.0 * (done or 0) / target), 1)


def _activity_attrs(c, n: int) -> dict[str, Any]:
    p = c.pump(n)
    # "doser" and "pump" let the dashboard cards find the pumps of a doser
    attrs: dict[str, Any] = {"doser": c.identity.mac, "pump": n}
    attrs |= {k: p.get(k) for k in ("phase", "trigger", "target_ml", "done_ml", "rpm", "prime_s") if k in p}
    if (progress := _progress(c, n)) is not None:
        attrs["progress"] = progress
    return attrs


def _last_attrs(c, n: int) -> dict[str, Any]:
    last = c.pump(n).get("last") or {}
    return {
        "activity": last.get("activity"),
        "target_ml": last.get("target_ml"),
        "done_ml": last.get("done_ml"),
        "at": utc_dt(last.get("at")),
    }


def _next_attrs(c, n: int) -> dict[str, Any]:
    nxt = _s(c, n, "next") or {}
    return {
        "ml": nxt.get("ml"),
        "boost_ml": nxt.get("boost_ml", 0),
        "local": nxt.get("local"),
        "delayed": _s(c, n, "delayed"),
        "queued": _s(c, n, "queued"),
    }


def _calibration_attrs(c, n: int) -> dict[str, Any]:
    cal = dict(_p(c, n, "calibration", default={}))
    cal["calibrated_at"] = utc_dt(cal.get("calibrated_at"))
    cal["speed"] = _p(c, n, "speed")
    return cal


def _container_attrs(c, n: int) -> dict[str, Any]:
    container = _p(c, n, "container", default={})
    return {
        "tracked": container.get("tracked"),
        "capacity_ml": container.get("capacity_ml"),
        "warn_days": container.get("warn_days"),
        "low_days": container.get("low_days"),
    }


def _boost(c, n: int) -> dict[str, Any] | None:
    return _s(c, n, "boost")


def _boost_attrs(c, n: int) -> dict[str, Any]:
    b = _boost(c, n) or {}
    out = {k: b.get(k) for k in ("active", "total_ml", "days", "doses", "doses_left", "per_dose_ml", "today_ml", "start_local", "end_local")}
    out["end"] = utc_dt(b.get("end_utc"))
    return out


def _schedule_value(c, n: int) -> str | None:
    sched = c.schedule(n)
    return sched.get("kind") if sched else None


def _schedule_attrs(c, n: int) -> dict[str, Any]:
    sched = dict(c.schedule(n))
    sched.pop("pump", None)
    return sched


def _limit_ml(c, n: int) -> float | None:
    return _p(c, n, "daily", "limit_ml")


def _retract_option(c, n: int) -> str | None:
    return _p(c, n, "retract", "setting")


def _uptime_start(c, _n: int) -> datetime | None:
    info = c.info()
    uptime = (info.get("system") or {}).get("uptime_s")
    utc = (info.get("time") or {}).get("utc")
    if not isinstance(uptime, (int, float)) or not isinstance(utc, (int, float)) or utc <= 0:
        return None
    start = datetime.fromtimestamp(utc - uptime, tz=timezone.utc)
    return start.replace(second=0, microsecond=0)  # stable state, no change every poll


def _ip(c, _n: int) -> str | None:
    net = c.info().get("network") or {}
    return net.get("eth_ip") if net.get("active") == "lan" else net.get("wlan_ip") or net.get("eth_ip")


def _night(c) -> dict[str, Any]:
    return ((c.data.led or {}).get("night") or {}) if c.data else {}


def _parse_hm(text: Any) -> time | None:
    try:
        hours, minutes = str(text).split(":")
        return time(int(hours), int(minutes))
    except (ValueError, TypeError):
        return None


async def _set_name(c, n: int, value: str) -> None:
    await c.async_settings(n, name=value.strip())


async def _set_capacity(c, n: int, value: float) -> None:
    remaining = _p(c, n, "container", "remaining_ml", default=0.0)
    if value <= 0:
        await c.async_container(n, capacity_ml=0)
    else:
        await c.async_container(n, capacity_ml=value, remaining_ml=min(remaining, value) if _tracked(c, n) else value)


async def _set_retract(c, n: int, option: str) -> None:
    if option == "own":
        rev = _p(c, n, "retract", "rev") or _p(c, n, "retract", "global_rev") or 0.25
        await c.async_settings(n, retract_rev=float(rev))
    else:
        await c.async_settings(n, retract_rev=option)


async def _set_switch_auto(c, n: int, on: bool) -> None:
    await c.async_settings(n, mode="auto" if on else "manual_only")


def _event_for_pump(event: dict[str, Any], n: int) -> str | None:
    if int(event.get("pump") or 0) != n:
        return None
    kind = event.get("kind")
    return kind if kind in PUMP_EVENT_KINDS else None


def _event_for_device(event: dict[str, Any], _n: int) -> str | None:
    if int(event.get("pump") or 0) != 0:
        return None
    kind = event.get("kind")
    return kind if kind in DEVICE_EVENT_KINDS else None


# -- the entities ------------------------------------------------------------------------

SENSORS = (
    # per pump
    LgalSensorDescription(
        key="container_remaining", translation_key="container_remaining", pump=True,
        device_class=SensorDeviceClass.VOLUME_STORAGE, state_class=SensorStateClass.MEASUREMENT,
        native_unit_of_measurement=ML, suggested_display_precision=0,
        value_fn=_container_ml, attrs_fn=_container_attrs,
    ),
    LgalSensorDescription(
        key="container_level", translation_key="container_level", pump=True,
        native_unit_of_measurement=PERCENTAGE, state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=0, value_fn=_container_pct,
    ),
    LgalSensorDescription(
        key="remaining_days", translation_key="remaining_days", pump=True,
        device_class=SensorDeviceClass.DURATION, native_unit_of_measurement=UnitOfTime.DAYS,
        state_class=SensorStateClass.MEASUREMENT, suggested_display_precision=1,
        value_fn=lambda c, n: _s(c, n, "remaining_days"),
    ),
    LgalSensorDescription(
        key="dosed_today", translation_key="dosed_today", pump=True,
        device_class=SensorDeviceClass.VOLUME, state_class=SensorStateClass.TOTAL_INCREASING,
        native_unit_of_measurement=ML, suggested_display_precision=1,
        value_fn=lambda c, n: _p(c, n, "daily", "used_ml"),
    ),
    LgalSensorDescription(
        key="planned_today", translation_key="planned_today", pump=True,
        native_unit_of_measurement=ML, state_class=SensorStateClass.MEASUREMENT, suggested_display_precision=1,
        value_fn=lambda c, n: _s(c, n, "planned_today_ml"),
    ),
    LgalSensorDescription(
        key="total_dosed", translation_key="total_dosed", pump=True,
        device_class=SensorDeviceClass.VOLUME, state_class=SensorStateClass.TOTAL_INCREASING,
        native_unit_of_measurement=ML, suggested_display_precision=0,
        value_fn=lambda c, n: _p(c, n, "total_ml"),
    ),
    LgalSensorDescription(
        key="next_dose", translation_key="next_dose", pump=True,
        device_class=SensorDeviceClass.TIMESTAMP,
        value_fn=lambda c, n: utc_dt(_s(c, n, "next", "at")), attrs_fn=_next_attrs,
    ),
    LgalSensorDescription(
        key="next_dose_amount", translation_key="next_dose_amount", pump=True,
        native_unit_of_measurement=ML, suggested_display_precision=2,
        value_fn=lambda c, n: _s(c, n, "next", "ml"),
    ),
    LgalSensorDescription(
        key="activity", translation_key="activity", pump=True,
        device_class=SensorDeviceClass.ENUM, options=ACTIVITIES,
        value_fn=lambda c, n: _p(c, n, "activity") if _p(c, n, "activity") in ACTIVITIES else None,
        attrs_fn=_activity_attrs,
    ),
    LgalSensorDescription(
        key="dose_progress", translation_key="dose_progress", pump=True,
        native_unit_of_measurement=PERCENTAGE, suggested_display_precision=0,
        value_fn=lambda c, n: _progress(c, n) if _p(c, n, "activity") in ("dosing", "calibrating") else None,
        entity_registry_enabled_default=False,
    ),
    LgalSensorDescription(
        key="last_result", translation_key="last_result", pump=True,
        device_class=SensorDeviceClass.ENUM, options=RESULTS,
        value_fn=lambda c, n: _p(c, n, "last", "result") if _p(c, n, "last", "result") in RESULTS else None,
        attrs_fn=_last_attrs,
    ),
    LgalSensorDescription(
        key="last_dose", translation_key="last_dose", pump=True,
        device_class=SensorDeviceClass.TIMESTAMP,
        value_fn=lambda c, n: utc_dt(_s(c, n, "last_run", "at")),
    ),
    LgalSensorDescription(
        key="skipped_today", translation_key="skipped_today", pump=True,
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda c, n: _s(c, n, "skipped"),
        attrs_fn=lambda c, n: {"last_reason": _s(c, n, "last_skip", "reason"), "last_at": utc_dt(_s(c, n, "last_skip", "at"))},
    ),
    LgalSensorDescription(
        key="boost_remaining", translation_key="boost_remaining", pump=True,
        native_unit_of_measurement=ML, suggested_display_precision=1,
        value_fn=lambda c, n: (_boost(c, n) or {}).get("remaining_ml", 0.0),
        attrs_fn=_boost_attrs,
    ),
    LgalSensorDescription(
        key="schedule", translation_key="schedule", pump=True,
        device_class=SensorDeviceClass.ENUM, options=["none", "spread", "times"],
        value_fn=_schedule_value, attrs_fn=_schedule_attrs,
        unrecorded=frozenset({"times", "today", "days", "start", "end", "count", "ml", "grid_min", "power_loss", "catch_up_min"}),
    ),
    LgalSensorDescription(
        key="calibration", translation_key="calibration", pump=True,
        native_unit_of_measurement="mL/rev", suggested_display_precision=4,
        entity_category=EntityCategory.DIAGNOSTIC,
        value_fn=lambda c, n: _p(c, n, "calibration", "ml_per_rev"), attrs_fn=_calibration_attrs,
        unrecorded=frozenset({"speed", "steps_per_ml", "pending_steps"}),
    ),
    LgalSensorDescription(
        key="calibrated_at", translation_key="calibrated_at", pump=True,
        device_class=SensorDeviceClass.TIMESTAMP, entity_category=EntityCategory.DIAGNOSTIC,
        value_fn=lambda c, n: utc_dt(_p(c, n, "calibration", "calibrated_at")),
    ),
    LgalSensorDescription(
        key="tube_hours", translation_key="tube_hours", pump=True,
        device_class=SensorDeviceClass.DURATION, native_unit_of_measurement=UnitOfTime.HOURS,
        state_class=SensorStateClass.TOTAL_INCREASING, suggested_display_precision=1,
        entity_category=EntityCategory.DIAGNOSTIC,
        value_fn=lambda c, n: _p(c, n, "tube", "hours"),
        attrs_fn=lambda c, n: {"limit_h": _p(c, n, "tube", "limit_h")},
    ),
    LgalSensorDescription(
        key="tube_wear", translation_key="tube_wear", pump=True,
        native_unit_of_measurement=PERCENTAGE, state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=0, entity_category=EntityCategory.DIAGNOSTIC,
        value_fn=lambda c, n: _p(c, n, "tube", "percent"),
    ),
    # device
    LgalSensorDescription(
        key="supply_voltage", translation_key="supply_voltage",
        device_class=SensorDeviceClass.VOLTAGE, state_class=SensorStateClass.MEASUREMENT,
        native_unit_of_measurement=UnitOfElectricPotential.VOLT, suggested_display_precision=1,
        entity_category=EntityCategory.DIAGNOSTIC,
        exists_fn=lambda c, _n: "supply" in c.info(),
        value_fn=lambda c, _n: (c.info().get("supply") or {}).get("volts"),
    ),
    LgalSensorDescription(
        key="last_boot", translation_key="last_boot",
        device_class=SensorDeviceClass.TIMESTAMP, entity_category=EntityCategory.DIAGNOSTIC,
        value_fn=_uptime_start,
        attrs_fn=lambda c, _n: {"reset_reason": (c.info().get("system") or {}).get("reset_reason")},
    ),
    LgalSensorDescription(
        key="ip_address", translation_key="ip_address", entity_category=EntityCategory.DIAGNOSTIC,
        value_fn=_ip,
    ),
    LgalSensorDescription(
        key="network", translation_key="network", entity_category=EntityCategory.DIAGNOSTIC,
        device_class=SensorDeviceClass.ENUM, options=["lan", "wlan", "none"],
        value_fn=lambda c, _n: (c.info().get("network") or {}).get("active"),
    ),
    LgalSensorDescription(
        key="time_source", translation_key="time_source", entity_category=EntityCategory.DIAGNOSTIC,
        entity_registry_enabled_default=False,
        value_fn=lambda c, _n: (c.info().get("time") or {}).get("source"),
        attrs_fn=lambda c, _n: {
            "timezone": (c.info().get("time") or {}).get("timezone"),
            "ntp_server": (c.info().get("time") or {}).get("ntp_server"),
            "last_ntp_sync": utc_dt((c.info().get("time") or {}).get("last_ntp_sync")),
        },
    ),
    LgalSensorDescription(
        key="heap_free", translation_key="heap_free", entity_category=EntityCategory.DIAGNOSTIC,
        native_unit_of_measurement="B", state_class=SensorStateClass.MEASUREMENT,
        entity_registry_enabled_default=False,
        value_fn=lambda c, _n: (c.info().get("system") or {}).get("heap_free"),
        attrs_fn=lambda c, _n: {
            "heap_min_free": (c.info().get("system") or {}).get("heap_min_free"),
            "heap_largest_block": (c.info().get("system") or {}).get("heap_largest_block"),
            "psram_free": (c.info().get("system") or {}).get("psram_free"),
        },
    ),
)

BINARY_SENSORS = (
    LgalBinarySensorDescription(
        key="running", translation_key="running", pump=True, device_class=BinarySensorDeviceClass.RUNNING,
        value_fn=lambda c, n: _p(c, n, "activity", default="idle") != "idle",
    ),
    LgalBinarySensorDescription(
        key="container_low", translation_key="container_low", pump=True, device_class=BinarySensorDeviceClass.PROBLEM,
        value_fn=lambda c, n: c.pump_alarms(n)["container_low"],
    ),
    LgalBinarySensorDescription(
        key="container_warning", translation_key="container_warning", pump=True, device_class=BinarySensorDeviceClass.PROBLEM,
        value_fn=lambda c, n: c.pump_alarms(n)["container_warning"],
    ),
    LgalBinarySensorDescription(
        key="driver_fault", translation_key="driver_fault", pump=True, device_class=BinarySensorDeviceClass.PROBLEM,
        value_fn=lambda c, n: c.pump_alarms(n)["driver_fault"],
    ),
    LgalBinarySensorDescription(
        key="daily_limit_reached", translation_key="daily_limit_reached", pump=True, device_class=BinarySensorDeviceClass.PROBLEM,
        value_fn=lambda c, n: c.pump_alarms(n)["daily_limit"],
    ),
    LgalBinarySensorDescription(
        key="calibration_due", translation_key="calibration_due", pump=True, device_class=BinarySensorDeviceClass.PROBLEM,
        value_fn=lambda c, n: c.pump_alarms(n)["calibration_due"],
        attrs_fn=lambda c, n: {
            "due": _p(c, n, "calibration", "due"),
            "tube_changed": _p(c, n, "calibration", "tube_changed"),
            "calibrated": _p(c, n, "calibration", "calibrated"),
        },
    ),
    LgalBinarySensorDescription(
        key="tube_worn", translation_key="tube_worn", pump=True, device_class=BinarySensorDeviceClass.PROBLEM,
        value_fn=lambda c, n: c.pump_alarms(n)["tube_worn"],
    ),
    LgalBinarySensorDescription(
        key="boost_active", translation_key="boost_active", pump=True,
        value_fn=lambda c, n: bool((_boost(c, n) or {}).get("active")),
    ),
    LgalBinarySensorDescription(
        key="calibration_pending", translation_key="calibration_pending", pump=True,
        entity_category=EntityCategory.DIAGNOSTIC,
        value_fn=lambda c, n: bool(_p(c, n, "calibration", "pending")),
        attrs_fn=lambda c, n: {"target_ml": _p(c, n, "calibration", "pending_target_ml")},
    ),
    # device
    LgalBinarySensorDescription(
        key="alarm", translation_key="alarm", device_class=BinarySensorDeviceClass.PROBLEM,
        value_fn=lambda c, _n: c.device_alarms()["critical"],
        # "doser" lets the dashboard cards find the doser device
        attrs_fn=lambda c, _n: {"conditions": c.device_alarms()["conditions"], "doser": c.identity.mac},
    ),
    LgalBinarySensorDescription(
        key="warning", translation_key="warning", device_class=BinarySensorDeviceClass.PROBLEM,
        value_fn=lambda c, _n: c.device_alarms()["warning"],
        attrs_fn=lambda c, _n: {"conditions": c.device_alarms()["conditions"]},
    ),
    LgalBinarySensorDescription(
        key="clock_problem", translation_key="clock_problem", device_class=BinarySensorDeviceClass.PROBLEM,
        entity_category=EntityCategory.DIAGNOSTIC,
        value_fn=lambda c, _n: not c.data.clock_valid or (c.info().get("time") or {}).get("rtc_ok") is False
        or bool((c.info().get("time") or {}).get("rtc_lost")),
        attrs_fn=lambda c, _n: {
            "time_valid": c.data.clock_valid,
            "rtc_ok": (c.info().get("time") or {}).get("rtc_ok"),
            "rtc_lost": (c.info().get("time") or {}).get("rtc_lost"),
        },
    ),
    LgalBinarySensorDescription(
        key="supply_problem", translation_key="supply_problem", device_class=BinarySensorDeviceClass.PROBLEM,
        exists_fn=lambda c, _n: "supply" in c.info(),
        value_fn=lambda c, _n: (c.info().get("supply") or {}).get("state") in ("low", "missing"),
        attrs_fn=lambda c, _n: {"state": (c.info().get("supply") or {}).get("state")},
    ),
    LgalBinarySensorDescription(
        key="live_connection", translation_key="live_connection", device_class=BinarySensorDeviceClass.CONNECTIVITY,
        entity_category=EntityCategory.DIAGNOSTIC,
        value_fn=lambda c, _n: c.ws_connected,
    ),
)

NUMBERS = (
    LgalNumberDescription(
        key="daily_limit", translation_key="daily_limit", pump=True, entity_category=EntityCategory.CONFIG,
        native_min_value=0, native_max_value=10000, native_step=0.1, mode=NumberMode.BOX, native_unit_of_measurement=ML,
        value_fn=_limit_ml, set_fn=lambda c, n, v: c.async_settings(n, daily_limit_ml=float(v)),
    ),
    LgalNumberDescription(
        key="container_capacity", translation_key="container_capacity", pump=True, entity_category=EntityCategory.CONFIG,
        native_min_value=0, native_max_value=100000, native_step=1, mode=NumberMode.BOX, native_unit_of_measurement=ML,
        value_fn=lambda c, n: _p(c, n, "container", "capacity_ml"), set_fn=_set_capacity,
    ),
    LgalNumberDescription(
        key="container_content", translation_key="container_content", pump=True,
        native_min_value=0, native_max_value=100000, native_step=1, mode=NumberMode.BOX, native_unit_of_measurement=ML,
        available_fn=_tracked, value_fn=_container_ml,
        max_fn=lambda c, n: _p(c, n, "container", "capacity_ml") or 100000,
        set_fn=lambda c, n, v: c.async_container(n, remaining_ml=float(v)),
    ),
    LgalNumberDescription(
        key="warn_days", translation_key="warn_days", pump=True, entity_category=EntityCategory.CONFIG,
        native_min_value=0, native_max_value=60, native_step=1, mode=NumberMode.BOX, native_unit_of_measurement=UnitOfTime.DAYS,
        value_fn=lambda c, n: _p(c, n, "container", "own_warn_days"),
        set_fn=lambda c, n, v: c.async_settings(n, warn_days=int(v)),
    ),
    LgalNumberDescription(
        key="low_days", translation_key="low_days", pump=True, entity_category=EntityCategory.CONFIG,
        native_min_value=0, native_max_value=60, native_step=1, mode=NumberMode.BOX, native_unit_of_measurement=UnitOfTime.DAYS,
        value_fn=lambda c, n: _p(c, n, "container", "own_low_days"),
        set_fn=lambda c, n, v: c.async_settings(n, low_days=int(v)),
    ),
    LgalNumberDescription(
        key="remind_months", translation_key="remind_months", pump=True, entity_category=EntityCategory.CONFIG,
        native_min_value=0, native_max_value=24, native_step=1, mode=NumberMode.BOX, native_unit_of_measurement="mo",
        value_fn=lambda c, n: _p(c, n, "calibration", "remind_months"),
        set_fn=lambda c, n, v: c.async_settings(n, remind_months=int(v)),
    ),
    LgalNumberDescription(
        key="retract_rev", translation_key="retract_rev", pump=True, entity_category=EntityCategory.CONFIG,
        entity_registry_enabled_default=False,
        native_min_value=0, native_max_value=2, native_step=0.05, mode=NumberMode.BOX, native_unit_of_measurement="rev",
        value_fn=lambda c, n: _p(c, n, "retract", "rev"),
        set_fn=lambda c, n, v: c.async_settings(n, retract_rev=float(v) if v > 0 else "off"),
    ),
    LgalNumberDescription(
        key="led_night_brightness", translation_key="led_night_brightness", entity_category=EntityCategory.CONFIG,
        native_min_value=0, native_max_value=100, native_step=1, native_unit_of_measurement=PERCENTAGE,
        exists_fn=lambda c, _n: bool(c.data.led), value_fn=lambda c, _n: _night(c).get("brightness"),
        set_fn=lambda c, _n, v: c.async_led({"brightness": int(v)}),
    ),
)

LOCAL_NUMBERS = (
    LgalLocalNumberDescription(
        key="dose_amount", translation_key="dose_amount", pump=True,
        native_min_value=0.02, native_max_value=500, native_step=0.01, mode=NumberMode.BOX,
        native_unit_of_measurement=ML, initial=1.0,
    ),
)

SELECTS = (
    LgalSelectDescription(
        key="mode", translation_key="mode", pump=True, options=list(MODES),
        value_fn=lambda c, n: _p(c, n, "mode"), set_fn=lambda c, n, v: c.async_settings(n, mode=v),
    ),
    LgalSelectDescription(
        key="speed", translation_key="speed", pump=True, options=list(TIERS), entity_category=EntityCategory.CONFIG,
        value_fn=lambda c, n: TIERS[t] if isinstance(t := _p(c, n, "speed", "tier"), int) and 0 <= t < len(TIERS) else None,
        set_fn=lambda c, n, v: c.async_settings(n, tier=TIERS.index(v)),
        attrs_fn=lambda c, n: {"tiers": _p(c, n, "speed", "tiers")},
    ),
    LgalSelectDescription(
        key="direction", translation_key="direction", pump=True, options=["cw", "ccw"],
        entity_category=EntityCategory.CONFIG, entity_registry_enabled_default=False,
        value_fn=lambda c, n: _p(c, n, "direction"), set_fn=lambda c, n, v: c.async_settings(n, direction=v),
    ),
    LgalSelectDescription(
        key="retract", translation_key="retract", pump=True, options=["off", "global", "own"],
        entity_category=EntityCategory.CONFIG, entity_registry_enabled_default=False,
        value_fn=_retract_option, set_fn=_set_retract,
    ),
    LgalSelectDescription(
        key="manual_during_lock", translation_key="manual_during_lock", options=["reject", "queue"],
        entity_category=EntityCategory.CONFIG,
        exists_fn=lambda c, _n: c.data.locks is not None,
        value_fn=lambda c, _n: (c.data.locks or {}).get("manual"),
        set_fn=lambda c, _n, v: c.async_locks(manual=v),
        attrs_fn=lambda c, _n: {"rules": (c.data.locks or {}).get("rules")},
    ),
)

SWITCHES = (
    LgalSwitchDescription(
        key="automatic", translation_key="automatic", pump=True,
        value_fn=lambda c, n: _p(c, n, "mode") == "auto", set_fn=_set_switch_auto,
    ),
    LgalSwitchDescription(
        key="led_night_mode", translation_key="led_night_mode", entity_category=EntityCategory.CONFIG,
        exists_fn=lambda c, _n: bool(c.data.led), value_fn=lambda c, _n: bool(_night(c).get("enabled")),
        set_fn=lambda c, _n, v: c.async_led({"enabled": bool(v)}),
        attrs_fn=lambda c, _n: {"active": _night(c).get("active")},
    ),
)

TEXTS = (
    LgalTextDescription(
        key="name", translation_key="name", pump=True, entity_category=EntityCategory.CONFIG,
        native_min=0, native_max=23, mode=TextMode.TEXT,
        value_fn=lambda c, n: _p(c, n, "name", default=""), set_fn=_set_name,
    ),
)

TIMES = (
    LgalTimeDescription(
        key="led_night_start", translation_key="led_night_start", entity_category=EntityCategory.CONFIG,
        exists_fn=lambda c, _n: bool(c.data.led), value_fn=lambda c, _n: _parse_hm(_night(c).get("start")),
        set_fn=lambda c, _n, v: c.async_led({"start": v.strftime("%H:%M")}),
    ),
    LgalTimeDescription(
        key="led_night_end", translation_key="led_night_end", entity_category=EntityCategory.CONFIG,
        exists_fn=lambda c, _n: bool(c.data.led), value_fn=lambda c, _n: _parse_hm(_night(c).get("end")),
        set_fn=lambda c, _n, v: c.async_led({"end": v.strftime("%H:%M")}),
    ),
)

BUTTONS = (
    LgalButtonDescription(
        key="dose", translation_key="dose", pump=True,
        press_fn=lambda c, n: c.async_dose(n, c.dose_amounts.get(n, 1.0)),  # amount: number "Dose amount"
    ),
    LgalButtonDescription(key="stop", translation_key="stop", pump=True, press_fn=lambda c, n: c.async_stop(n)),
    LgalButtonDescription(
        key="refill", translation_key="refill", pump=True, available_fn=_tracked, press_fn=lambda c, n: c.async_refill(n),
    ),
    LgalButtonDescription(
        key="tube_replaced", translation_key="tube_replaced", pump=True, entity_category=EntityCategory.CONFIG,
        press_fn=lambda c, n: c.async_tube(n, 0),
    ),
    LgalButtonDescription(
        key="boost_stop", translation_key="boost_stop", pump=True, available_fn=lambda c, n: _boost(c, n) is not None,
        press_fn=lambda c, n: c.async_boost(n),
    ),
    LgalButtonDescription(key="stop_all", translation_key="stop_all", press_fn=lambda c, _n: c.async_stop(0)),
    LgalButtonDescription(
        key="restart", translation_key="restart", device_class=ButtonDeviceClass.RESTART,
        entity_category=EntityCategory.DIAGNOSTIC, press_fn=lambda c, _n: c.async_reboot(),
    ),
    LgalButtonDescription(
        key="check_update", translation_key="check_update", entity_category=EntityCategory.DIAGNOSTIC,
        exists_fn=lambda c, _n: bool((c.data.release or {}).get("source")),
        press_fn=lambda c, _n: c.async_check_update(),
    ),
)

EVENTS = (
    LgalEventDescription(
        key="events", translation_key="pump_events", pump=True, event_types=list(PUMP_EVENT_KINDS), match_fn=_event_for_pump,
    ),
    LgalEventDescription(
        key="events", translation_key="device_events", event_types=list(DEVICE_EVENT_KINDS), match_fn=_event_for_device,
    ),
)

UPDATES = (
    LgalUpdateDescription(
        key="firmware", translation_key="firmware", entity_category=EntityCategory.CONFIG,
        exists_fn=lambda c, _n: c.data.release is not None,
    ),
)

DOSER_ENTITIES = ModelEntities(
    sensors=SENSORS,
    binary_sensors=BINARY_SENSORS,
    numbers=NUMBERS,
    local_numbers=LOCAL_NUMBERS,
    selects=SELECTS,
    switches=SWITCHES,
    buttons=BUTTONS,
    texts=TEXTS,
    times=TIMES,
    events=EVENTS,
    updates=UPDATES,
)

