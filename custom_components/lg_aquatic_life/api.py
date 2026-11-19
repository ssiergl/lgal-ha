# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""HTTP and WebSocket access to an LG Aquatic Life device (shared core of all devices).

Every LG Aquatic Life device runs the same core firmware (``lgal_core``): REST under
``/api/v1/...``, a WebSocket at ``/api/v1/ws`` for live values, sign-in with an API key in the
header ``X-API-Key``. Errors always come as ``{"error": {"code": ..., "message": ...}}``.
This module knows nothing about a specific device type and needs no Home Assistant import, so
it can be tested on its own.
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Any

import aiohttp

_LOGGER = logging.getLogger(__name__)

REQUEST_TIMEOUT = 15  # seconds; the device answers within milliseconds, a TLS-free LAN call


class LgalError(Exception):
    """Base of all errors of this module."""


class LgalConnectionError(LgalError):
    """The device cannot be reached."""


class LgalAuthError(LgalError):
    """The API key was refused (401) or the request needs more rights (403)."""

    def __init__(self, code: str = "unauthorized", message: str = "") -> None:
        super().__init__(message or code)
        self.code = code


class LgalApiError(LgalError):
    """The device answered with an error document."""

    def __init__(self, status: int, code: str, message: str, data: dict[str, Any] | None = None) -> None:
        super().__init__(f"{code}: {message}")
        self.status = status
        self.code = code
        self.message = message
        self.data = data or {}


class LgalSetupRequired(LgalApiError):
    """The initial setup of the device is not finished (409 ``setup_required``)."""


def fmt_num(value: float) -> str:
    """A decimal for a query parameter: no exponent, at most three decimals (µl resolution)."""
    text = f"{float(value):.3f}".rstrip("0").rstrip(".")
    return text or "0"


@dataclass
class DeviceIdentity:
    """What /api/v1/system/info says about the device."""

    mac: str  # lower case, without separators: the stable id of the device
    project: str  # firmware project, e.g. "lgal_doser": picks the device type
    model: str  # e.g. "LGAL Doser 5"
    board: str
    hostname: str
    name: str  # own device name, may be empty
    firmware: str
    setup_completed: bool
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def short_id(self) -> str:
        return self.mac[-4:]

    @property
    def title(self) -> str:
        return self.name or f"{self.model} {self.short_id}"


def identity_from_info(info: dict[str, Any]) -> DeviceIdentity:
    device = info.get("device") or {}
    firmware = info.get("firmware") or {}
    mac = str(device.get("mac") or "").replace(":", "").replace("-", "").lower()
    if not mac:
        raise LgalError("system info without a MAC address")
    return DeviceIdentity(
        mac=mac,
        project=str(firmware.get("project") or ""),
        model=str(device.get("model") or "LG Aquatic Life"),
        board=str(device.get("board") or ""),
        hostname=str(device.get("hostname") or ""),
        name=str(info.get("device_name") or ""),
        firmware=str(firmware.get("version") or ""),
        setup_completed=bool(device.get("setup_completed", True)),
        raw=info,
    )


class LgalApi:
    """REST client of one device."""

    def __init__(self, session: aiohttp.ClientSession, host: str, api_key: str) -> None:
        self._session = session
        self.host = host.strip().rstrip("/")
        if self.host.startswith(("http://", "https://")):
            self.host = self.host.split("://", 1)[1]
        self._api_key = api_key.strip()

    @property
    def base_url(self) -> str:
        return f"http://{self.host}"

    @property
    def headers(self) -> dict[str, str]:
        # No Origin header: the device accepts changes without Origin (apps, Home Assistant),
        # a browser Origin would have to match the device's host.
        return {"X-API-Key": self._api_key, "Accept": "application/json"}

    async def request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        body: Any = None,
        timeout: float = REQUEST_TIMEOUT,
    ) -> Any:
        """Send a request and return the decoded JSON answer."""
        query = None
        if params:
            query = {
                k: (fmt_num(v) if isinstance(v, float) else str(v).lower() if isinstance(v, bool) else str(v))
                for k, v in params.items()
                if v is not None
            }
        data = None
        headers = self.headers
        if body is not None:
            data = json.dumps(body)
            headers = {**headers, "Content-Type": "application/json"}
        try:
            async with self._session.request(
                method,
                f"{self.base_url}{path}",
                params=query,
                data=data,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=timeout),
            ) as resp:
                text = await resp.text()
                status = resp.status
        except (aiohttp.ClientError, asyncio.TimeoutError, OSError) as err:
            raise LgalConnectionError(f"{self.host}: {err or type(err).__name__}") from err

        payload: Any = None
        if text:
            try:
                payload = json.loads(text)
            except ValueError:
                payload = text
        if status < 400:
            return payload
        err_doc = payload.get("error") if isinstance(payload, dict) else None
        code = str((err_doc or {}).get("code") or f"http_{status}")
        message = str((err_doc or {}).get("message") or text[:200])
        if status == 401 or code in ("unauthorized", "forbidden_origin"):
            raise LgalAuthError(code, message)
        if status == 403 and code != "engineering_locked":
            raise LgalAuthError(code, message)
        if code == "setup_required":
            raise LgalSetupRequired(status, code, message, err_doc)
        raise LgalApiError(status, code, message, err_doc if isinstance(err_doc, dict) else None)

    async def get(self, path: str, **params: Any) -> Any:
        return await self.request("GET", path, params=params or None)

    async def post(self, path: str, body: Any = None, **params: Any) -> Any:
        return await self.request("POST", path, params=params or None, body=body)

    async def put(self, path: str, body: Any) -> Any:
        return await self.request("PUT", path, body=body)

    # -- shared core endpoints ----------------------------------------------------------

    async def system_info(self) -> dict[str, Any]:
        return await self.get("/api/v1/system/info")

    async def identify(self) -> DeviceIdentity:
        """Read the system info (needs a valid key) and return who the device is."""
        info = await self.system_info()
        if not isinstance(info, dict):
            raise LgalError("unexpected answer to /api/v1/system/info")
        return identity_from_info(info)

    async def ws_connect(self) -> aiohttp.ClientWebSocketResponse:
        """Open the live connection (status pushes, priming)."""
        try:
            return await self._session.ws_connect(
                f"{self.base_url}/api/v1/ws",
                headers=self.headers,
                timeout=aiohttp.ClientWSTimeout(ws_close=5),
                autoping=True,
                heartbeat=None,  # the device sends a status frame at least every 10 s
            )
        except aiohttp.WSServerHandshakeError as err:
            if err.status in (401, 403):
                raise LgalAuthError("unauthorized", str(err)) from err
            raise LgalConnectionError(f"{self.host}: WebSocket refused ({err.status})") from err
        except (aiohttp.ClientError, asyncio.TimeoutError, OSError) as err:
            raise LgalConnectionError(f"{self.host}: {err or type(err).__name__}") from err
