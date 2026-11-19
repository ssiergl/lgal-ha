# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""Constants of the LG Aquatic Life integration."""

from __future__ import annotations

DOMAIN = "lg_aquatic_life"
VERSION = "0.1.0"  # keep in sync with manifest.json (cache buster of the cards)

MANUFACTURER = "LG Aquatic Life"
VENDOR = "LG Aquatic Life"  # "vendor" in /api/v1/system/info and in the mDNS TXT record

CONF_API_KEY = "api_key"

# The cards are served by the integration itself.
FRONTEND_URL = "/lg_aquatic_life_static"
# One file with all cards of the integration (lgal-doser-card, -schedule-card, -history-card).
CARD_FILES = ("lgal-cards.js",)

# Event fired on the bus for every history entry of a device.
EVENT_DEVICE = f"{DOMAIN}_event"

MAX_PUMPS = 5  # doser::kMaxPumps: records, API and UI are sized for five pumps on every board

# Polling. The WebSocket pushes the live values; REST fills in the rest.
SCAN_INTERVAL_S = 30  # pumps, schedule status, history
SCAN_INTERVAL_NO_WS_S = 10  # while the live connection is down
SLOW_INTERVAL_S = 300  # schedules, system info, update state, LED
