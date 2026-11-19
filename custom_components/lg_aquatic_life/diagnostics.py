# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""Diagnostics: what the integration last read from the device (API key removed)."""

from __future__ import annotations

import dataclasses
from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.core import HomeAssistant

from .const import CONF_API_KEY

TO_REDACT = {CONF_API_KEY, "mac", "serial_number", "ssid"}


async def async_get_config_entry_diagnostics(hass: HomeAssistant, entry) -> dict[str, Any]:
    rt = entry.runtime_data
    coordinator = rt.coordinator
    data = dataclasses.asdict(coordinator.data) if dataclasses.is_dataclass(coordinator.data) else coordinator.data
    return {
        "entry": async_redact_data(dict(entry.data), TO_REDACT),
        "device_type": rt.device_type.project,
        "fitted": list(getattr(coordinator, "fitted", ())),
        "live_connection": coordinator.ws_connected,
        "data": async_redact_data(data, TO_REDACT),
    }
