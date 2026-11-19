# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
"""Fixtures: Home Assistant (pytest-homeassistant-custom-component) and the device mock of the
firmware repository (``lgal_doser/tools/mock``, a sibling checkout or LGAL_DOSER_REPO)."""

from __future__ import annotations

import os
import pathlib
import socket
import subprocess
import sys
import time

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOSER_REPO = pathlib.Path(os.environ.get("LGAL_DOSER_REPO") or next(
    (p for p in (ROOT.parent / "lgal_doser", ROOT.parent / "lgal-doser") if p.exists()), ROOT.parent / "lgal_doser"
))


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _start_mock(env_extra: dict[str, str]):
    mock = DOSER_REPO / "tools" / "mock" / "webui_server.py"
    if not mock.exists():
        pytest.skip(f"device mock not found at {mock} (set LGAL_DOSER_REPO)")
    port = _free_port()
    env = {**os.environ, **env_extra}
    proc = subprocess.Popen(
        [sys.executable, str(mock), str(DOSER_REPO), str(port)],
        cwd=mock.parent, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                break
        except OSError:
            time.sleep(0.05)
    else:
        proc.kill()
        pytest.fail("device mock did not start")
    return proc, f"127.0.0.1:{port}"


@pytest.fixture
def mock_device(socket_enabled):
    """The firmware's device mock (signed in, five pumps) -> its host:port."""
    proc, host = _start_mock({})
    yield host
    proc.kill()
    proc.wait()


@pytest.fixture
def mock_device_strict(socket_enabled):
    """The mock that checks API keys like the firmware (no valid key known)."""
    proc, host = _start_mock({"MOCK_STRICT_AUTH": "1"})
    yield host
    proc.kill()
    proc.wait()
