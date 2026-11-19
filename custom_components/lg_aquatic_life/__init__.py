# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""The LG Aquatic Life integration: local control of LG Aquatic Life devices."""

from __future__ import annotations

import logging
import pathlib
from dataclasses import dataclass

from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_HOST, Platform
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import ConfigEntryAuthFailed, ConfigEntryError, ConfigEntryNotReady
from homeassistant.helpers import config_validation as cv, device_registry as dr
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.typing import ConfigType

from .api import LgalApi, LgalAuthError, LgalConnectionError, LgalError, LgalSetupRequired
from .const import CARD_FILES, CONF_API_KEY, DOMAIN, FRONTEND_URL, VERSION
from .entity import async_fix_entity_ids, controller_device_info
from .frontend_resource import async_ensure_resource, async_remove_resources
from .models import DeviceType, device_type
from .services import async_setup_services

_LOGGER = logging.getLogger(__name__)

PLATFORMS = [
    Platform.BINARY_SENSOR,
    Platform.BUTTON,
    Platform.EVENT,
    Platform.NUMBER,
    Platform.SELECT,
    Platform.SENSOR,
    Platform.SWITCH,
    Platform.TEXT,
    Platform.TIME,
    Platform.UPDATE,
]

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


@dataclass
class LgalRuntime:
    api: LgalApi
    coordinator: object  # the device type's coordinator (e.g. DoserCoordinator)
    device_type: DeviceType


type LgalConfigEntry = ConfigEntry[LgalRuntime]


def _card_urls() -> list[str]:
    return [f"{FRONTEND_URL}/{card}?v={VERSION}" for card in CARD_FILES]


def _lovelace_resources(hass: HomeAssistant):
    """The dashboard resource collection, or None if it cannot be reached."""
    try:
        from homeassistant.components.lovelace.const import LOVELACE_DATA

        return hass.data[LOVELACE_DATA].resources
    except (ImportError, KeyError, AttributeError):
        data = hass.data.get("lovelace")
        if isinstance(data, dict):
            return data.get("resources")
        return getattr(data, "resources", None)


