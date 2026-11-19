# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""Sensors."""

from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .entity import LgalEntity, build_entities


class LgalSensor(LgalEntity, SensorEntity):
    def __init__(self, coordinator, description, pump: int = 0) -> None:
        super().__init__(coordinator, description, pump)
        if description.unrecorded:
            self._unrecorded_attributes = frozenset(description.unrecorded)

    @property
    def native_value(self):
        return self.entity_description.value_fn(self.coordinator, self.pump)


async def async_setup_entry(hass: HomeAssistant, entry, async_add_entities: AddConfigEntryEntitiesCallback) -> None:
    rt = entry.runtime_data
    async_add_entities(build_entities(rt.coordinator, rt.device_type.entities.sensors, LgalSensor))
