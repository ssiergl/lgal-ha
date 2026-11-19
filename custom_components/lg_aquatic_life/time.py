# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""Times (night mode window of the status LED)."""

from __future__ import annotations

from datetime import time as dt_time

from homeassistant.components.time import TimeEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .entity import LgalEntity, build_entities


class LgalTime(LgalEntity, TimeEntity):
    @property
    def native_value(self) -> dt_time | None:
        return self.entity_description.value_fn(self.coordinator, self.pump)

    async def async_set_value(self, value: dt_time) -> None:
        await self.entity_description.set_fn(self.coordinator, self.pump, value)


async def async_setup_entry(hass: HomeAssistant, entry, async_add_entities: AddConfigEntryEntitiesCallback) -> None:
    rt = entry.runtime_data
    async_add_entities(build_entities(rt.coordinator, rt.device_type.entities.times, LgalTime))
