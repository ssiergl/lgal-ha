<p align="center"><a href="https://github.com/ssiergl/lgal-brand"><img src="https://raw.githubusercontent.com/ssiergl/lgal-brand/main/logo/lgal-plaque.svg" width="200" alt="LG Aquatic Life"></a></p>

# LG Aquatic Life for Home Assistant

**Deutsch:** eine Kurzfassung auf Deutsch steht in [README.de.md](README.de.md); diese englische Fassung ist die vollständige Doku.

Custom integration for the devices of **LG Aquatic Life**. It talks to each device directly on your local
network over its REST API and a live WebSocket: no cloud, no MQTT broker, no extra containers. Devices
on the network are found by themselves (mDNS); you only paste an API key.

The first device type is the **LGAL Doser** (1 to 5 pump heads, firmware `lgal_doser`). The integration
is built for more device types: each one is a small module (see [Adding a device type](#adding-a-device-type)).

Three dashboard cards come with it: an overview of all pumps with a control dialog, a schedule
editor and a history chart. They are registered as dashboard resources by the integration itself.

Requires **Home Assistant 2026.10** or newer (pumps are child devices of the doser).

## Contents

- [Installation](#installation)
- [Setup](#setup)
- [Devices and entities](#devices-and-entities)
- [Actions](#actions)
- [Events](#events)
- [Dashboard cards](#dashboard-cards)
- [REST/WebSocket or MQTT?](#restwebsocket-or-mqtt)
- [Troubleshooting](#troubleshooting)
- [Adding a device type](#adding-a-device-type)
- [Development and tests](#development-and-tests)

## Installation

**Marketplace (Home Assistant 2026.11 and newer):** **Settings → Marketplace → Add from link**, enter
`ssiergl/lgal-ha` (or `https://github.com/ssiergl/lgal-ha`), type *Integrations* if asked. Install
"LG Aquatic Life" and restart Home Assistant. New releases then show up as updates.

**HACS (Home Assistant 2026.10):** HACS → ⋮ → Custom repositories → `https://github.com/ssiergl/lgal-ha`,
type *Integration*; install and restart. From 2026.11 on, HACS moves into the Marketplace by itself.

**By hand:** copy `custom_components/lg_aquatic_life` into the `custom_components` folder of your Home
Assistant configuration and restart.

## Setup

1. In the doser's web interface switch to the **pro** view and open **Settings → Sign-in → API keys**.
   Create a key for Home Assistant and copy it (`lgal_…`). A device keeps up to four keys; deleting
   the key locks Home Assistant out again.
2. In Home Assistant the doser usually shows up under **Settings → Devices & services → Discovered**.
   Click *Add* and paste the key. Otherwise add the integration **LG Aquatic Life** and enter the
   address (`lgal-doser-xxxx.local` or the IP address) and the key.
3. The device must have finished its setup wizard; until then the integration says so.

If the key is deleted or replaced on the device, Home Assistant asks for a new one (re-authentication).
*Reconfigure* on the integration entry changes address and key. A device added by IP address gets its
new address from mDNS when DHCP hands out a different one.

## Devices and entities

Every doser is one device; **every fitted pump head is its own child device**, named like the pump
(e.g. "KH"). Give the doser an area and leave the heads' areas empty: they take over the doser's
area (set one of their own only for a head that stands elsewhere). The entity ids carry the pump
number, not its name, e.g. `sensor.lgal_doser_5_1122_pump_2_container_level` shown as
"KH Container level", and the doser's own entities carry no area, e.g.
`binary_sensor.lgal_doser_5_1122_alarm`. Renaming a pump or moving the doser to another area
changes the shown names and keeps the ids (and your automations) as they are. Old ids that Home
Assistant gives back when you remove and re-add the integration are renamed once to this scheme;
ids you change yourself afterwards stay. Heads that are not fitted get no device. When heads are
fitted or removed (engineering menu of the device), the integration reloads by itself and removes
devices of heads that are gone.

Renaming a pump on the device (or with the *Name* entity) renames its device in Home Assistant.

### Per pump

| Entity | Type | Notes |
|---|---|---|
| Container content, Container level, Range | sensors | ml, %, days; only when the container is tracked |
| Dosed today, Planned today, Total dosed | sensors | ml |
| Next dose, Next dose amount | sensors | time stamp and ml (incl. boost share) |
| Activity, Dose progress | sensors | idle / dosing / priming / calibrating, live via WebSocket |
| Last result, Last dose | sensors | result of the last run (done, stopped, driver fault, locked, …) |
| Skipped today | sensor | with the reason of the last skip |
| Boost remaining | sensor | ml, with the boost details as attributes |
| Schedule | sensor | none / spread / times; the whole plan and today's doses as attributes |
| Calibration, Calibrated at | sensors | ml per revolution |
| Tube operating hours, Tube wear | sensors | |
| Running, Container almost empty, Container running low, Driver fault, Daily limit reached, Calibration due, Tube worn, Boost, Calibration waiting for measurement | binary sensors | |
| Mode | select | automatic / manual only / off |
| Schedule | switch | automatic ↔ manual only |
| Speed, Direction, Retract | selects | direction and retract disabled by default |
| Daily limit, Container size, Container content, Container warning (days), Container alarm (days), Calibration reminder, Anti-drip retract | numbers | configuration |
| Dose amount | number | kept in Home Assistant; used by the *Dose* button |
| Name | text | up to 23 bytes |
| Dose, Stop, Container refilled, Tube replaced, End boost | buttons | |
| Events | event | everything the device records for this pump (see [Events](#events)) |

### Per doser

| Entity | Type | Notes |
|---|---|---|
| Alarm, Warning | binary sensors | same rules as the device's status LED; the conditions as attribute |
| Clock, 24 V supply, Live connection | binary sensors | |
| Supply voltage | sensor | board v1.1 only |
| Last start, IP address, Network, Time source, Free memory | sensors | diagnostic |
| Manual dose during lock time | select | reject / queue |
| LED night mode, LED night start/end, LED night brightness | switch, times, number | |
| Stop all, Restart, Check for updates | buttons | |
| Firmware | update | install a released firmware from Home Assistant, with progress |
| Events | event | system events, lock rules, alarms |

### Updates

Live values (activity, progress, container, dosed today) come as pushes over the WebSocket, at once
and at least every 10 s. Everything else is polled every 30 s (every 10 s while the live connection is
down); schedules, system info, LED and firmware state every 5 minutes and at midnight.

## Actions

All actions take a `device_id`: a **pump device**, or the **doser** together with `pump: 1…5`.

| Action | What it does |
|---|---|
| `lg_aquatic_life.dose` | dose `amount` ml now (optional `speed`) |
| `lg_aquatic_life.stop` | stop a pump; on the doser without `pump`: stop all |
| `lg_aquatic_life.prime` | fill the tube: `action: start` with `duration` (s), or hold with `start` + `beat` (every < 1.5 s) + `stop` |
| `lg_aquatic_life.calibrate` | `start` (optional `amount` target), then `apply` with the measured `amount`, or `cancel` |
| `lg_aquatic_life.set_container` | `capacity` alone = a new full container of this size; `remaining` sets the content |
| `lg_aquatic_life.refill` | container refilled to its capacity |
| `lg_aquatic_life.set_tube_hours` | tube replaced (`hours: 0`) or set its hours |
| `lg_aquatic_life.set_schedule` | a plan from fields (`kind`, `amount`, `doses`, `start`, `end`, `times`, `days`, `weekdays`, `every`, `anchor`, `power_loss`, `catch_up_min`) or the device's JSON as `schedule` |
| `lg_aquatic_life.start_boost` / `stop_boost` | extra `amount` ml over `days` or `doses` |
| `lg_aquatic_life.set_lock_rules` | lock times between pumps (`rules: [{pumps: [1, 2], gap_min: 5}]`) and `manual: reject/queue` |
| `lg_aquatic_life.get_history` | events of the device (response) |
| `lg_aquatic_life.get_daily_history` | dosed ml, doses and skipped doses per day and pump (response) |

Errors of the device come back as readable, translated messages (e.g. "The schedule exceeds the daily
limit.", "A lock time to another pump is running; possible from 10:05.").

```yaml
# 24 ml in 12 doses between 08:00 and 20:00, every day
action: lg_aquatic_life.set_schedule
data:
  device_id: <pump device>
  kind: spread
  amount: 24
  doses: 12
  start: "08:00"
  end: "20:00"
  days: daily
```

```yaml
# daily amounts of the last 14 days as response
action: lg_aquatic_life.get_daily_history
data:
  device_id: <doser device>
  days: 14
response_variable: history
```

## Events

Everything the device records in its history (doses, skipped doses, priming, calibration, container,
tube, alarms, boost, mode and schedule changes, system events) is

- an **event entity** per pump and one per doser (usable as automation triggers in the UI), and
- an event `lg_aquatic_life_event` on the event bus, with `device_id` (doser), `pump_device_id`,
  `host` and the fields of the device's history entry: `kind`, `pump` (0 = device), `code` (result,
  reason or alarm), `source` (schedule, manual, api, boost, …), `utc`, `local` and the amounts of the kind.

```yaml
triggers:
  - trigger: event
    event_type: lg_aquatic_life_event
    event_data:
      kind: skip
actions:
  - action: notify.mobile_app_phone
    data:
      message: "Dose of pump {{ trigger.event.data.pump }} skipped ({{ trigger.event.data.code }})"
```

## Dashboard cards

The cards are served by the integration (`/lg_aquatic_life_static/lgal-cards.js`) and added to the
dashboard resources automatically (storage mode). In YAML mode add the resource yourself:

```yaml
lovelace:
  resources:
    - url: /lg_aquatic_life_static/lgal-cards.js?v=0.2.0
      type: module
```

All cards have a visual editor and find the doser and its pumps on their own. Colours, surfaces,
buttons and fields come from your Home Assistant theme; the texts follow the user's language (German
or English).

### Doser overview — `custom:lgal-doser-card`

One graduated container per pump with the level in %, an ml scale, the amount left, "lasts about
N days" (yellow/red below the pump's warning and alarm thresholds), today's progress, the next dose
(highlighted with a boost share), the running dose with progress and a stop button, and small icons
for alarms, warnings and boost. A tap opens the **pump dialog** with tabs for everything the pump can
do: **Dose**, **Schedule**, **Boost**, **Calibration**, **Pump** (settings) and **Device**; each tab is
one of the cards below.

```yaml
type: custom:lgal-doser-card
# device: <doser or pump device id>   # optional; without it the first doser, a pump device shows only that pump
# pumps: [1, 2, 3]                    # optional; default: every fitted pump
# title: Dosing                       # optional; no title by default
# show_controls: true                 # false: a tap opens the more-info dialog instead
# show_scale / show_amount / show_days_left / show_today / show_next: true
```

### Cards for one pump

Each takes `device: <pump device id>` (or the doser plus `pump: 2`); without either they use the
first pump of the first doser. Put them side by side in a sections view to build a page per pump.

| Card | What it does |
|---|---|
| `custom:lgal-doser-manual-card` | **Manual dosing**: amount, speed, a confirmation before the pump starts, progress and stop; **prime** the tube by holding the button. |
| `custom:lgal-doser-schedule-card` | **Dosing schedule**: today's doses on a 24 h bar, the wizards *New schedule…*, *Adjust total amount…* and *Change number of doses…*, a summary, the active weekdays (tap to switch a day on or off) and *Edit…* for the full plan (daily amount spread over N doses or up to 24 single times; daily, weekdays or every N days; behaviour after a power cut). Changes stay a draft until *Save schedule*; the device checks the plan against the daily limit, the lock times and the run time of each dose, and a refusal is shown in the card. |
| `custom:lgal-doser-boost-card` | **Boost**: extra amount over 1–30 days or the next 1–100 doses, with a preview per day or dose; a running boost shows the rest, end and doses left and can be ended. |
| `custom:lgal-doser-calibration-card` | **Calibration wizard**: prime the tube, hold the outlet into a measuring cup, run the target amount, enter what is in the cup, apply or discard. |
| `custom:lgal-doser-pump-settings-card` | **Pump settings**: name, mode (automatic / manual only / off), speed, daily limit, container size and content, *Refilled*, warning and alarm thresholds in days, calibration reminder, tube running time and *Tube replaced*, and (when their entities are enabled) direction and anti-drip retract. Every change is applied at once. |

```yaml
type: custom:lgal-doser-schedule-card
device: <pump device id>              # or the doser plus "pump: 2"
# title: KH schedule
```

Holding *prime* starts priming and sends a keep-alive while held; the integration keeps the device's
fast heartbeat. If the browser goes away, priming stops after 1.5 s at the latest (and the device
itself stops after 500 ms without a heartbeat from Home Assistant).

### Device — `custom:lgal-doser-device-card`

Stop all pumps, restart the doser, the status LED's night mode (on/off, from/to, brightness), the
**lock times** (minimum gap between the doses of two pumps, and whether a manual dose during a lock
time is rejected or waits) and the firmware version with a link to the update.

```yaml
type: custom:lgal-doser-device-card
# device: <doser device id>           # optional; without it the first doser
```

### History — `custom:lgal-doser-history-card`

Dosed ml per day and pump as bars (7/14/30/60 days to choose), with the totals per pump.

```yaml
type: custom:lgal-doser-history-card
# device: <doser or pump device id>   # a pump device shows only that pump
# days: 14
```

## REST/WebSocket or MQTT?

The doser can also publish to an MQTT broker, with *Home Assistant discovery*. That path is for setups
without this integration (or for other systems that read MQTT): the device then appears via the MQTT
integration with sensors per pump and, if allowed, a few controls.

This integration does **not** use MQTT. It talks to the device directly, which gives you everything the
device can do (schedules, calibration, boost, lock times, history, firmware updates, cards), works
without a broker and gets errors back as readable messages.

**Use one of the two for Home Assistant.** If you use this integration, switch off *Home Assistant
discovery* in the doser's MQTT settings (or MQTT altogether), otherwise every pump shows up twice. MQTT
for other consumers (Node-RED, a logger, …) can stay on.

## Troubleshooting

| Message | Cause |
|---|---|
| *Invalid API key* | key mistyped, deleted on the device, or the device was reset |
| *The device has not finished its setup* | run the setup wizard in the device's web interface first |
| *Cannot connect* | wrong address, device offline, or `.local` names are not resolved in your network (use the IP address) |
| *Not an LG Aquatic Life device* / *not supported yet* | the address belongs to another device, or a device type this version does not know |
| *Live connection* off | the device allows four live connections (web UI tabs count); values then come by polling every 10 s |

Diagnostics (⋮ → *Download diagnostics* on the device) contain the device's raw data with key and MAC
removed. Debug logging:

```yaml
logger:
  logs:
    custom_components.lg_aquatic_life: debug
```

## Adding a device type

A device type is chosen by `firmware.project` from `/api/v1/system/info`. A new one needs

1. a coordinator subclass of `LgalCoordinator` (`coordinator.py`) that fills its data from the
   device's endpoints (`doser.py` is the example),
2. its entity descriptions in a `ModelEntities` (`doser_entities.py`),
3. an entry in `DEVICE_TYPES` (`models.py`), and the texts in `tools/gen_translations.py`.

Config flow, discovery, API key handling, the live connection, translations of device errors,
diagnostics and the platforms are shared.

## Development and tests

```bash
pip install pytest-homeassistant-custom-component
python -m pytest tests
```

The tests start the firmware's device mock from a sibling checkout of [lgal-doser](https://github.com/ssiergl/lgal-doser) (`../lgal-doser` or `../lgal_doser`, or `LGAL_DOSER_REPO`)
and run the integration in a real Home Assistant core: setup, child devices, dosing via the live
connection, priming, calibration, schedules, boost, history events, translated errors, the config
flow and re-authentication; plus consistency checks of translations, icons, actions and the card file.

Translations are generated: edit `tools/gen_translations.py` and run

```bash
python3 tools/gen_translations.py custom_components/lg_aquatic_life/translations
```

`tools/dev_ha.py` starts a complete local test bench: the device mock and Home Assistant (with
`home-assistant-frontend` installed) in `./config`, onboarded with a test user, the mock doser added
and a dashboard with all three cards, at `http://127.0.0.1:8123/lgal-dev` (user `dev`, password
`dev-password`).

## License

GPL-3.0-or-later, see [LICENSE](LICENSE). The LG Aquatic Life name and logo (`custom_components/lg_aquatic_life/brand/`)
identify the brand and are not covered by the license.
