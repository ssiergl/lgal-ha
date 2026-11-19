# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""Description types of all platforms (shared by every device type)."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from homeassistant.components.binary_sensor import BinarySensorEntityDescription
from homeassistant.components.button import ButtonEntityDescription
from homeassistant.components.event import EventEntityDescription
from homeassistant.components.number import NumberEntityDescription
from homeassistant.components.select import SelectEntityDescription
from homeassistant.components.sensor import SensorEntityDescription
from homeassistant.components.switch import SwitchEntityDescription
from homeassistant.components.text import TextEntityDescription
from homeassistant.components.time import TimeEntityDescription
from homeassistant.components.update import UpdateEntityDescription

from .entity import LgalDescription, PressFn, SetFn, ValueFn


@dataclass(frozen=True, kw_only=True)
class LgalSensorDescription(LgalDescription, SensorEntityDescription):
    value_fn: ValueFn
    unrecorded: frozenset[str] = frozenset()  # attributes kept out of the recorder


@dataclass(frozen=True, kw_only=True)
class LgalBinarySensorDescription(LgalDescription, BinarySensorEntityDescription):
    value_fn: ValueFn


@dataclass(frozen=True, kw_only=True)
class LgalNumberDescription(LgalDescription, NumberEntityDescription):
    value_fn: ValueFn
    set_fn: SetFn
    max_fn: ValueFn | None = None


@dataclass(frozen=True, kw_only=True)
class LgalLocalNumberDescription(LgalDescription, NumberEntityDescription):
    """A value kept in Home Assistant (e.g. the amount of the "Dose" button)."""

    initial: float = 1.0


@dataclass(frozen=True, kw_only=True)
class LgalSelectDescription(LgalDescription, SelectEntityDescription):
    value_fn: ValueFn
    set_fn: SetFn


@dataclass(frozen=True, kw_only=True)
class LgalSwitchDescription(LgalDescription, SwitchEntityDescription):
    value_fn: ValueFn
    set_fn: SetFn


@dataclass(frozen=True, kw_only=True)
class LgalButtonDescription(LgalDescription, ButtonEntityDescription):
    press_fn: PressFn


@dataclass(frozen=True, kw_only=True)
class LgalTextDescription(LgalDescription, TextEntityDescription):
    value_fn: ValueFn
    set_fn: SetFn


@dataclass(frozen=True, kw_only=True)
class LgalTimeDescription(LgalDescription, TimeEntityDescription):
    value_fn: ValueFn
    set_fn: SetFn


@dataclass(frozen=True, kw_only=True)
class LgalEventDescription(LgalDescription, EventEntityDescription):
    # history event -> event type, or None when the event is not for this entity
    match_fn: Callable[[dict[str, Any], int], str | None]


@dataclass(frozen=True, kw_only=True)
class LgalUpdateDescription(LgalDescription, UpdateEntityDescription):
    pass


@dataclass(frozen=True)
class ModelEntities:
    """Everything a device type creates."""

    sensors: tuple[LgalSensorDescription, ...] = ()
    binary_sensors: tuple[LgalBinarySensorDescription, ...] = ()
    numbers: tuple[LgalNumberDescription, ...] = ()
    local_numbers: tuple[LgalLocalNumberDescription, ...] = ()
    selects: tuple[LgalSelectDescription, ...] = ()
    switches: tuple[LgalSwitchDescription, ...] = ()
    buttons: tuple[LgalButtonDescription, ...] = ()
    texts: tuple[LgalTextDescription, ...] = ()
    times: tuple[LgalTimeDescription, ...] = ()
    events: tuple[LgalEventDescription, ...] = ()
    updates: tuple[LgalUpdateDescription, ...] = ()
    extra: dict[str, Any] = field(default_factory=dict)
