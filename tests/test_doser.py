# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""The integration in a real Home Assistant against the firmware's device mock."""

from __future__ import annotations

import asyncio
from unittest.mock import patch

import aiohttp
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.util import slugify

from custom_components.lg_aquatic_life.const import DOMAIN

MAC = "aabbcc001122"  # the mock's MAC AA:BB:CC:00:11:22


async def _setup(hass: HomeAssistant, host: str) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, unique_id=MAC, data={"host": host, "api_key": "lgal_test"}, title="Doser")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.LOADED
    return entry


def _eid(hass: HomeAssistant, platform: str, unique_id: str) -> str:
    entity_id = er.async_get(hass).async_get_entity_id(platform, DOMAIN, unique_id)
    assert entity_id, unique_id
    return entity_id


async def _get(host: str, path: str):
    async with aiohttp.ClientSession() as s, s.get(f"http://{host}{path}") as r:
        return await r.json()


async def _wait_for(predicate, timeout=8.0):
    deadline = asyncio.get_running_loop().time() + timeout
    while asyncio.get_running_loop().time() < deadline:
        if await predicate():
            return True
        await asyncio.sleep(0.1)
    return False


async def test_setup_devices_and_entities(hass: HomeAssistant, mock_device: str) -> None:
    entry = await _setup(hass, mock_device)
    coordinator = entry.runtime_data.coordinator
    pumps = await _get(mock_device, "/api/v1/pumps")
    fitted = tuple(p["pump"] for p in pumps["pumps"] if p["fitted"])
    assert coordinator.fitted == fitted

    # the doser and one child device per fitted pump
    registry = dr.async_get(hass)
    controller = registry.async_get_device_by_identifier(config_entry_id=entry.entry_id, identifier=(DOMAIN, MAC))
    assert controller is not None and controller.model == "LGAL Doser 5"
    children = dr.async_child_entries_for_config_entry(registry, entry.entry_id)
    assert len(children) == len(fitted)
    assert {c.parent_device_id for c in children} == {controller.id}
    named = {c.name for c in children}
    assert "KH" in named and "Calcium" in named
    # pump entity ids carry the pump number, not its name; the shown name follows the pump
    ents = er.async_get(hass)
    level = ents.async_get_entity_id("sensor", DOMAIN, f"{MAC}_p1_container_remaining")
    assert level == f"sensor.{slugify(controller.name)}_pump_1_container_remaining"
    pump1 = next(c for c in children if c.id == ents.async_get(level).device_id)
    assert hass.states.get(level).name.startswith(pump1.name)
    assert ents.async_get_entity_id("button", DOMAIN, f"{MAC}_p3_dose") == f"button.{slugify(controller.name)}_pump_3_dose"
    # the doser's entities: doser name and key, no area
    assert ents.async_get_entity_id("binary_sensor", DOMAIN, f"{MAC}_alarm") == f"binary_sensor.{slugify(controller.name)}_alarm"
    assert entry.data["entity_id_scheme"] == 2

    # values from the mock
    p1 = pumps["pumps"][0]
    state = hass.states.get(_eid(hass, "sensor", f"{MAC}_p1_container_remaining"))
    assert float(state.state) == pytest.approx(p1["container"]["remaining_ml"], abs=1)
    assert hass.states.get(_eid(hass, "select", f"{MAC}_p1_mode")).state == p1["mode"]
    assert hass.states.get(_eid(hass, "sensor", f"{MAC}_p1_schedule")).state == "spread"
    assert hass.states.get(_eid(hass, "sensor", f"{MAC}_p1_next_dose")).state not in ("unknown", "unavailable")
    # pump 2 had a driver fault in its last run (mock): alarm of the device
    assert hass.states.get(_eid(hass, "binary_sensor", f"{MAC}_p2_driver_fault")).state == "on"
    alarm = hass.states.get(_eid(hass, "binary_sensor", f"{MAC}_alarm"))
    assert alarm.state == "on" and "pump2_driver_fault" in alarm.attributes["conditions"]
    assert hass.states.get(_eid(hass, "update", f"{MAC}_firmware")) is not None
    activity = hass.states.get(_eid(hass, "sensor", f"{MAC}_p1_activity"))
    assert activity.attributes["doser"] == MAC and activity.attributes["pump"] == 1

    # live connection is up
    assert await _wait_for(lambda: _true(coordinator.ws_connected))
    assert await hass.config_entries.async_unload(entry.entry_id)


async def _true(value):
    return bool(value)


