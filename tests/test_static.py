# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""Consistency of translations, icons, actions and the files the integration ships."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest
import yaml

from custom_components.lg_aquatic_life.const import CARD_FILES, VERSION
from custom_components.lg_aquatic_life.coordinator import ERROR_KEYS
from custom_components.lg_aquatic_life.models import DEVICE_TYPES
from custom_components.lg_aquatic_life.services import SCHEMAS

BASE = Path(__file__).parent.parent / "custom_components" / "lg_aquatic_life"


def _json(name: str) -> dict:
    return json.loads((BASE / name).read_text(encoding="utf-8"))


def _keys(tree: dict, prefix: str = "") -> set[str]:
    out = set()
    for key, value in tree.items():
        path = f"{prefix}.{key}" if prefix else key
        out |= _keys(value, path) if isinstance(value, dict) else {path}
    return out


def _services_yaml() -> dict:
    class Loader(yaml.SafeLoader):
        pass

    return yaml.load((BASE / "services.yaml").read_text(encoding="utf-8"), Loader=Loader)  # noqa: S506


def _descriptions():
    for device_type in DEVICE_TYPES.values():
        ents = device_type.entities
        for platform in ("sensors", "binary_sensors", "numbers", "local_numbers", "selects", "switches",
                         "buttons", "texts", "times", "events", "updates"):
            for desc in getattr(ents, platform):
                yield desc.__class__.__name__, platform, desc


PLATFORM = {
    "sensors": "sensor", "binary_sensors": "binary_sensor", "numbers": "number", "local_numbers": "number",
    "selects": "select", "switches": "switch", "buttons": "button", "texts": "text", "times": "time",
    "events": "event", "updates": "update",
}


def test_translations_have_the_same_keys() -> None:
    en = _json("translations/en.json")
    de = _json("translations/de.json")
    assert _keys(en) == _keys(de)


def test_translations_are_generated_and_current(tmp_path: Path) -> None:
    script = BASE.parent.parent / "tools" / "gen_translations.py"
    subprocess.run(["python3", str(script), str(tmp_path)], check=True)
    for lang in ("en", "de"):
        assert (tmp_path / f"{lang}.json").read_text("utf-8") == (BASE / "translations" / f"{lang}.json").read_text("utf-8"), (
            f"translations/{lang}.json is out of date: run tools/gen_translations.py"
        )


def test_every_entity_has_a_translation_and_states() -> None:
    en = _json("translations/en.json")["entity"]
    for _cls, platform, desc in _descriptions():
        domain = PLATFORM[platform]
        assert desc.translation_key in en.get(domain, {}), f"{domain}.{desc.translation_key} missing in en.json"
        options = getattr(desc, "options", None)
        if options:
            states = en[domain][desc.translation_key].get("state", {})
            assert set(options) <= set(states), f"{domain}.{desc.translation_key}: states {set(options) - set(states)}"


def test_unique_keys_per_platform() -> None:
    seen = set()
    for _cls, platform, desc in _descriptions():
        key = (PLATFORM[platform], desc.key, bool(desc.pump))
        assert key not in seen, key
        seen.add(key)


def test_every_entity_has_an_icon_or_a_device_class() -> None:
    icons = _json("icons.json")["entity"]
    for _cls, platform, desc in _descriptions():
        domain = PLATFORM[platform]
        if domain == "update" or getattr(desc, "device_class", None):
            continue
        assert desc.translation_key in icons.get(domain, {}), f"no icon for {domain}.{desc.translation_key}"


def test_actions_yaml_translations_icons_schemas_agree() -> None:
    services = _services_yaml()
    en = _json("translations/en.json")["services"]
    icons = _json("icons.json")["services"]
    assert set(services) == set(SCHEMAS) == set(en) == set(icons)
    for name, spec in services.items():
        fields = set((spec or {}).get("fields", {}))
        schema_fields = {str(k) for k in SCHEMAS[name].schema}
        assert fields == schema_fields, f"{name}: yaml {fields ^ schema_fields}"
        assert fields == set(en[name].get("fields", {})), f"{name}: translation fields"


def test_error_codes_are_translated() -> None:
    exceptions = _json("translations/en.json")["exceptions"]
    for code in ERROR_KEYS | {"device_error"}:
        assert f"err_{code}" in exceptions, code
    placeholders = re.compile(r"\{(\w+)\}")
    for key, value in exceptions.items():
        names = set(placeholders.findall(value["message"]))
        if key.startswith("err_"):
            assert names <= {"code", "message", "retry", "conflicts"}, key


def test_manifest_and_version() -> None:
    manifest = _json("manifest.json")
    assert manifest["domain"] == "lg_aquatic_life"
    assert manifest["version"] == VERSION
    assert manifest["config_flow"] is True
    assert manifest["iot_class"] == "local_push"
    hacs = json.loads((BASE.parent.parent / "hacs.json").read_text("utf-8"))
    assert hacs["name"] == manifest["name"]


def test_card_files_exist_and_carry_the_version() -> None:
    for card in CARD_FILES:
        text = (BASE / "frontend" / card).read_text("utf-8")
        assert f'const VERSION = "{VERSION}"' in text
        for tag in (
            "lgal-doser-card", "lgal-doser-manual-card", "lgal-doser-schedule-card", "lgal-doser-boost-card",
            "lgal-doser-calibration-card", "lgal-doser-pump-settings-card", "lgal-doser-device-card",
            "lgal-doser-history-card",
        ):
            assert f'"{tag}"' in text, tag
    readme = (BASE.parent.parent / "README.md").read_text("utf-8")
    assert f"lgal-cards.js?v={VERSION}" in readme, "README: YAML resource with an old version"


@pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")
def test_card_javascript_parses() -> None:
    for card in CARD_FILES:
        subprocess.run(["node", "--check", str(BASE / "frontend" / card)], check=True)


def test_brand_images() -> None:
    for name in ("icon.png", "icon@2x.png", "logo.png", "logo@2x.png"):
        data = (BASE / "brand" / name).read_bytes()
        assert data.startswith(b"\x89PNG"), name
