# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""Event entities: the history of the device as it happens (doses, skipped doses, alarms, ...)."""

from __future__ import annotations

from typing import Any

from homeassistant.components.event import EventEntity
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .entity import LgalEntity, build_entities


class LgalEvent(LgalEntity, EventEntity):
    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        listeners = self.coordinator.event_listeners
        listeners.append(self._on_event)
        self.async_on_remove(lambda: listeners.remove(self._on_event))

    @callback
    def _on_event(self, event: dict[str, Any]) -> None:
        event_type = self.entity_description.match_fn(event, self.pump)
        if event_type is None or event_type not in self.event_types:
            return
        attrs = {k: v for k, v in event.items() if k not in ("kind",)}
        self._trigger_event(event_type, attrs)
        self.async_write_ha_state()

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        return None


async def async_setup_entry(hass: HomeAssistant, entry, async_add_entities: AddConfigEntryEntitiesCallback) -> None:
    rt = entry.runtime_data
    async_add_entities(build_entities(rt.coordinator, rt.device_type.entities.events, LgalEvent))
