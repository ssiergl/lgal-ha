# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""Firmware update from the device's update source (the GitHub releases of the firmware)."""

from __future__ import annotations

from typing import Any

from homeassistant.components.update import UpdateDeviceClass, UpdateEntity, UpdateEntityFeature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .entity import LgalEntity, build_entities


class LgalUpdate(LgalEntity, UpdateEntity):
    _attr_device_class = UpdateDeviceClass.FIRMWARE
    _attr_supported_features = UpdateEntityFeature.INSTALL | UpdateEntityFeature.PROGRESS

    @property
    def _release(self) -> dict[str, Any]:
        return self.coordinator.data.release or {}

    @property
    def _ota(self) -> dict[str, Any]:
        return self.coordinator.data.ota or {}

    @property
    def installed_version(self) -> str | None:
        return self._release.get("current") or (self.coordinator.info().get("firmware") or {}).get("version")

    @property
    def latest_version(self) -> str | None:
        rel = self._release
        if rel.get("available") and rel.get("latest"):
            return rel["latest"]
        return self.installed_version

    @property
    def release_url(self) -> str | None:
        return self._release.get("notes")

    @property
    def in_progress(self) -> bool:
        return self._ota.get("state") in ("running", "rebooting")

    @property
    def update_percentage(self) -> int | None:
        ota = self._ota
        if not self.in_progress or not ota.get("total"):
            return None
        return max(0, min(100, int(100 * (ota.get("received") or 0) / ota["total"])))

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        rel = self._release
        return {"channel": rel.get("channel"), "checked_at": rel.get("checked_at"), "error": rel.get("error")}

    async def async_install(self, version: str | None, backup: bool, **kwargs: Any) -> None:
        await self.coordinator.async_install_update()


async def async_setup_entry(hass: HomeAssistant, entry, async_add_entities: AddConfigEntryEntitiesCallback) -> None:
    rt = entry.runtime_data
    async_add_entities(build_entities(rt.coordinator, rt.device_type.entities.updates, LgalUpdate))
