# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""Selects."""

from __future__ import annotations

from homeassistant.components.select import SelectEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .entity import LgalEntity, build_entities


class LgalSelect(LgalEntity, SelectEntity):
    @property
    def current_option(self) -> str | None:
        value = self.entity_description.value_fn(self.coordinator, self.pump)
        return value if value in self.options else None

    async def async_select_option(self, option: str) -> None:
        await self.entity_description.set_fn(self.coordinator, self.pump, option)


async def async_setup_entry(hass: HomeAssistant, entry, async_add_entities: AddConfigEntryEntitiesCallback) -> None:
    rt = entry.runtime_data
    async_add_entities(build_entities(rt.coordinator, rt.device_type.entities.selects, LgalSelect))