async def test_old_entity_ids_are_fixed_once(hass: HomeAssistant, mock_device: str) -> None:
    """Ids from pump names and areas (restored after removing and re-adding) are renamed once."""
    ents = er.async_get(hass)
    entry = MockConfigEntry(domain=DOMAIN, unique_id=MAC, data={"host": mock_device, "api_key": "lgal_test"}, title="Doser")
    entry.add_to_hass(hass)
    old_pump = ents.async_get_or_create("sensor", DOMAIN, f"{MAC}_p1_container_remaining", suggested_object_id="doser_kh_container_content", config_entry=entry)
    old_doser = ents.async_get_or_create("binary_sensor", DOMAIN, f"{MAC}_alarm", suggested_object_id="wohnzimmer_doser_alarm", config_entry=entry)
    assert old_pump.entity_id == "sensor.doser_kh_container_content"
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    pump_id = ents.async_get_entity_id("sensor", DOMAIN, f"{MAC}_p1_container_remaining")
    doser_id = ents.async_get_entity_id("binary_sensor", DOMAIN, f"{MAC}_alarm")
    assert pump_id.endswith("_pump_1_container_remaining") and not pump_id.startswith("sensor.doser_kh")
    assert doser_id.endswith("_alarm") and "wohnzimmer" not in doser_id
    assert hass.states.get(pump_id) is not None and hass.states.get(old_pump.entity_id) is None
    assert entry.data["entity_id_scheme"] == 2

    # an id the user changes afterwards stays, also after a reload
    ents.async_update_entity(pump_id, new_entity_id="sensor.my_kh_level")
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert ents.async_get_entity_id("sensor", DOMAIN, f"{MAC}_p1_container_remaining") == "sensor.my_kh_level"
    assert old_doser.unique_id == f"{MAC}_alarm"
    assert await hass.config_entries.async_unload(entry.entry_id)


async def test_dose_via_action_and_live_push(hass: HomeAssistant, mock_device: str) -> None:
    entry = await _setup(hass, mock_device)
    coordinator = entry.runtime_data.coordinator
    assert await _wait_for(lambda: _true(coordinator.ws_connected))
    pump1 = coordinator.pump_device_ids[1]
    await hass.services.async_call(DOMAIN, "dose", {"device_id": pump1, "amount": 3}, blocking=True)
    running = _eid(hass, "binary_sensor", f"{MAC}_p1_running")

    async def is_running():
        await hass.async_block_till_done()
        return hass.states.get(running).state == "on"

    assert await _wait_for(is_running)
    # stop through the doser itself (all pumps)
    await hass.services.async_call(DOMAIN, "stop", {"device_id": coordinator.controller_device_id}, blocking=True)

    async def stopped():
        await hass.async_block_till_done()
        return hass.states.get(running).state == "off"

    assert await _wait_for(stopped)
    assert await hass.config_entries.async_unload(entry.entry_id)


async def test_dose_button_uses_amount(hass: HomeAssistant, mock_device: str) -> None:
    entry = await _setup(hass, mock_device)
    amount = _eid(hass, "number", f"{MAC}_p3_dose_amount")
    await hass.services.async_call("number", "set_value", {"entity_id": amount, "value": 0.5}, blocking=True)
    await hass.services.async_call("button", "press", {"entity_id": _eid(hass, "button", f"{MAC}_p3_dose")}, blocking=True)
    pumps = await _get(mock_device, "/api/v1/pumps")
    assert pumps["pumps"][2]["activity"] == "dosing"
    assert pumps["pumps"][2]["target_ml"] == pytest.approx(0.5)
    assert await hass.config_entries.async_unload(entry.entry_id)


async def test_device_errors_are_translated(hass: HomeAssistant, mock_device: str) -> None:
    entry = await _setup(hass, mock_device)
    coordinator = entry.runtime_data.coordinator
    # the mock answers 13 ml with a lock time collision
    with pytest.raises(HomeAssistantError) as err:
        await hass.services.async_call(DOMAIN, "dose", {"device_id": coordinator.pump_device_ids[1], "amount": 13}, blocking=True)
    assert err.value.translation_key == "err_collision_lock"
    # a pump number on a pump device is not needed, on the doser it is
    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(DOMAIN, "dose", {"device_id": coordinator.controller_device_id, "amount": 1}, blocking=True)
    assert await hass.config_entries.async_unload(entry.entry_id)


