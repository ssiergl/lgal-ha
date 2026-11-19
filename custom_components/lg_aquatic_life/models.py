# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""Registry of the supported LG Aquatic Life device types.

The device type is the firmware project in ``/api/v1/system/info`` (``firmware.project``).
To add a device: write its coordinator (see ``doser.py``), list its entities (see
``doser_entities.py``) and register both here.
"""

from __future__ import annotations

from dataclasses import dataclass

from .descriptions import ModelEntities
from .doser import PROJECT as DOSER_PROJECT, DoserCoordinator
from .doser_entities import DOSER_ENTITIES


@dataclass(frozen=True)
class DeviceType:
    project: str
    name: str
    coordinator: type
    entities: ModelEntities


DEVICE_TYPES: dict[str, DeviceType] = {
    DOSER_PROJECT: DeviceType(DOSER_PROJECT, "LGAL Doser", DoserCoordinator, DOSER_ENTITIES),
}


def device_type(project: str) -> DeviceType | None:
    return DEVICE_TYPES.get(project)
