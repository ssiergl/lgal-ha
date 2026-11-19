# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""Base entity and description types.

Every entity has a description with functions on the coordinator; ``pump=True`` descriptions
are created once per fitted pump and belong to that pump's child device, the others belong to
the device itself. The platform files are generic and only add what ``models.py`` lists for
the device type.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity import EntityDescription
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.util import slugify

from .const import DOMAIN, MANUFACTURER

_LOGGER = logging.getLogger(__name__)

ValueFn = Callable[[Any, int], Any]  # (coordinator, pump number or 0) -> value


@dataclass(frozen=True, kw_only=True)
class LgalDescription(EntityDescription):
    """Common fields of all descriptions."""

    pump: bool = False  # one entity per fitted pump
    exists_fn: Callable[[Any, int], bool] | None = None  # created only if this is true at setup
    available_fn: Callable[[Any, int], bool] | None = None
    attrs_fn: Callable[[Any, int], dict[str, Any] | None] | None = None


def controller_device_info(coordinator) -> DeviceInfo:
    ident = coordinator.identity
    info = coordinator.info() if coordinator.data else ident.raw
    device = info.get("device") or {}
    firmware = info.get("firmware") or {}
    return DeviceInfo(
        identifiers={(DOMAIN, ident.mac)},
        connections={(dr.CONNECTION_NETWORK_MAC, ":".join(ident.mac[i : i + 2] for i in range(0, 12, 2)))},
        name=ident.title,
        manufacturer=MANUFACTURER,
        model=device.get("model") or ident.model,
        model_id=device.get("board") or ident.board or None,
        hw_version=info.get("board_rev"),
        sw_version=firmware.get("version") or ident.firmware,
        serial_number=ident.mac.upper(),
        configuration_url=f"http://{coordinator.api.host}/",
    )


def pump_device_info(coordinator, n: int) -> dict[str, Any]:
    """A child device per pump (Home Assistant 2026.10+: a logical part of the doser)."""
    return {
        "identifiers": {(DOMAIN, f"{coordinator.identity.mac}_p{n}")},
        "name": coordinator.pump_label(n) or coordinator.default_pump_name(n),
        "parent_device_id": coordinator.controller_device_id,
    }


def fixed_entity_id(hass, coordinator, domain: str, pump: int, key: str) -> str:
    """The entity id of an entity: doser name, pump number and key, nothing that changes.

    Home Assistant would build it from the pump's name and the doser's area
    ("sensor.wohnzimmer_…", "sensor.…_kh_…"); the id then no longer fits once the pump is
    renamed or the doser moves. ``sensor.lgal_doser_5_7ba4_pump_2_container_level`` and
    ``binary_sensor.lgal_doser_5_7ba4_alarm`` stay right; the shown names still follow the
    pump ("KH Container level").
    """
    controller = dr.async_get(hass).async_get(coordinator.controller_device_id) if coordinator.controller_device_id else None
    doser = (controller.name_by_user or controller.name) if controller else None
    prefix = slugify(doser or coordinator.identity.title)
    return f"{domain}.{prefix}_pump_{pump}_{key}" if pump else f"{domain}.{prefix}_{key}"


ENTITY_ID_SCHEME = "entity_id_scheme"  # in entry.data: 2 once the ids were brought to fixed_entity_id


@callback
def async_fix_entity_ids(hass: HomeAssistant, entry, coordinator) -> None:
    """Rename the entities of an entry to their fixed ids, once per entry.

    Home Assistant gives a re-added entity the id it had before it was deleted (kept for 30
    days), which may be built from pump names and areas. Runs after the platforms are set up;
    an id changed by the user afterwards is left alone.
    """
    if entry.data.get(ENTITY_ID_SCHEME) == 2:
        return
    registry = er.async_get(hass)
    mac = coordinator.identity.mac
    for reg in er.async_entries_for_config_entry(registry, entry.entry_id):
        rest = reg.unique_id.removeprefix(f"{mac}_")
        if rest == reg.unique_id:
            continue
        pump, key = 0, rest
        if (m := re.fullmatch(r"p(\d+)_(.+)", rest)) is not None:
            pump, key = int(m[1]), m[2]
        target = fixed_entity_id(hass, coordinator, reg.domain, pump, key)
        if target == reg.entity_id:
            continue
        if registry.async_get(target) is not None or hass.states.get(target) is not None:
            _LOGGER.warning("Not renaming %s: %s is taken", reg.entity_id, target)
            continue
        registry.async_update_entity(reg.entity_id, new_entity_id=target)
    hass.config_entries.async_update_entry(entry, data={**entry.data, ENTITY_ID_SCHEME: 2})


class LgalEntity(CoordinatorEntity):
    """An entity of an LG Aquatic Life device or of one of its pumps."""

    _attr_has_entity_name = True
    entity_description: LgalDescription

    def __init__(self, coordinator, description: LgalDescription, pump: int = 0) -> None:
        super().__init__(coordinator)
        self.entity_description = description
        self.pump = pump
        mac = coordinator.identity.mac
        if pump:
            self._attr_unique_id = f"{mac}_p{pump}_{description.key}"
            self._attr_device_info = pump_device_info(coordinator, pump)
        else:
            self._attr_unique_id = f"{mac}_{description.key}"
            self._attr_device_info = controller_device_info(coordinator)

    def add_to_platform_start(self, hass, platform, parallel_updates) -> None:
        """Suggest the fixed entity id (see ``fixed_entity_id``) when the entity is registered."""
        super().add_to_platform_start(hass, platform, parallel_updates)
        if self.entity_id is None:
            self.entity_id = fixed_entity_id(hass, self.coordinator, platform.domain, self.pump, self.entity_description.key)

    @property
    def available(self) -> bool:
        if not super().available or self.coordinator.data is None:
            return False
        if self.pump and not self.coordinator.pump(self.pump):
            return False
        fn = self.entity_description.available_fn
        return fn(self.coordinator, self.pump) if fn else True

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        fn = self.entity_description.attrs_fn
        if fn is None or self.coordinator.data is None:
            return None
        return fn(self.coordinator, self.pump)


def build_entities(coordinator, descriptions, entity_cls) -> list:
    """One entity per description (per fitted pump for pump descriptions)."""
    entities = []
    for description in descriptions:
        targets = coordinator.fitted if description.pump else (0,)
        for n in targets:
            if description.exists_fn is not None and not description.exists_fn(coordinator, n):
                continue
            entities.append(entity_cls(coordinator, description, n))
    return entities


SetFn = Callable[[Any, int, Any], Awaitable[None]]  # (coordinator, pump, value)
PressFn = Callable[[Any, int], Awaitable[None]]
