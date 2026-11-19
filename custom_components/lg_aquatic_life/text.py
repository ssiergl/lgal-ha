# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""Texts (the pump names)."""

from __future__ import annotations

from homeassistant.components.text import TextEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .entity import LgalEntity, build_entities


class LgalText(LgalEntity, TextEntity):
    @property
    def native_value(self) -> str | None:
        return self.entity_description.value_fn(self.coordinator, self.pump)

    async def async_set_value(self, value: str) -> None:
        await self.entity_description.set_fn(self.coordinator, self.pump, value)


async def async_setup_entry(hass: HomeAssistant, entry, async_add_entities: AddConfigEntryEntitiesCallback) -> None:
    rt = entry.runtime_data
    async_add_entities(build_entities(rt.coordinator, rt.device_type.entities.texts, LgalText))
