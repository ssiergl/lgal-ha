# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""Numbers: settings on the device, and the dose amount kept in Home Assistant."""

from __future__ import annotations

from homeassistant.components.number import NumberEntity, RestoreNumber
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .entity import LgalEntity, build_entities


class LgalNumber(LgalEntity, NumberEntity):
    @property
    def native_value(self) -> float | None:
        return self.entity_description.value_fn(self.coordinator, self.pump)

    @property
    def native_max_value(self) -> float:
        fn = self.entity_description.max_fn
        if fn is not None and self.coordinator.data is not None:
            return float(fn(self.coordinator, self.pump))
        return super().native_max_value

    async def async_set_native_value(self, value: float) -> None:
        await self.entity_description.set_fn(self.coordinator, self.pump, value)


class LgalLocalNumber(LgalEntity, RestoreNumber):
    """The amount the "Dose" button doses (kept in Home Assistant, like the MQTT amount)."""

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        value = self.entity_description.initial
        if (last := await self.async_get_last_number_data()) is not None and last.native_value is not None:
            value = last.native_value
        self.coordinator.dose_amounts[self.pump] = value

    @property
    def native_value(self) -> float | None:
        return self.coordinator.dose_amounts.get(self.pump, self.entity_description.initial)

    async def async_set_native_value(self, value: float) -> None:
        self.coordinator.dose_amounts[self.pump] = value
        self.async_write_ha_state()


async def async_setup_entry(hass: HomeAssistant, entry, async_add_entities: AddConfigEntryEntitiesCallback) -> None:
    rt = entry.runtime_data
    async_add_entities(build_entities(rt.coordinator, rt.device_type.entities.numbers, LgalNumber))
    async_add_entities(build_entities(rt.coordinator, rt.device_type.entities.local_numbers, LgalLocalNumber))
