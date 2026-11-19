# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""Keep the dashboard card registered as a Lovelace resource.

Scripts added with ``add_extra_js_url`` live in Home Assistant's start page, which
browsers (and their service workers) may keep from before the integration was
installed, so the card is then "not found" until the browser cache is reset.
Dashboard resources are loaded from Home Assistant every time a dashboard opens, so
the integration also registers its cards as resources.

The functions take the Lovelace resource collection as an argument and use only its
storage-mode interface, so they can be tested without Home Assistant. In YAML mode
the collection cannot be changed; nothing is done then and the user adds the
resource in ``configuration.yaml`` (see the README).
"""

from __future__ import annotations

import logging
from typing import Any

_LOGGER = logging.getLogger(__name__)

_WRITE_METHODS = ("async_items", "async_create_item", "async_update_item", "async_delete_item")


def _path(url: str) -> str:
    """The URL without its ``?v=...`` query."""
    return url.split("?", 1)[0]


def can_manage(resources: Any) -> bool:
    """True for the storage-mode collection, False for YAML mode."""
    return all(hasattr(resources, name) for name in _WRITE_METHODS)


async def _ensure_loaded(resources: Any) -> None:
    if not getattr(resources, "loaded", True):
        await resources.async_load()
        resources.loaded = True


def _ours(resources: Any, url: str) -> list[dict[str, Any]]:
    return [item for item in resources.async_items() if _path(item.get("url", "")) == _path(url)]


async def async_ensure_resource(resources: Any, url: str) -> str:
    """Make sure a module resource for ``url`` exists.

    Returns ``created``, ``updated`` (an entry for the same file had another version),
    ``unchanged`` or ``unsupported``. Other resources are never touched.
    """
    if not can_manage(resources):
        _LOGGER.debug("Dashboard resources are managed in YAML; not registering the card")
        return "unsupported"
    await _ensure_loaded(resources)
    existing = _ours(resources, url)
    if not existing:
        await resources.async_create_item({"res_type": "module", "url": url})
        _LOGGER.info("Registered %s as a dashboard resource", url)
        return "created"
    if any(item["url"] == url for item in existing):
        return "unchanged"
    await resources.async_update_item(existing[0]["id"], {"res_type": "module", "url": url})
    _LOGGER.info("Updated the dashboard resource to %s", url)
    return "updated"


async def async_remove_resources(resources: Any, url: str) -> int:
    """Delete the resources that point at this card file. Returns how many."""
    if not can_manage(resources):
        return 0
    await _ensure_loaded(resources)
    items = _ours(resources, url)
    for item in items:
        await resources.async_delete_item(item["id"])
    if items:
        _LOGGER.info("Removed %s dashboard resource(s) for %s", len(items), _path(url))
    return len(items)
