# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""Local test bench: Home Assistant with this integration against the firmware's device mock.

    python3 tools/dev_ha.py            # starts the mock (port 8090) and HA (port 8123) in ./config
    open http://127.0.0.1:8123         # user "dev", password "dev-password" (test values only)

The first start onboards HA, adds the mock doser (API key not checked by the mock) and creates
the dashboard "LGAL" with all three cards. Ctrl+C stops both. Needs a Python with
homeassistant and home-assistant-frontend installed (run it with that interpreter) and the
lgal-doser checkout next to this repository (or LGAL_DOSER_REPO).
"""

from __future__ import annotations

import asyncio
import json
import os
import pathlib
import signal
import subprocess
import sys
import time

import aiohttp

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONFIG = ROOT / "config"
DOSER_REPO = pathlib.Path(os.environ.get("LGAL_DOSER_REPO") or next(
    (p for p in (ROOT.parent / "lgal_doser", ROOT.parent / "lgal-doser") if p.exists()), ROOT.parent / "lgal_doser"
))
HA = "http://127.0.0.1:8123"
MOCK_PORT = 8090
USER, PASSWORD = "dev", "dev-password"  # test account of the local bench only
CLIENT_ID = f"{HA}/"

CONFIGURATION = """\
homeassistant:
  name: LGAL dev
  time_zone: Europe/Berlin
  country: DE
  unit_system: metric
  internal_url: http://127.0.0.1:8123
frontend:
config:
logger:
  default: warning
  logs:
    custom_components.lg_aquatic_life: debug
"""

DASHBOARD = {
    "title": "LGAL",
    "views": [
        {
            "title": "Doser",
            "path": "doser",
            "type": "sections",
            "max_columns": 3,
            "sections": [
                {"type": "grid", "column_span": 3, "cards": [{"type": "custom:lgal-doser-card", "title": "LGAL Doser"}]},
                {"type": "grid", "cards": [{"type": "custom:lgal-doser-schedule-card", "pump": 1}]},
                {"type": "grid", "cards": [{"type": "custom:lgal-doser-schedule-card", "pump": 5}]},
                {"type": "grid", "cards": [{"type": "custom:lgal-doser-history-card", "days": 14}]},
            ],
        }
    ],
}


def prepare() -> None:
    CONFIG.mkdir(exist_ok=True)
    (CONFIG / "configuration.yaml").exists() or (CONFIG / "configuration.yaml").write_text(CONFIGURATION)
    link = CONFIG / "custom_components"
    link.mkdir(exist_ok=True)
    target = link / "lg_aquatic_life"
    if not target.exists():
        target.symlink_to(ROOT / "custom_components" / "lg_aquatic_life")


def wait_port(url: str, timeout: float = 120) -> None:
    import urllib.request

    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            urllib.request.urlopen(url, timeout=2)  # noqa: S310 - local
            return
        except Exception:  # noqa: BLE001
            time.sleep(0.5)
    raise SystemExit(f"{url} did not come up")


async def onboard() -> None:
    async with aiohttp.ClientSession() as s:
        async with s.get(f"{HA}/api/onboarding") as r:
            if r.status == 404:  # onboarding finished: Home Assistant no longer serves the view
                print("already onboarded")
                return
            steps = {x["step"]: x["done"] for x in await r.json()}
        if steps.get("user"):
            print("already onboarded")
            return
        async with s.post(f"{HA}/api/onboarding/users", json={
            "client_id": CLIENT_ID, "name": "Dev", "username": USER, "password": PASSWORD, "language": "de",
        }) as r:
            code = (await r.json())["auth_code"]
        async with s.post(f"{HA}/auth/token", data={"grant_type": "authorization_code", "code": code, "client_id": CLIENT_ID}) as r:
            token = (await r.json())["access_token"]
        h = {"Authorization": f"Bearer {token}"}
        await s.post(f"{HA}/api/onboarding/core_config", headers=h)
        await s.post(f"{HA}/api/onboarding/analytics", headers=h)
        await s.post(f"{HA}/api/onboarding/integration", headers=h, json={"client_id": CLIENT_ID, "redirect_uri": f"{HA}/?auth_callback=1"})

        async with s.post(f"{HA}/api/config/config_entries/flow", headers=h, json={"handler": "lg_aquatic_life"}) as r:
            flow = await r.json()
        async with s.post(f"{HA}/api/config/config_entries/flow/{flow['flow_id']}", headers=h,
                          json={"host": f"127.0.0.1:{MOCK_PORT}", "api_key": "lgal_dev"}) as r:
            print("config flow:", (await r.json()).get("type"))

        async with s.ws_connect(f"{HA}/api/websocket") as ws:
            await ws.receive_json()
            await ws.send_json({"type": "auth", "access_token": token})
            await ws.receive_json()
            await ws.send_json({"id": 1, "type": "lovelace/dashboards/create", "url_path": "lgal-dev", "title": "LGAL",
                                "icon": "mdi:water-pump", "show_in_sidebar": True, "require_admin": False, "mode": "storage"})
            print("dashboard:", (await ws.receive_json()).get("success"))
            await ws.send_json({"id": 2, "type": "lovelace/config/save", "url_path": "lgal-dev", "config": DASHBOARD})
            print("cards:", (await ws.receive_json()).get("success"))


def main() -> None:
    prepare()
    mock = subprocess.Popen([sys.executable, str(DOSER_REPO / "tools/mock/webui_server.py"), str(DOSER_REPO), str(MOCK_PORT)],
                            cwd=DOSER_REPO / "tools/mock")
    ha = subprocess.Popen([sys.executable, "-m", "homeassistant", "-c", str(CONFIG)])
    try:
        wait_port(f"{HA}/manifest.json")
        asyncio.run(onboard())
        print(f"ready: {HA}/lgal-dev  (user {USER})")
        ha.wait()
    except KeyboardInterrupt:
        pass
    finally:
        for p in (ha, mock):
            p.send_signal(signal.SIGINT)
        for p in (ha, mock):
            try:
                p.wait(20)
            except subprocess.TimeoutExpired:
                p.kill()


if __name__ == "__main__":
    main()
