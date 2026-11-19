# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""Config flow: add a device by address and API key, or found by mDNS."""

from __future__ import annotations

import ipaddress
import logging
from collections.abc import Mapping
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.const import CONF_HOST
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.service_info.zeroconf import ZeroconfServiceInfo

from .api import DeviceIdentity, LgalApi, LgalAuthError, LgalConnectionError, LgalError, LgalSetupRequired
from .const import CONF_API_KEY, DOMAIN, VENDOR
from .models import device_type

_LOGGER = logging.getLogger(__name__)


def _is_ip(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
    except ValueError:
        return False
    return True


class LgalConfigFlow(ConfigFlow, domain=DOMAIN):
    """Add and reconfigure LG Aquatic Life devices."""

    VERSION = 1

    def __init__(self) -> None:
        self._host: str | None = None
        self._name: str | None = None

    async def _probe(self, host: str, api_key: str, errors: dict[str, str]) -> DeviceIdentity | None:
        api = LgalApi(async_get_clientsession(self.hass), host, api_key)
        try:
            identity = await api.identify()
        except LgalAuthError:
            errors[CONF_API_KEY] = "invalid_auth"
        except LgalSetupRequired:
            errors["base"] = "setup_required"
        except LgalConnectionError:
            errors["base"] = "cannot_connect"
        except LgalError:
            errors["base"] = "not_lgal"
        except Exception:  # noqa: BLE001
            _LOGGER.exception("Unexpected error while probing %s", host)
            errors["base"] = "unknown"
        else:
            if (identity.raw.get("device") or {}).get("vendor") not in (None, VENDOR):
                errors["base"] = "not_lgal"
            elif device_type(identity.project) is None:
                errors["base"] = "unsupported_device"
            elif not identity.setup_completed:
                errors["base"] = "setup_required"
            else:
                return identity
        return None

    def _schema(self, defaults: Mapping[str, Any], with_host: bool = True) -> vol.Schema:
        fields: dict[Any, Any] = {}
        if with_host:
            fields[vol.Required(CONF_HOST, default=defaults.get(CONF_HOST, ""))] = str
        fields[vol.Required(CONF_API_KEY)] = str
        return vol.Schema(fields)

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            host = user_input[CONF_HOST].strip()
            if identity := await self._probe(host, user_input[CONF_API_KEY], errors):
                await self.async_set_unique_id(identity.mac)
                self._abort_if_unique_id_configured(updates={CONF_HOST: host, CONF_API_KEY: user_input[CONF_API_KEY].strip()})
                return self.async_create_entry(
                    title=identity.title,
                    data={CONF_HOST: host, CONF_API_KEY: user_input[CONF_API_KEY].strip()},
                    description_placeholders={"name": identity.title},
                )
        return self.async_show_form(
            step_id="user", data_schema=self._schema(user_input or {}), errors=errors
        )

    async def async_step_zeroconf(self, discovery_info: ZeroconfServiceInfo) -> ConfigFlowResult:
        props = discovery_info.properties
        if str(props.get("vendor", "")).lower() != VENDOR.lower():
            return self.async_abort(reason="not_lgal")
        host = discovery_info.host
        short_id = str(props.get("id") or "").lower()
        hostname = discovery_info.hostname.rstrip(".").removesuffix(".local")
        # The MAC is the unique id; mDNS only has the last four hex digits. Known devices are
        # recognised by their address (hostname or IP) and get a changed IP address.
        for entry in self._async_current_entries(include_ignore=False):
            known = entry.data.get(CONF_HOST, "")
            same_id = bool(short_id and entry.unique_id and entry.unique_id.endswith(short_id))
            if known in (host, hostname, f"{hostname}.local") or same_id:
                if same_id and _is_ip(known) and known != host:
                    # added by IP address and the address changed (DHCP)
                    self.hass.config_entries.async_update_entry(entry, data={**entry.data, CONF_HOST: host})
                    self.hass.config_entries.async_schedule_reload(entry.entry_id)
                return self.async_abort(reason="already_configured")
        self._host = f"{hostname}.local" if hostname else host
        self._name = discovery_info.name.split(".")[0] or hostname
        await self.async_set_unique_id(f"mdns_{short_id or hostname}")
        self._abort_if_unique_id_configured()
        self.context["title_placeholders"] = {"name": self._name}
        return await self.async_step_zeroconf_confirm()

    async def async_step_zeroconf_confirm(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        assert self._host is not None
        if user_input is not None:
            if identity := await self._probe(self._host, user_input[CONF_API_KEY], errors):
                await self.async_set_unique_id(identity.mac, raise_on_progress=False)
                self._abort_if_unique_id_configured(updates={CONF_HOST: self._host})
                return self.async_create_entry(
                    title=identity.title,
                    data={CONF_HOST: self._host, CONF_API_KEY: user_input[CONF_API_KEY].strip()},
                    description_placeholders={"name": identity.title},
                )
        return self.async_show_form(
            step_id="zeroconf_confirm",
            data_schema=self._schema({}, with_host=False),
            errors=errors,
            description_placeholders={"name": self._name or self._host, "host": self._host, "url": f"http://{self._host}/"},
        )

    async def async_step_reauth(self, entry_data: Mapping[str, Any]) -> ConfigFlowResult:
        return await self.async_step_reauth_confirm()

    async def async_step_reauth_confirm(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        entry = self._get_reauth_entry()
        errors: dict[str, str] = {}
        if user_input is not None:
            if identity := await self._probe(entry.data[CONF_HOST], user_input[CONF_API_KEY], errors):
                await self.async_set_unique_id(identity.mac)
                self._abort_if_unique_id_mismatch(reason="wrong_device")
                return self.async_update_reload_and_abort(entry, data_updates={CONF_API_KEY: user_input[CONF_API_KEY].strip()})
        return self.async_show_form(
            step_id="reauth_confirm",
            data_schema=self._schema({}, with_host=False),
            errors=errors,
            description_placeholders={"host": entry.data[CONF_HOST], "url": f"http://{entry.data[CONF_HOST]}/"},
        )

    async def async_step_reconfigure(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        entry = self._get_reconfigure_entry()
        errors: dict[str, str] = {}
        if user_input is not None:
            host = user_input[CONF_HOST].strip()
            if identity := await self._probe(host, user_input[CONF_API_KEY], errors):
                await self.async_set_unique_id(identity.mac)
                self._abort_if_unique_id_mismatch(reason="wrong_device")
                return self.async_update_reload_and_abort(
                    entry, data_updates={CONF_HOST: host, CONF_API_KEY: user_input[CONF_API_KEY].strip()}
                )
        return self.async_show_form(
            step_id="reconfigure",
            data_schema=self._schema(user_input or {CONF_HOST: entry.data[CONF_HOST]}),
            errors=errors,
        )