async def test_settings_and_container(hass: HomeAssistant, mock_device: str) -> None:
    entry = await _setup(hass, mock_device)
    await hass.services.async_call("select", "select_option", {"entity_id": _eid(hass, "select", f"{MAC}_p1_mode"), "option": "manual_only"}, blocking=True)
    await hass.services.async_call("number", "set_value", {"entity_id": _eid(hass, "number", f"{MAC}_p1_daily_limit"), "value": 42.5}, blocking=True)
    await hass.services.async_call("text", "set_value", {"entity_id": _eid(hass, "text", f"{MAC}_p1_name"), "value": "Alk"}, blocking=True)
    await hass.services.async_call("button", "press", {"entity_id": _eid(hass, "button", f"{MAC}_p2_refill")}, blocking=True)
    pumps = (await _get(mock_device, "/api/v1/pumps"))["pumps"]
    assert pumps[0]["mode"] == "manual_only"
    assert pumps[0]["daily"]["limit_ml"] == pytest.approx(42.5)
    assert pumps[0]["name"] == "Alk"
    assert pumps[1]["container"]["remaining_ml"] == pumps[1]["container"]["capacity_ml"]
    await hass.async_block_till_done()
    assert hass.states.get(_eid(hass, "switch", f"{MAC}_p1_automatic")).state == "off"
    # the pump device follows the new name
    device = dr.async_get(hass).async_get(entry.runtime_data.coordinator.pump_device_ids[1])
    assert device.name == "Alk"
    assert await hass.config_entries.async_unload(entry.entry_id)


async def test_schedule_and_boost(hass: HomeAssistant, mock_device: str) -> None:
    entry = await _setup(hass, mock_device)
    coordinator = entry.runtime_data.coordinator
    pump5 = coordinator.pump_device_ids[5]
    await hass.services.async_call(
        DOMAIN, "set_schedule",
        {"device_id": pump5, "kind": "spread", "amount": 4.5, "doses": 3, "start": "08:00", "end": "20:00", "days": "daily"},
        blocking=True,
    )
    sched = await _get(mock_device, "/api/v1/pumps/schedule?pump=5")
    assert sched["kind"] == "spread" and sched["count"] == 3 and sched["ml"] == 4.5
    await hass.async_block_till_done()
    state = hass.states.get(_eid(hass, "sensor", f"{MAC}_p5_schedule"))
    assert state.state == "spread" and len(state.attributes["today"]["slots"]) == 3

    # off the grid -> translated validation error
    with pytest.raises(ServiceValidationError) as err:
        await hass.services.async_call(
            DOMAIN, "set_schedule", {"device_id": pump5, "kind": "times", "times": [{"time": "09:03", "ml": 1}]}, blocking=True
        )
    assert err.value.translation_key == "err_off_grid"

    await hass.services.async_call(DOMAIN, "start_boost", {"device_id": pump5, "amount": 3, "days": 2}, blocking=True)
    await hass.async_block_till_done()
    assert hass.states.get(_eid(hass, "binary_sensor", f"{MAC}_p5_boost_active")).state == "on"
    await hass.services.async_call(DOMAIN, "stop_boost", {"device_id": pump5}, blocking=True)
    await hass.async_block_till_done()
    assert hass.states.get(_eid(hass, "binary_sensor", f"{MAC}_p5_boost_active")).state == "off"
    assert await hass.config_entries.async_unload(entry.entry_id)


async def test_prime_with_duration_and_hold(hass: HomeAssistant, mock_device: str) -> None:
    entry = await _setup(hass, mock_device)
    coordinator = entry.runtime_data.coordinator
    assert await _wait_for(lambda: _true(coordinator.ws_connected))
    pump2 = coordinator.pump_device_ids[2]
    await hass.services.async_call(DOMAIN, "prime", {"device_id": pump2, "duration": 1.0}, blocking=True)
    assert (await _get(mock_device, "/api/v1/pumps"))["pumps"][1]["activity"] == "priming"

    async def idle():
        return (await _get(mock_device, "/api/v1/pumps"))["pumps"][1]["activity"] == "idle"

    assert await _wait_for(idle, 5)
    # hold: start, keep beating, release -> stops shortly after the last beat
    await hass.services.async_call(DOMAIN, "prime", {"device_id": pump2, "action": "start"}, blocking=True)
    for _ in range(4):
        await asyncio.sleep(0.5)
        await hass.services.async_call(DOMAIN, "prime", {"device_id": pump2, "action": "beat"}, blocking=True)
    assert (await _get(mock_device, "/api/v1/pumps"))["pumps"][1]["activity"] == "priming"
    assert await _wait_for(idle, 5)
    assert await hass.config_entries.async_unload(entry.entry_id)


async def test_calibration(hass: HomeAssistant, mock_device: str) -> None:
    entry = await _setup(hass, mock_device)
    pump1 = entry.runtime_data.coordinator.pump_device_ids[1]
    await hass.services.async_call(DOMAIN, "calibrate", {"device_id": pump1, "action": "start", "amount": 2}, blocking=True)

    async def pending():
        return (await _get(mock_device, "/api/v1/pumps"))["pumps"][0]["calibration"]["pending"]

    assert await _wait_for(pending, 8)
    await hass.services.async_call(DOMAIN, "calibrate", {"device_id": pump1, "action": "apply", "amount": 2.1}, blocking=True)
    cal = (await _get(mock_device, "/api/v1/pumps"))["pumps"][0]["calibration"]
    assert not cal["pending"]
    assert await hass.config_entries.async_unload(entry.entry_id)