async def _async_register_resources(hass: HomeAssistant) -> None:
    """Register the cards as dashboard resources (storage mode only)."""
    if hass.config.safe_mode:
        return
    resources = _lovelace_resources(hass)
    if resources is None:
        return
    for url in _card_urls():
        try:
            await async_ensure_resource(resources, url)
        except Exception:  # noqa: BLE001 - the cards are optional, never break the setup
            _LOGGER.warning("Could not register %s as a dashboard resource", url, exc_info=True)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Serve the dashboard cards, register them, set up the actions."""
    frontend_dir = pathlib.Path(__file__).parent / "frontend"
    # Cached by the browser; the version in the URL makes it load a changed file.
    await hass.http.async_register_static_paths(
        [StaticPathConfig(FRONTEND_URL, str(frontend_dir), cache_headers=True)]
    )
    async_at_started(hass, _async_register_resources)
    async_setup_services(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: LgalConfigEntry) -> bool:
    """Connect to the device and set up its entities."""
    api = LgalApi(async_get_clientsession(hass), entry.data[CONF_HOST], entry.data[CONF_API_KEY])
    try:
        identity = await api.identify()
    except LgalAuthError as err:
        raise ConfigEntryAuthFailed(translation_domain=DOMAIN, translation_key="auth_failed") from err
    except LgalSetupRequired as err:
        raise ConfigEntryNotReady(translation_domain=DOMAIN, translation_key="setup_required") from err
    except LgalConnectionError as err:
        raise ConfigEntryNotReady(
            translation_domain=DOMAIN, translation_key="cannot_connect", translation_placeholders={"host": api.host}
        ) from err
    except LgalError as err:
        raise ConfigEntryNotReady(str(err)) from err
    if entry.unique_id and identity.mac != entry.unique_id:
        raise ConfigEntryError(
            translation_domain=DOMAIN, translation_key="wrong_device", translation_placeholders={"host": api.host}
        )
    dtype = device_type(identity.project)
    if dtype is None:
        raise ConfigEntryError(
            translation_domain=DOMAIN,
            translation_key="unsupported_device",
            translation_placeholders={"project": identity.project or "?"},
        )

    coordinator = dtype.coordinator(hass, entry, api, identity)
    await coordinator.async_config_entry_first_refresh()

    # The device itself first: the pumps are registered as its child devices.
    registry = dr.async_get(hass)
    controller = registry.async_get_or_create(config_entry_id=entry.entry_id, **controller_device_info(coordinator))
    coordinator.controller_device_id = controller.id
    for n in getattr(coordinator, "fitted", ()):
        child = registry.async_get_or_create_child(
            config_entry_id=entry.entry_id,
            identifiers={(DOMAIN, f"{identity.mac}_p{n}")},
            name=coordinator.pump_label(n) or coordinator.default_pump_name(n),
            parent_device_id=controller.id,
        )
        coordinator.pump_device_ids[n] = child.id
    _remove_stale_pumps(hass, entry, coordinator)

    entry.runtime_data = LgalRuntime(api=api, coordinator=coordinator, device_type=dtype)
    entry.async_on_unload(coordinator.async_start_live())
    if hasattr(coordinator, "async_shutdown_priming"):
        entry.async_on_unload(coordinator.async_shutdown_priming)
    entry.async_on_unload(coordinator.async_add_listener(_reload_on_refit(hass, entry, coordinator)))
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    async_fix_entity_ids(hass, entry, coordinator)
    return True


def _remove_stale_pumps(hass: HomeAssistant, entry: ConfigEntry, coordinator) -> None:
    """A pump taken out of the fitting loses its device (its settings stay on the device)."""
    registry = dr.async_get(hass)
    keep = set(coordinator.pump_device_ids.values())
    for child in dr.async_child_entries_for_config_entry(registry, entry.entry_id):
        if child.id not in keep:
            registry.async_remove_device(child.id)


def _reload_on_refit(hass: HomeAssistant, entry: ConfigEntry, coordinator):
    """Reload when the device reports another fitting (it changes only with a restart)."""

    @callback
    def _check() -> None:
        data = coordinator.data
        if data is None or not hasattr(coordinator, "fitted") or not data.pumps:
            return
        fitted = tuple(n for n, p in sorted(data.pumps.items()) if p.get("fitted"))
        if fitted and fitted != coordinator.fitted:
            _LOGGER.info("%s: fitted pumps changed %s -> %s, reloading", entry.title, coordinator.fitted, fitted)
            coordinator.fitted = fitted  # once
            hass.config_entries.async_schedule_reload(entry.entry_id)

    return _check


async def async_unload_entry(hass: HomeAssistant, entry: LgalConfigEntry) -> bool:
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def async_remove_config_entry_device(hass: HomeAssistant, entry: LgalConfigEntry, device: dr.DeviceEntry) -> bool:
    """Allow removing a pump device that is no longer fitted."""
    rt = getattr(entry, "runtime_data", None)
    if rt is None:
        return True
    return device.id not in set(rt.coordinator.pump_device_ids.values()) | {rt.coordinator.controller_device_id}


async def async_remove_entry(hass: HomeAssistant, entry: LgalConfigEntry) -> None:
    """Remove the dashboard resources together with the last device."""
    others = [e for e in hass.config_entries.async_entries(DOMAIN) if e.entry_id != entry.entry_id]
    if others:
        return
    resources = _lovelace_resources(hass)
    if resources is None:
        return
    for url in _card_urls():
        try:
            await async_remove_resources(resources, url)
        except Exception:  # noqa: BLE001
            _LOGGER.warning("Could not remove the dashboard resource %s", url, exc_info=True)