async def test_history_events(hass: HomeAssistant, mock_device: str) -> None:
    entry = await _setup(hass, mock_device)
    coordinator = entry.runtime_data.coordinator
    events = []
    hass.bus.async_listen(f"{DOMAIN}_event", lambda e: events.append(e.data))
    await asyncio.sleep(1.1)  # the history cursor is in whole seconds
    await hass.services.async_call(DOMAIN, "dose", {"device_id": coordinator.pump_device_ids[3], "amount": 0.2}, blocking=True)
    await coordinator.async_refresh()
    await hass.async_block_till_done()
    doses = [e for e in events if e["kind"] == "dose" and e["pump"] == 3]
    assert doses and doses[0]["pump_device_id"] == coordinator.pump_device_ids[3]
    state = hass.states.get(_eid(hass, "event", f"{MAC}_p3_events"))
    assert state.attributes["event_type"] == "dose"
    # response actions
    daily = await hass.services.async_call(
        DOMAIN, "get_daily_history", {"device_id": coordinator.controller_device_id, "days": 7}, blocking=True, return_response=True
    )
    assert len(daily["days"]) == 7 and daily["pumps"]
    history = await hass.services.async_call(
        DOMAIN, "get_history", {"device_id": coordinator.pump_device_ids[3], "kinds": ["dose"]}, blocking=True, return_response=True
    )
    assert history["events"] and all(e["pump"] == 3 for e in history["events"])
    assert await hass.config_entries.async_unload(entry.entry_id)


async def test_wrong_key_starts_reauth(hass: HomeAssistant, mock_device_strict: str) -> None:
    entry = MockConfigEntry(domain=DOMAIN, unique_id=MAC, data={"host": mock_device_strict, "api_key": "lgal_wrong"})
    entry.add_to_hass(hass)
    assert not await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.SETUP_ERROR
    flows = hass.config_entries.flow.async_progress()
    assert any(f["context"]["source"] == "reauth" for f in flows)


async def test_config_flow_user(hass: HomeAssistant, mock_device: str) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    assert result["type"] == "form"
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {"host": mock_device, "api_key": "lgal_x"})
    assert result["type"] == "create_entry"
    assert result["result"].unique_id == MAC
    await hass.async_block_till_done()
    # the same device again
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {"host": mock_device, "api_key": "lgal_x"})
    assert result["type"] == "abort" and result["reason"] == "already_configured"
    for entry in hass.config_entries.async_entries(DOMAIN):
        await hass.config_entries.async_unload(entry.entry_id)


async def test_config_flow_bad_key(hass: HomeAssistant, mock_device_strict: str) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {"host": mock_device_strict, "api_key": "lgal_x"})
    assert result["type"] == "form" and result["errors"] == {"api_key": "invalid_auth"}


async def test_config_flow_unreachable(hass: HomeAssistant, socket_enabled) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {"host": "127.0.0.1:9", "api_key": "lgal_x"})
    assert result["errors"] == {"base": "cannot_connect"}


def _zeroconf(vendor: str = "LG Aquatic Life", short_id: str = "1122"):
    from ipaddress import ip_address

    from homeassistant.helpers.service_info.zeroconf import ZeroconfServiceInfo

    return ZeroconfServiceInfo(
        ip_address=ip_address("192.0.2.10"), ip_addresses=[ip_address("192.0.2.10")], port=80,
        hostname=f"lgal-doser-{short_id}.local.", type="_http._tcp.local.",
        name=f"LGAL Doser {short_id}._http._tcp.local.",
        properties={"vendor": vendor, "type": "doser", "id": short_id},
    )


async def test_zeroconf_discovery(hass: HomeAssistant) -> None:
    """A doser announced over mDNS asks for the API key; other vendors and known devices are ignored."""
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "zeroconf"}, data=_zeroconf())
    assert result["type"] == "form" and result["step_id"] == "zeroconf_confirm"
    assert result["description_placeholders"]["host"] == "lgal-doser-1122.local"

    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "zeroconf"}, data=_zeroconf(vendor="Other"))
    assert result["type"] == "abort" and result["reason"] == "not_lgal"

    # known device added by IP: the new address is taken over
    entry = MockConfigEntry(domain=DOMAIN, unique_id="aabbcc001122", data={"host": "192.0.2.99", "api_key": "lgal_x"})
    entry.add_to_hass(hass)
    with patch.object(hass.config_entries, "async_schedule_reload") as reload:
        result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "zeroconf"}, data=_zeroconf())
    assert result["type"] == "abort" and result["reason"] == "already_configured"
    assert entry.data["host"] == "192.0.2.10"
    reload.assert_called_once_with(entry.entry_id)
