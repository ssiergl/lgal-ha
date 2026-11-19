/*
 * SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Dashboard cards of the LG Aquatic Life integration (plain web components, no build step).
 *
 *   type: custom:lgal-doser-card            Overview of all pumps of a doser (1–5) with a dialog per
 *   device: <device id>                     pump: dose, stop, prime (hold), container, boost,
 *   pumps: [1, 2, 3]                        calibration wizard, mode. All optional: without "device"
 *   show_controls: true                     the first doser is used, without "pumps" every fitted pump.
 *   title: Dosing
 *
 *   type: custom:lgal-doser-schedule-card   Schedule of one pump: today's doses on a 24 h bar and an
 *   device: <pump device id>                editor (spread / single times / none, days, power cut).
 *                                           Alternatively the doser's device id plus "pump: 2".
 *
 *   type: custom:lgal-doser-history-card    Dosed amount per day and pump (7/14/30/60 days).
 *   device: <device id>
 *   days: 14
 *
 * The cards find the entities through the entity registry (platform + translation key), so renamed
 * entity ids keep working. Actions go through the integration's actions (lg_aquatic_life.*).
 */

(() => {
const DOMAIN = "lg_aquatic_life";
const VERSION = "0.1.0";
const COLORS = {
  light: ["#0d93aa", "#e07a3f", "#7656e0", "#2f9e55", "#c99a10"],
  dark: ["#38c6d9", "#f59e6b", "#a78bfa", "#5ad17a", "#f2c94c"],
};

// -- texts -------------------------------------------------------------------------------------

const TEXTS = {
  en: {
    pump: "Pump {n}", none: "No LGAL Doser found. Add it with the LG Aquatic Life integration.",
    unavailable: "unavailable", today: "Today", of: "of", range: "Range", days: "{n} d", next: "Next",
    noNext: "no dose planned", running: "Running", dosing: "Dosing", priming: "Priming", calibrating: "Calibrating",
    stop: "Stop", stopAll: "Stop all", auto: "Automatic", manual_only: "Manual only", disabled: "Off",
    container: "Container", notTracked: "not tracked", boost: "Boost", doseNow: "Dose now", amount: "Amount (ml)",
    dose: "Dose", prime: "Prime (hold)", primeHint: "Hold the button to fill the tube.", refilled: "Refilled",
    size: "Size (ml)", setSize: "Set", mode: "Mode", boostAmount: "Extra amount (ml)", boostDays: "over days",
    startBoost: "Start boost", endBoost: "End boost", boostLeft: "{ml} ml left, until {end}",
    calibration: "Calibration", calStart: "Start calibration run", calTarget: "Target (ml)",
    calPrimed: "Prime the tube first and put the outlet into a measuring cup.",
    calMeasured: "Measured in the cup (ml)", calApply: "Apply", calCancel: "Discard", calRunning: "Calibration run …",
    calOk: "Calibrated {when}", calNever: "not calibrated", calDue: "calibration due",
    close: "Close", alarms: "Alarms", warnings: "Warnings", driver_fault: "Driver fault in the last run",
    daily_limit_reached: "Daily limit reached", container_low: "Container almost empty",
    container_warning: "Container running low", calibration_due: "Calibrate again", tube_worn: "Tube worn",
    skipped: "{n} dose(s) skipped today", done: "Done", error: "Error",
    schedule: "Schedule", kind: "Kind", spread: "Daily amount in doses", times: "Single times", kindNone: "No schedule",
    dailyMl: "Daily amount (ml)", count: "Doses per day", start: "First dose", end: "Last dose",
    time: "Time", add: "Add time", remove: "Remove", daysMode: "Days", daily: "Daily", weekdays: "Weekdays",
    interval: "Every N days", every: "Every", anchor: "Starting", powerLoss: "After a power cut",
    skip_missed: "Skip missed doses", catch_up_window: "Catch up within", minutes: "min", save: "Save", reset: "Reset",
    saved: "Saved", preview: "Preview", perDose: "{ml} ml per dose", choosePump: "Choose a pump in the card settings.",
    history: "History", noData: "No data yet.", ml: "ml", wd: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
    todayShort: "today", liveDown: "live connection down",
  },
  de: {
    pump: "Pumpe {n}", none: "Kein LGAL Doser gefunden. Füge ihn mit der Integration LG Aquatic Life hinzu.",
    unavailable: "nicht verfügbar", today: "Heute", of: "von", range: "Reichweite", days: "{n} T", next: "Nächste",
    noNext: "keine Dosis geplant", running: "Läuft", dosing: "Dosiert", priming: "Ansaugen", calibrating: "Kalibriert",
    stop: "Stopp", stopAll: "Alle stoppen", auto: "Automatisch", manual_only: "Nur manuell", disabled: "Aus",
    container: "Behälter", notTracked: "nicht verfolgt", boost: "Boost", doseNow: "Jetzt dosieren", amount: "Menge (ml)",
    dose: "Dosieren", prime: "Ansaugen (halten)", primeHint: "Taste halten, um den Schlauch zu füllen.", refilled: "Aufgefüllt",
    size: "Größe (ml)", setSize: "Setzen", mode: "Betriebsart", boostAmount: "Zusatzmenge (ml)", boostDays: "über Tage",
    startBoost: "Boost starten", endBoost: "Boost beenden", boostLeft: "noch {ml} ml, bis {end}",
    calibration: "Kalibrierung", calStart: "Kalibrierlauf starten", calTarget: "Zielmenge (ml)",
    calPrimed: "Schlauch vorher ansaugen und den Auslass in einen Messbecher halten.",
    calMeasured: "Im Messbecher gemessen (ml)", calApply: "Übernehmen", calCancel: "Verwerfen", calRunning: "Kalibrierlauf …",
    calOk: "Kalibriert {when}", calNever: "nicht kalibriert", calDue: "Kalibrierung fällig",
    close: "Schließen", alarms: "Alarme", warnings: "Warnungen", driver_fault: "Treiberfehler im letzten Lauf",
    daily_limit_reached: "Tageslimit erreicht", container_low: "Behälter fast leer",
    container_warning: "Behälter wird knapp", calibration_due: "Neu kalibrieren", tube_worn: "Schlauch verschlissen",
    skipped: "{n} Dosis/Dosen heute übersprungen", done: "Erledigt", error: "Fehler",
    schedule: "Zeitplan", kind: "Art", spread: "Tagesmenge in Dosen", times: "Einzelzeiten", kindNone: "Kein Zeitplan",
    dailyMl: "Tagesmenge (ml)", count: "Dosen pro Tag", start: "Erste Dosis", end: "Letzte Dosis",
    time: "Zeit", add: "Zeit hinzufügen", remove: "Entfernen", daysMode: "Tage", daily: "Täglich", weekdays: "Wochentage",
    interval: "Alle N Tage", every: "Alle", anchor: "ab", powerLoss: "Nach Stromausfall",
    skip_missed: "Verpasste Dosen auslassen", catch_up_window: "Nachholen innerhalb", minutes: "min", save: "Speichern", reset: "Zurücksetzen",
    saved: "Gespeichert", preview: "Vorschau", perDose: "{ml} ml pro Dosis", choosePump: "Wähle in den Karteneinstellungen eine Pumpe.",
    history: "Historie", noData: "Noch keine Daten.", ml: "ml", wd: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
    todayShort: "heute", liveDown: "Live-Verbindung getrennt",
  },
};
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const langOf = (hass) => ((hass && ((hass.locale && hass.locale.language) || hass.language)) || "en").startsWith("de") ? "de" : "en";
function t(hass, key, vars) {
  const table = TEXTS[langOf(hass)];
  let s = key in table ? table[key] : TEXTS.en[key] !== undefined ? TEXTS.en[key] : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = String(s).replaceAll(`{${k}}`, v);
  return s;
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const fmt = (v, d = 1) => (v === null || v === undefined ? "–" : Number(v).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: 0 }));
const dark = (hass) => !!(hass && hass.themes && hass.themes.darkMode);
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const color = (hass, n) => (dark(hass) ? COLORS.dark : COLORS.light)[(n - 1) % 5];

function fmtTime(hass, iso) {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  const now = new Date();
  const opts = { hour: "2-digit", minute: "2-digit" };
  const time = d.toLocaleTimeString(hass?.locale?.language || undefined, opts);
  if (d.toDateString() === now.toDateString()) return time;
  return `${d.toLocaleDateString(hass?.locale?.language || undefined, { weekday: "short", day: "numeric", month: "numeric" })} ${time}`;
}

// -- finding the doser and its pumps -----------------------------------------------------------

let registryCache = { src: null, value: null };
const known = new Map(); // device_id -> {doser, pump} (kept while an entity is unavailable)

function registry(hass) {
  if (!hass || !hass.entities) return { dosers: new Map() };
  if (registryCache.src === hass.entities && registryCache.states === hass.states) return registryCache.value;
  const byDevice = new Map();
  for (const [eid, e] of Object.entries(hass.entities)) {
    if (e.platform !== DOMAIN || !e.device_id || !e.translation_key) continue;
    if (!byDevice.has(e.device_id)) byDevice.set(e.device_id, {});
    byDevice.get(e.device_id)[e.translation_key] = eid;
  }
  const dosers = new Map();
  const doser = (mac) => {
    if (!dosers.has(mac)) dosers.set(mac, { mac, controller: null, ents: {}, pumps: new Map() });
    return dosers.get(mac);
  };
  for (const [deviceId, ents] of byDevice) {
    if (ents.activity) {
      const attrs = hass.states[ents.activity]?.attributes || {};
      if (attrs.doser && attrs.pump) known.set(deviceId, { doser: attrs.doser, pump: attrs.pump });
      const k = known.get(deviceId);
      if (k) doser(k.doser).pumps.set(k.pump, { n: k.pump, device_id: deviceId, ents });
    } else if (ents.alarm) {
      const attrs = hass.states[ents.alarm]?.attributes || {};
      if (attrs.doser) known.set(deviceId, { doser: attrs.doser, pump: 0 });
      const k = known.get(deviceId);
      if (k) Object.assign(doser(k.doser), { controller: deviceId, ents });
    }
  }
  const value = { dosers };
  registryCache = { src: hass.entities, states: hass.states, value };
  return value;
}

/** The doser of a config: by device id (doser or pump), else the first one. */
function pickDoser(hass, deviceId) {
  const { dosers } = registry(hass);
  if (deviceId) {
    for (const d of dosers.values()) {
      if (d.controller === deviceId) return d;
      for (const p of d.pumps.values()) if (p.device_id === deviceId) return d;
    }
  }
  return [...dosers.values()].sort((a, b) => a.mac.localeCompare(b.mac))[0] || null;
}

function pickPump(hass, config) {
  const d = pickDoser(hass, config.device);
  if (!d) return null;
  for (const p of d.pumps.values()) if (p.device_id === config.device) return p;
  if (config.pump) return d.pumps.get(Number(config.pump)) || null;
  return null;
}

const st = (hass, eid) => (eid ? hass.states[eid] : undefined);
const val = (hass, eid) => { const s = st(hass, eid); return s && !["unknown", "unavailable"].includes(s.state) ? s.state : null; };
const attr = (hass, eid, key) => st(hass, eid)?.attributes?.[key];
const isOn = (hass, eid) => val(hass, eid) === "on";

function pumpName(hass, p) {
  const name = val(hass, p.ents.name);
  return name && name.trim() ? name.trim() : t(hass, "pump", { n: p.n });
}

async function call(hass, service, data) {
  return hass.callService(DOMAIN, service, data);
}
async function callResponse(hass, service, data) {
  const r = await hass.callWS({ type: "call_service", domain: DOMAIN, service, service_data: data, return_response: true });
  return r && r.response;
}
function errText(err) {
  return (err && (err.message || err.error || (err.body && err.body.message))) || String(err);
}

// -- shared styles -----------------------------------------------------------------------------

const BASE_CSS = `
  :host { display: block; }
  ha-card { padding: 16px; }
  .title { font-size: 1.25rem; font-weight: 500; margin: 0 0 12px; display: flex; align-items: center; gap: 8px; }
  .title .sub { font-size: .85rem; color: var(--warning-color); font-weight: 400; }
  .muted { color: var(--secondary-text-color); }
  .small { font-size: .85rem; }
  button.btn {
    font: inherit; font-size: .9rem; border-radius: 18px; padding: 6px 14px; cursor: pointer;
    border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color);
  }
  button.btn.primary { background: var(--primary-color); color: var(--text-primary-color, #fff); border-color: var(--primary-color); }
  button.btn.danger { color: var(--error-color); border-color: var(--error-color); }
  button.btn:disabled { opacity: .5; cursor: default; }
  input, select {
    font: inherit; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--divider-color);
    background: var(--card-background-color); color: var(--primary-text-color); min-width: 0;
  }
  input[type=number] { width: 90px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 6px 0; }
  .msg { font-size: .85rem; margin-top: 6px; min-height: 1em; }
  .msg.err { color: var(--error-color); }
  .msg.ok { color: var(--success-color, #2f9e55); }
  .bar { height: 6px; border-radius: 3px; background: var(--divider-color); overflow: hidden; }
  .bar > i { display: block; height: 100%; background: var(--pc); border-radius: 3px; transition: width .4s; }
`;

// -- overview card -----------------------------------------------------------------------------

class LgalDoserCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._sig = "";
    this._open = null; // pump number of the open dialog
    this._msg = {};
  }

  setConfig(config) {
    this._config = { show_controls: true, ...config };
    this._sig = "";
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() { return 6; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }
  static getStubConfig() { return {}; }
  static getConfigForm() {
    return {
      schema: [
        { name: "device", selector: { device: { integration: DOMAIN } } },
        { name: "title", selector: { text: {} } },
        { name: "show_controls", default: true, selector: { boolean: {} } },
      ],
      computeLabel: (s) => ({ device: "Doser (optional)", title: "Title", show_controls: "Dialog with controls on tap" })[s.name],
    };
  }

  _pumps(d) {
    let pumps = [...d.pumps.values()].sort((a, b) => a.n - b.n);
    if (Array.isArray(this._config.pumps) && this._config.pumps.length) {
      const want = this._config.pumps.map(Number);
      pumps = pumps.filter((p) => want.includes(p.n));
    }
    return pumps;
  }

  _signature(d) {
    const parts = [this._open, dark(this._hass), JSON.stringify(this._msg)];
    for (const p of d.pumps.values()) for (const eid of Object.values(p.ents)) { const s = this._hass.states[eid]; parts.push(s && s.last_updated, s && s.state); }
    for (const eid of Object.values(d.ents)) { const s = this._hass.states[eid]; parts.push(s && s.state); }
    return parts.join("|");
  }

  _render() {
    if (!this._config || !this._hass) return;
    const hass = this._hass;
    const d = pickDoser(hass, this._config.device);
    if (!d) {
      this.shadowRoot.innerHTML = `<style>${BASE_CSS}</style><ha-card><div class="muted">${esc(t(hass, "none"))}</div></ha-card>`;
      this._sig = "";
      return;
    }
    const sig = this._signature(d);
    if (sig === this._sig) return;
    this._sig = sig;
    let card = this.shadowRoot.getElementById("card");
    let dlg = this.shadowRoot.getElementById("dlg");
    if (!card || !dlg) {
      this.shadowRoot.innerHTML = `<style>${BASE_CSS}${OVERVIEW_CSS}</style><ha-card id="card"></ha-card><dialog id="dlg"></dialog>`;
      card = this.shadowRoot.getElementById("card");
      dlg = this.shadowRoot.getElementById("dlg");
      dlg.addEventListener("click", (ev) => { // backdrop (the dialog's own padding is the dialog, too)
        if (ev.target !== dlg) return;
        const r = dlg.getBoundingClientRect();
        if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) this._close();
      });
      dlg.addEventListener("cancel", (ev) => { ev.preventDefault(); this._close(); }); // Escape
    }
    const pumps = this._pumps(d);
    const live = d.ents.live_connection ? val(hass, d.ents.live_connection) : "on";
    const alarm = isOn(hass, d.ents.alarm);
    card.innerHTML = `
        ${this._config.title !== "" ? `<div class="title">${esc(this._config.title || "LGAL Doser")}
          ${live === "off" ? `<span class="sub">${esc(t(hass, "liveDown"))}</span>` : ""}
          ${alarm ? `<ha-icon class="alarm" icon="mdi:alarm-light"></ha-icon>` : ""}
          <span class="spacer"></span>
          ${this._config.show_controls && pumps.some((p) => (val(hass, p.ents.activity) || "idle") !== "idle")
            ? `<button class="btn danger" data-act="stopall">${esc(t(hass, "stopAll"))}</button>` : ""}
        </div>` : ""}
        <div class="grid n${pumps.length}">${pumps.map((p) => this._tile(p)).join("")}</div>`;
    this._bindCard(d, card);
    this._renderDialog(d, dlg);
  }

  _renderDialog(d, dlg) {
    const p = this._open && d.pumps.get(this._open);
    if (!p) {
      if (dlg.open) dlg.close();
      dlg.innerHTML = "";
      return;
    }
    // never replace the dialog while someone types in it or holds the prime button
    const active = this.shadowRoot.activeElement;
    if (dlg.open && (this._priming || (active && dlg.contains(active) && ["INPUT", "SELECT"].includes(active.tagName)))) {
      this._deferred = true;
      return;
    }
    this._deferred = false;
    dlg.style.setProperty("--pc", color(this._hass, p.n));
    dlg.innerHTML = this._dialog(d, p);
    this._bindDialog(d, p, dlg);
    if (!dlg.open) {
      dlg.showModal();
      dlg.querySelector("button.icon")?.focus({ preventScroll: true });
    }
  }

  _flush() {
    if (this._deferred) { this._sig = ""; setTimeout(() => this._render(), 0); }
  }

  _badges(p) {
    const hass = this._hass;
    const errors = ["driver_fault", "daily_limit_reached"].filter((k) => isOn(hass, p.ents[k]));
    const warns = ["container_low", "container_warning", "calibration_due", "tube_worn"].filter((k) => isOn(hass, p.ents[k]));
    if (warns.includes("container_low")) warns.splice(warns.indexOf("container_warning"), warns.includes("container_warning") ? 1 : 0);
    const skipped = num(val(hass, p.ents.skipped_today)) || 0;
    const texts = { errors: errors.map((k) => t(hass, k)), warns: warns.map((k) => t(hass, k)) };
    if (skipped) texts.warns.push(t(hass, "skipped", { n: skipped }));
    return texts;
  }

  _tile(p) {
    const hass = this._hass;
    const e = p.ents;
    const c = color(hass, p.n);
    if (!st(hass, e.activity) || val(hass, e.activity) === null) {
      return `<div class="tile off" style="--pc:${c}"><div class="head"><span class="dot"></span><b>${esc(pumpName(hass, p))}</b></div>
        <div class="muted small">${esc(t(hass, "unavailable"))}</div></div>`;
    }
    const mode = val(hass, e.mode);
    const activity = val(hass, e.activity) || "idle";
    const tracked = attr(hass, e.container_remaining, "tracked");
    const pct = num(val(hass, e.container_level));
    const rem = num(val(hass, e.container_remaining));
    const cap = num(attr(hass, e.container_remaining, "capacity_ml"));
    const days = num(val(hass, e.remaining_days));
    const warnDays = num(attr(hass, e.container_remaining, "warn_days")) ?? 7;
    const lowDays = num(attr(hass, e.container_remaining, "low_days")) ?? 4;
    const level = !tracked ? "none" : days !== null && days < lowDays ? "low" : days !== null && days < warnDays ? "warn" : "ok";
    const dosed = num(val(hass, e.dosed_today)) ?? 0;
    const planned = num(val(hass, e.planned_today)) ?? 0;
    const boost = isOn(hass, e.boost_active);
    const nextIso = val(hass, e.next_dose);
    const nextMl = attr(hass, e.next_dose, "ml");
    const nextBoost = attr(hass, e.next_dose, "boost_ml");
    const b = this._badges(p);
    const progress = attr(hass, e.activity, "progress");
    const target = attr(hass, e.activity, "target_ml");
    const done = attr(hass, e.activity, "done_ml");
    return `
      <div class="tile ${mode === "disabled" ? "dim" : ""}" style="--pc:${c}" data-pump="${p.n}" tabindex="0" role="button">
        <div class="head">
          <span class="dot"></span><b class="name">${esc(pumpName(hass, p))}</b>
          <span class="spacer"></span>
          ${boost ? `<ha-icon class="boost" icon="mdi:rocket-launch" title="${esc(t(hass, "boost"))}"></ha-icon>` : ""}
          ${b.errors.length ? `<span class="badge err" title="${esc(b.errors.join("\n"))}"><ha-icon icon="mdi:alert-circle"></ha-icon>${b.errors.length}</span>` : ""}
          ${b.warns.length ? `<span class="badge warn" title="${esc(b.warns.join("\n"))}"><ha-icon icon="mdi:alert"></ha-icon>${b.warns.length}</span>` : ""}
          ${mode && mode !== "auto" ? `<span class="chip">${esc(t(hass, mode))}</span>` : ""}
        </div>
        <div class="body">
          ${bottle(pct, level, tracked)}
          <div class="stats">
            <div class="kv"><span>${esc(t(hass, "container"))}</span><b>${tracked ? `${fmt(rem, 0)}${cap ? ` / ${fmt(cap, 0)}` : ""} ml` : esc(t(hass, "notTracked"))}</b></div>
            <div class="kv"><span>${esc(t(hass, "range"))}</span><b class="lvl-${level}">${days !== null && tracked ? esc(t(hass, "days", { n: fmt(days, 1) })) : "–"}</b></div>
            <div class="kv"><span>${esc(t(hass, "today"))}</span><b class="${boost ? "boosted" : ""}">${fmt(dosed, 1)} / ${fmt(planned, 1)} ml</b></div>
            <div class="bar"><i style="width:${planned ? Math.min(100, (100 * dosed) / planned) : 0}%"></i></div>
            <div class="kv"><span>${esc(t(hass, "next"))}</span><b class="${nextBoost ? "boosted" : ""}">${nextIso ? `${esc(fmtTime(hass, nextIso))} · ${fmt(nextMl, 2)} ml` : `<span class="muted">${esc(t(hass, "noNext"))}</span>`}</b></div>
          </div>
        </div>
        ${activity !== "idle" ? `
          <div class="run">
            <ha-icon icon="${activity === "priming" ? "mdi:water-sync" : activity === "calibrating" ? "mdi:beaker" : "mdi:pump"}"></ha-icon>
            <span>${esc(t(hass, activity))}${target ? ` ${fmt(done, 2)} / ${fmt(target, 2)} ml` : ""}</span>
            <span class="spacer"></span>
            ${this._config.show_controls ? `<button class="btn danger small" data-act="stop" data-p="${p.n}">${esc(t(hass, "stop"))}</button>` : ""}
          </div>
          ${progress !== undefined ? `<div class="bar"><i style="width:${progress}%"></i></div>` : ""}` : ""}
      </div>`;
  }

  _dialog(d, p) {
    if (!p) return "";
    const hass = this._hass;
    const e = p.ents;
    const m = this._msg[p.n] || {};
    const activity = val(hass, e.activity) || "idle";
    const mode = val(hass, e.mode);
    const tracked = attr(hass, e.container_remaining, "tracked");
    const cap = attr(hass, e.container_remaining, "capacity_ml");
    const b = this._badges(p);
    const boostOn = isOn(hass, e.boost_active) || num(val(hass, e.boost_remaining)) > 0;
    const calPending = isOn(hass, e.calibration_pending) || attr(hass, e.calibration, "pending");
    const calAt = val(hass, e.calibrated_at);
    const calTarget = attr(hass, e.calibration, "target_ml") || 10;
    const msg = (k) => (m[k] ? `<div class="msg ${m[k].err ? "err" : "ok"}">${esc(m[k].text)}</div>` : "");
    return `
          <div class="dhead"><span class="dot"></span><b>${esc(pumpName(hass, p))}</b><span class="spacer"></span>
            <button class="icon" data-act="close" aria-label="${esc(t(hass, "close"))}"><ha-icon icon="mdi:close"></ha-icon></button></div>
          ${b.errors.length ? `<div class="alert err">${b.errors.map(esc).join("<br>")}</div>` : ""}
          ${b.warns.length ? `<div class="alert warn">${b.warns.map(esc).join("<br>")}</div>` : ""}

          <h4>${esc(t(hass, "doseNow"))}</h4>
          <div class="row">
            <input type="number" min="0.02" step="0.1" id="dose-ml" value="${esc(val(hass, e.dose_amount) || 1)}" aria-label="${esc(t(hass, "amount"))}"> ml
            <button class="btn primary" data-act="dose" ${activity !== "idle" || mode === "disabled" ? "disabled" : ""}>${esc(t(hass, "dose"))}</button>
            <button class="btn danger" data-act="stop" data-p="${p.n}" ${activity === "idle" ? "disabled" : ""}>${esc(t(hass, "stop"))}</button>
          </div>
          ${msg("dose")}
          <div class="row">
            <button class="btn hold" id="prime" ${mode === "disabled" ? "disabled" : ""}>${esc(t(hass, "prime"))}</button>
            <span class="muted small">${esc(t(hass, "primeHint"))}</span>
          </div>
          ${msg("prime")}

          <h4>${esc(t(hass, "mode"))}</h4>
          <div class="row">
            <select id="mode">${["auto", "manual_only", "disabled"].map((o) => `<option value="${o}" ${o === mode ? "selected" : ""}>${esc(t(hass, o))}</option>`).join("")}</select>
          </div>
          ${msg("mode")}

          <h4>${esc(t(hass, "container"))}</h4>
          <div class="row">
            ${tracked ? `<button class="btn" data-act="refill">${esc(t(hass, "refilled"))}</button>` : ""}
            <input type="number" min="0" step="1" id="cap" value="${esc(cap ?? 0)}" aria-label="${esc(t(hass, "size"))}"> ml
            <button class="btn" data-act="cap">${esc(t(hass, "setSize"))}</button>
          </div>
          ${msg("container")}

          <h4>${esc(t(hass, "boost"))}</h4>
          ${boostOn ? `
            <div class="row"><span>${esc(t(hass, "boostLeft", { ml: fmt(val(hass, e.boost_remaining), 1), end: fmtTime(hass, attr(hass, e.boost_remaining, "end")) }))}</span>
              <button class="btn" data-act="boost-stop">${esc(t(hass, "endBoost"))}</button></div>` : `
            <div class="row">
              <input type="number" min="0.1" step="0.5" id="boost-ml" value="10" aria-label="${esc(t(hass, "boostAmount"))}"> ml
              <input type="number" min="1" max="30" step="1" id="boost-days" value="3" aria-label="${esc(t(hass, "boostDays"))}"> ${esc(t(hass, "boostDays"))}
              <button class="btn" data-act="boost" ${mode !== "auto" ? "disabled" : ""}>${esc(t(hass, "startBoost"))}</button>
            </div>`}
          ${msg("boost")}

          <h4>${esc(t(hass, "calibration"))}</h4>
          <div class="muted small">${calAt ? esc(t(hass, "calOk", { when: fmtTime(hass, calAt) })) : esc(t(hass, "calNever"))}</div>
          ${activity === "calibrating" ? `<div class="row">${esc(t(hass, "calRunning"))}</div>` : calPending ? `
            <div class="row">
              <span>${esc(t(hass, "calMeasured"))}</span>
              <input type="number" min="0.01" step="0.01" id="cal-measured" value="${esc(attr(hass, e.calibration_pending, "target_ml") || calTarget)}">
              <button class="btn primary" data-act="cal-apply">${esc(t(hass, "calApply"))}</button>
              <button class="btn" data-act="cal-cancel">${esc(t(hass, "calCancel"))}</button>
            </div>` : `
            <div class="muted small">${esc(t(hass, "calPrimed"))}</div>
            <div class="row">
              <input type="number" min="1" max="200" step="1" id="cal-target" value="${esc(calTarget)}" aria-label="${esc(t(hass, "calTarget"))}"> ml
              <button class="btn" data-act="cal-start" ${activity !== "idle" || mode === "disabled" ? "disabled" : ""}>${esc(t(hass, "calStart"))}</button>
            </div>`}
          ${msg("cal")}`;
  }

  _note(n, key, text, err = false) {
    this._msg = { ...this._msg, [n]: { ...(this._msg[n] || {}), [key]: { text, err } } };
    this._sig = "";
    this._render();
    if (!err) setTimeout(() => {
      if (this._msg[n] && this._msg[n][key] && this._msg[n][key].text === text) {
        const copy = { ...this._msg[n] }; delete copy[key];
        this._msg = { ...this._msg, [n]: copy }; this._sig = ""; this._render();
      }
    }, 3000);
  }

  async _run(n, key, fn) {
    try {
      await fn();
      this._note(n, key, t(this._hass, "done"));
    } catch (err) {
      this._note(n, key, errText(err), true);
    }
  }

  _bindCard(d, card) {
    card.querySelectorAll(".tile[data-pump]").forEach((el) => {
      const open = (ev) => {
        if (ev.target.closest("button")) return;
        if (!this._config.show_controls) {
          const p = d.pumps.get(Number(el.dataset.pump));
          this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: p.ents.activity } }));
          return;
        }
        this._open = Number(el.dataset.pump); this._sig = ""; this._render();
      };
      el.addEventListener("click", open);
      el.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); open(ev); } });
    });
    card.querySelectorAll("[data-act]").forEach((el) => el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._action(d, el.dataset.act, el);
    }));
  }

  _bindDialog(d, p, dlg) {
    const hass = this._hass;
    dlg.querySelectorAll("[data-act]").forEach((el) => el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (el.dataset.act === "close") this._close(); else this._action(d, el.dataset.act, el);
    }));
    const mode = dlg.querySelector("#mode");
    if (mode) mode.addEventListener("change", () => {
      this._run(p.n, "mode", () => hass.callService("select", "select_option", { entity_id: p.ents.mode, option: mode.value }));
      mode.blur();
    });
    const prime = dlg.querySelector("#prime");
    if (prime) this._bindPrime(p, prime);
    dlg.querySelectorAll("input, select").forEach((i) => i.addEventListener("blur", () => this._flush()));
  }

  _close() { this._primeStop(); this._open = null; this._sig = ""; this._render(); }

  disconnectedCallback() { this._primeStop(); }

  _primeStop() {
    const run = this._priming;
    if (!run) return;
    this._priming = null;
    clearInterval(run.timer);
    window.removeEventListener("pointerup", run.release);
    window.removeEventListener("pointercancel", run.release);
    window.removeEventListener("blur", run.release);
    this.shadowRoot.getElementById("prime")?.classList.remove("active");
    call(this._hass, "prime", { device_id: run.device_id, action: "stop" }).catch(() => {});
    this._flush();
  }

  _bindPrime(p, btn) {
    if (this._priming) btn.classList.add("active");
    const start = (ev) => {
      ev.preventDefault();
      if (this._priming || btn.disabled) return;
      const hass = this._hass;
      const release = () => this._primeStop();
      // the integration keeps the device's 150 ms heartbeat; this keep-alive only says "still held"
      const timer = setInterval(() => call(this._hass, "prime", { device_id: p.device_id, action: "beat" }).catch(() => {}), 400);
      this._priming = { device_id: p.device_id, timer, release };
      window.addEventListener("pointerup", release);
      window.addEventListener("pointercancel", release);
      window.addEventListener("blur", release);
      btn.classList.add("active");
      call(hass, "prime", { device_id: p.device_id, action: "start" }).catch((err) => { this._primeStop(); this._note(p.n, "prime", errText(err), true); });
    };
    btn.addEventListener("pointerdown", start);
    btn.addEventListener("contextmenu", (ev) => ev.preventDefault());
    btn.addEventListener("keydown", (ev) => { if ((ev.key === " " || ev.key === "Enter") && !ev.repeat) start(ev); });
    btn.addEventListener("keyup", () => this._primeStop());
  }

  _action(d, act, el) {
    const hass = this._hass;
    const root = this.shadowRoot;
    const n = this._open || Number(el.dataset.p) || 0;
    const p = d.pumps.get(n);
    const input = (id) => num(root.getElementById(id)?.value);
    switch (act) {
      case "stopall":
        if (d.controller) call(hass, "stop", { device_id: d.controller });
        return;
      case "stop":
        this._run(n, "dose", () => call(hass, "stop", { device_id: d.pumps.get(Number(el.dataset.p) || n).device_id }));
        return;
      case "dose": {
        const ml = input("dose-ml");
        if (!ml) return;
        if (p.ents.dose_amount) hass.callService("number", "set_value", { entity_id: p.ents.dose_amount, value: ml }).catch(() => {});
        this._run(n, "dose", () => call(hass, "dose", { device_id: p.device_id, amount: ml }));
        return;
      }
      case "refill":
        this._run(n, "container", () => call(hass, "refill", { device_id: p.device_id }));
        return;
      case "cap": {
        const capacity = input("cap");
        if (capacity === null) return;
        this._run(n, "container", () => call(hass, "set_container", { device_id: p.device_id, capacity, remaining: capacity }));
        return;
      }
      case "boost": {
        const amount = input("boost-ml"), days = input("boost-days");
        if (!amount || !days) return;
        this._run(n, "boost", () => call(hass, "start_boost", { device_id: p.device_id, amount, days: Math.round(days) }));
        return;
      }
      case "boost-stop":
        this._run(n, "boost", () => call(hass, "stop_boost", { device_id: p.device_id }));
        return;
      case "cal-start": {
        const amount = input("cal-target");
        this._run(n, "cal", () => call(hass, "calibrate", { device_id: p.device_id, action: "start", ...(amount ? { amount } : {}) }));
        return;
      }
      case "cal-apply": {
        const amount = input("cal-measured");
        if (!amount) return;
        this._run(n, "cal", () => call(hass, "calibrate", { device_id: p.device_id, action: "apply", amount }));
        return;
      }
      case "cal-cancel":
        this._run(n, "cal", () => call(hass, "calibrate", { device_id: p.device_id, action: "cancel" }));
        return;
      default:
    }
  }
}

function bottle(pct, level, tracked) {
  const p = tracked && pct !== null ? Math.max(0, Math.min(100, pct)) : 0;
  const h = 62 * (p / 100);
  const fill = level === "low" ? "var(--error-color)" : level === "warn" ? "var(--warning-color)" : "var(--pc)";
  return `<svg class="bottle" viewBox="0 0 44 84" aria-hidden="true">
    <defs><clipPath id="b"><path d="M14 4h16v10l8 8v54a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V22l8-8z"/></clipPath></defs>
    <g clip-path="url(#b)"><rect x="0" y="${80 - h}" width="44" height="${h}" fill="${fill}" opacity=".85"/></g>
    <path d="M14 4h16v10l8 8v54a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V22l8-8z" fill="none" stroke="currentColor" stroke-opacity=".45"
      stroke-width="1.5" ${tracked ? "" : 'stroke-dasharray="3 3"'}/>
    ${tracked && pct !== null ? `<text x="22" y="56" text-anchor="middle" font-size="11" fill="currentColor">${Math.round(p)}%</text>` : ""}
  </svg>`;
}

const OVERVIEW_CSS = `
  .spacer { flex: 1; }
  .alarm { color: var(--error-color); }
  .grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
  .tile { border: 1px solid var(--divider-color); border-top: 3px solid var(--pc); border-radius: 12px; padding: 10px 12px;
    cursor: pointer; display: flex; flex-direction: column; gap: 8px; background: var(--card-background-color); }
  .tile:focus-visible { outline: 2px solid var(--pc); }
  .tile.dim > * { opacity: .45; filter: grayscale(1); }
  .tile.off { cursor: default; }
  .head { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .head .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--pc); flex: none; }
  .badge { display: inline-flex; align-items: center; gap: 2px; font-size: .8rem; --mdc-icon-size: 16px; }
  .badge.err { color: var(--error-color); } .badge.warn { color: var(--warning-color); }
  .boost { color: var(--pc); --mdc-icon-size: 18px; }
  .chip { font-size: .72rem; border: 1px solid var(--divider-color); border-radius: 10px; padding: 1px 7px; color: var(--secondary-text-color); }
  .body { display: flex; gap: 12px; align-items: center; }
  .bottle { width: 44px; height: 84px; flex: none; color: var(--primary-text-color); }
  .stats { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .kv { display: flex; justify-content: space-between; gap: 8px; font-size: .9rem; }
  .kv span { color: var(--secondary-text-color); }
  .kv b { font-weight: 500; text-align: right; }
  .lvl-warn { color: var(--warning-color); } .lvl-low { color: var(--error-color); }
  .boosted { color: var(--pc); }
  .run { display: flex; align-items: center; gap: 6px; font-size: .9rem; --mdc-icon-size: 18px; color: var(--pc); }
  .run .btn { padding: 2px 10px; }
  dialog { background: var(--card-background-color); color: var(--primary-text-color); border: none; border-radius: 16px;
    padding: 16px 20px; width: min(460px, calc(100vw - 32px)); max-height: 90vh; overflow: auto; box-sizing: border-box;
    border-top: 4px solid var(--pc); box-shadow: 0 8px 30px rgba(0,0,0,.35); }
  dialog::backdrop { background: rgba(0,0,0,.5); }
  .dhead { display: flex; align-items: center; gap: 8px; font-size: 1.1rem; }
  dialog h4 { margin: 14px 0 4px; font-weight: 500; }
  button.icon { background: none; border: none; color: inherit; cursor: pointer; padding: 4px; }
  .alert { border-radius: 8px; padding: 6px 10px; margin-top: 8px; font-size: .9rem; }
  .alert.err { background: color-mix(in srgb, var(--error-color) 15%, transparent); color: var(--error-color); }
  .alert.warn { background: color-mix(in srgb, var(--warning-color) 15%, transparent); }
  .btn.hold { user-select: none; -webkit-user-select: none; touch-action: none; }
  .btn.hold.active { background: var(--pc); color: #fff; border-color: var(--pc); }
`;

// -- schedule card -----------------------------------------------------------------------------

function hm(text) { const [h, m] = String(text || "0:0").split(":").map(Number); return h * 60 + m; }
function hmText(min) { return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`; }

/** Like the firmware: daily amount in N doses evenly on the grid, the remainder on the first doses. */
function spreadSlots(s, grid) {
  const n = Math.max(1, Math.min(96, Number(s.count) || 1));
  const ul = Math.round((Number(s.ml) || 0) * 1000);
  const st = hm(s.start);
  const en = n > 1 ? hm(s.end) : st;
  if (n > 1 && en <= st) return [];
  const base = Math.floor(ul / n), rest = ul % n;
  const out = [];
  for (let i = 0; i < n; i++) {
    const m = n > 1 ? st + Math.floor((2 * i * (en - st) + (n - 1) * grid) / (2 * (n - 1) * grid)) * grid : st;
    out.push({ time: hmText(m), ml: (base + (i < rest ? 1 : 0)) / 1000 });
  }
  return out;
}

class LgalDoserScheduleCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._draft = null;
    this._sig = "";
    this._msg = null;
  }

  setConfig(config) { this._config = { ...config }; this._draft = null; this._sig = ""; if (this._hass) this._render(); }
  set hass(hass) { this._hass = hass; this._render(); }
  getCardSize() { return 6; }
  static getStubConfig() { return {}; }
  static getConfigForm() {
    return {
      schema: [
        { name: "device", selector: { device: { integration: DOMAIN } } },
        { name: "pump", selector: { number: { min: 1, max: 5, mode: "box" } } },
        { name: "title", selector: { text: {} } },
      ],
      computeLabel: (s) => ({ device: "Pump (or the doser plus a pump number)", pump: "Pump number (with the doser)", title: "Title" })[s.name],
    };
  }

  _current(p) { return attr(this._hass, p.ents.schedule, "kind") !== undefined ? { kind: val(this._hass, p.ents.schedule) || "none", ...st(this._hass, p.ents.schedule).attributes } : { kind: "none" }; }

  _fromState(p) {
    const a = this._current(p);
    return {
      kind: a.kind || "none",
      ml: a.ml ?? 10, count: a.count ?? 4, start: a.start || "08:00", end: a.end || "20:00",
      times: (a.times || [{ time: "09:00", ml: 1 }]).map((x) => ({ ...x })),
      days: { mode: "daily", weekdays: [...WEEKDAYS], every: 2, anchor: localDate(), ...(a.days || {}) },
      power_loss: a.power_loss || "skip_missed", catch_up_min: a.catch_up_min ?? 60,
    };
  }

  _document() {
    const d = this._draft;
    if (d.kind === "none") return { kind: "none" };
    const days = { mode: d.days.mode };
    if (d.days.mode === "weekdays") days.weekdays = d.days.weekdays;
    if (d.days.mode === "interval") { days.every = Number(d.days.every); days.anchor = d.days.anchor; }
    const doc = { kind: d.kind, days, power_loss: d.power_loss, catch_up_min: Number(d.catch_up_min) };
    if (d.kind === "spread") Object.assign(doc, { ml: Number(d.ml), count: Number(d.count), start: d.start, ...(Number(d.count) > 1 ? { end: d.end } : {}) });
    else doc.times = d.times.filter((x) => x.time).map((x) => ({ time: x.time, ml: Number(x.ml) }));
    return doc;
  }

  _render() {
    if (!this._config || !this._hass) return;
    const hass = this._hass;
    const p = pickPump(hass, this._config);
    if (!p) {
      this.shadowRoot.innerHTML = `<style>${BASE_CSS}</style><ha-card><div class="muted">${esc(t(hass, pickDoser(hass) ? "choosePump" : "none"))}</div></ha-card>`;
      return;
    }
    const s = st(hass, p.ents.schedule);
    const sig = [s && s.last_updated, dark(hass), this._dirty && JSON.stringify(this._draft), JSON.stringify(this._msg)].join("|");
    if (sig === this._sig) return;
    const active = this.shadowRoot.activeElement;
    if (active && ["INPUT", "SELECT"].includes(active.tagName) && this._draft) return; // typing
    this._sig = sig;
    if (!this._draft || !this._dirty) this._draft = this._fromState(p);
    const d = this._draft;
    const grid = attr(hass, p.ents.schedule, "grid_min") || 5;
    const c = color(hass, p.n);
    const sel = (v, cur) => (v === cur ? "selected" : "");
    this.shadowRoot.innerHTML = `
      <style>${BASE_CSS}${SCHEDULE_CSS}</style>
      <ha-card style="--pc:${c}">
        <div class="title"><span class="dot"></span>${esc(this._config.title || `${t(hass, "schedule")} · ${pumpName(hass, p)}`)}</div>
        <div class="day" id="preview">${this._preview(p).day}</div>
        <div class="form">
          <label>${esc(t(hass, "kind"))}
            <select data-f="kind">
              <option value="spread" ${sel("spread", d.kind)}>${esc(t(hass, "spread"))}</option>
              <option value="times" ${sel("times", d.kind)}>${esc(t(hass, "times"))}</option>
              <option value="none" ${sel("none", d.kind)}>${esc(t(hass, "kindNone"))}</option>
            </select></label>
          ${d.kind === "spread" ? `
            <div class="grid2">
              <label>${esc(t(hass, "dailyMl"))}<input type="number" min="0.02" step="0.1" data-f="ml" value="${esc(d.ml)}"></label>
              <label>${esc(t(hass, "count"))}<input type="number" min="1" max="96" step="1" data-f="count" value="${esc(d.count)}"></label>
              <label>${esc(t(hass, "start"))}<input type="time" step="${grid * 60}" data-f="start" value="${esc(d.start)}"></label>
              ${Number(d.count) > 1 ? `<label>${esc(t(hass, "end"))}<input type="time" step="${grid * 60}" data-f="end" value="${esc(d.end)}"></label>` : ""}
            </div>
            <div class="muted small" id="hint">${this._preview(p).hint}</div>` : ""}
          ${d.kind === "times" ? `
            <div class="times">${d.times.map((x, i) => `
              <div class="row"><input type="time" step="${grid * 60}" data-t="${i}" data-k="time" value="${esc(x.time)}" aria-label="${esc(t(hass, "time"))}">
                <input type="number" min="0.02" step="0.1" data-t="${i}" data-k="ml" value="${esc(x.ml)}" aria-label="ml"> ml
                <button class="btn" data-act="del" data-i="${i}" ${d.times.length <= 1 ? "disabled" : ""}>${esc(t(hass, "remove"))}</button></div>`).join("")}
            </div>
            <button class="btn" data-act="addtime" ${d.times.length >= 24 ? "disabled" : ""}>${esc(t(hass, "add"))}</button>` : ""}
          ${d.kind !== "none" ? `
            <label>${esc(t(hass, "daysMode"))}
              <select data-f="days.mode">
                <option value="daily" ${sel("daily", d.days.mode)}>${esc(t(hass, "daily"))}</option>
                <option value="weekdays" ${sel("weekdays", d.days.mode)}>${esc(t(hass, "weekdays"))}</option>
                <option value="interval" ${sel("interval", d.days.mode)}>${esc(t(hass, "interval"))}</option>
              </select></label>
            ${d.days.mode === "weekdays" ? `<div class="wd">${WEEKDAYS.map((w, i) => `
              <label class="chk"><input type="checkbox" data-wd="${w}" ${d.days.weekdays.includes(w) ? "checked" : ""}>${esc(t(hass, "wd")[i])}</label>`).join("")}</div>` : ""}
            ${d.days.mode === "interval" ? `<div class="row">${esc(t(hass, "every"))}
              <input type="number" min="1" max="30" data-f="days.every" value="${esc(d.days.every)}"> ${esc(t(hass, "days", { n: "" }).trim())}
              ${esc(t(hass, "anchor"))} <input type="date" data-f="days.anchor" value="${esc(d.days.anchor)}"></div>` : ""}
            <label>${esc(t(hass, "powerLoss"))}
              <select data-f="power_loss">
                <option value="skip_missed" ${sel("skip_missed", d.power_loss)}>${esc(t(hass, "skip_missed"))}</option>
                <option value="catch_up_window" ${sel("catch_up_window", d.power_loss)}>${esc(t(hass, "catch_up_window"))}</option>
              </select></label>
            ${d.power_loss === "catch_up_window" ? `<div class="row"><input type="number" min="0" max="1440" data-f="catch_up_min" value="${esc(d.catch_up_min)}"> ${esc(t(hass, "minutes"))}</div>` : ""}` : ""}
          <div class="row actions">
            <button class="btn" data-act="reset">${esc(t(hass, "reset"))}</button>
            <button class="btn primary" data-act="save">${esc(t(hass, "save"))}</button>
          </div>
          ${this._msg ? `<div class="msg ${this._msg.err ? "err" : "ok"}">${esc(this._msg.text)}</div>` : ""}
        </div>
      </ha-card>`;
    this._bind(p);
  }

  /** The 24 h bar (today on the device + the draft) and the dose times of a spread plan. */
  _preview(p) {
    const hass = this._hass;
    const d = this._draft;
    const grid = attr(hass, p.ents.schedule, "grid_min") || 5;
    const today = attr(hass, p.ents.schedule, "today");
    const preview = d.kind === "spread" ? spreadSlots(d, grid) : d.kind === "times" ? d.times.filter((x) => x.time) : [];
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const slots = (list, cls) => list.map((x) => `<i class="${cls}" style="left:${(hm(x.time) / 1440) * 100}%" title="${esc(x.time)} · ${fmt(x.ml, 2)} ml"></i>`).join("");
    return {
      day: `
          <div class="track">
            ${slots((today && today.slots) || [], "now")}
            ${slots(preview, "draft")}
            <span class="cursor" style="left:${(nowMin / 1440) * 100}%"></span>
          </div>
          <div class="ticks"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>
          <div class="muted small">${esc(t(hass, "today"))}: ${fmt(today && today.ml, 2)} ml · ${esc(t(hass, "preview"))}: ${fmt(preview.reduce((a, x) => a + Number(x.ml || 0), 0), 2)} ml/d</div>`,
      hint: d.kind === "spread"
        ? `${esc(t(hass, "perDose", { ml: fmt((Number(d.ml) || 0) / (Number(d.count) || 1), 3) }))} · ${preview.map((x) => x.time).join(", ")}`
        : "",
    };
  }

  /** Refresh only the preview: replacing the form while someone types would eat their next click. */
  _refreshPreview(p) {
    const html = this._preview(p);
    const day = this.shadowRoot.getElementById("preview");
    const hint = this.shadowRoot.getElementById("hint");
    if (day) day.innerHTML = html.day;
    if (hint) hint.innerHTML = html.hint;
    const msg = this.shadowRoot.querySelector(".msg");
    if (msg) msg.remove();
  }

  _set(path, value) {
    const d = this._draft;
    if (path.startsWith("days.")) d.days[path.slice(5)] = value; else d[path] = value;
    this._dirty = true;
    this._msg = null;
    this._sig = "";
  }

  _bind(p) {
    const root = this.shadowRoot;
    const rerender = () => { this._sig = ""; this._render(); };
    // selects change the form's structure; text fields only the preview (and "end" with the dose count)
    root.querySelectorAll("select[data-f]").forEach((el) => el.addEventListener("change", () => { this._set(el.dataset.f, el.value); rerender(); }));
    root.querySelectorAll("input[data-f]").forEach((el) => {
      const upd = () => {
        const structural = el.dataset.f === "count" && (Number(el.value) > 1) !== !!root.querySelector('[data-f="end"]');
        this._set(el.dataset.f, el.value);
        this._sig = "";
        this._refreshPreview(p);
        return structural;
      };
      el.addEventListener("input", upd);
      el.addEventListener("change", () => { if (upd()) rerender(); });
    });
    root.querySelectorAll("[data-t]").forEach((el) => {
      const upd = () => {
        this._draft.times[Number(el.dataset.t)][el.dataset.k] = el.dataset.k === "ml" ? num(el.value) : el.value;
        this._dirty = true;
        this._msg = null;
        this._sig = "";
        this._refreshPreview(p);
      };
      el.addEventListener("input", upd);
      el.addEventListener("change", upd);
    });
    root.querySelectorAll("[data-wd]").forEach((el) => el.addEventListener("change", () => {
      const set = new Set(this._draft.days.weekdays);
      if (el.checked) set.add(el.dataset.wd); else set.delete(el.dataset.wd);
      this._draft.days.weekdays = WEEKDAYS.filter((w) => set.has(w));
      this._dirty = true;
      rerender();
    }));
    root.querySelectorAll("[data-act]").forEach((el) => el.addEventListener("click", async () => {
      const act = el.dataset.act;
      if (["addtime", "del"].includes(act)) this._dirty = true;
      if (act === "addtime") { const last = this._draft.times[this._draft.times.length - 1]; this._draft.times.push({ time: last ? hmText(Math.min(1435, hm(last.time) + 60)) : "12:00", ml: last ? last.ml : 1 }); }
      if (act === "del") this._draft.times.splice(Number(el.dataset.i), 1);
      if (act === "reset") { this._draft = null; this._dirty = false; this._msg = null; }
      if (act === "save") {
        el.disabled = true;
        try {
          await call(this._hass, "set_schedule", { device_id: p.device_id, schedule: this._document() });
          this._msg = { text: t(this._hass, "saved") };
          this._draft = null;
          this._dirty = false;
        } catch (err) {
          this._msg = { text: errText(err), err: true };
        }
      }
      rerender();
    }));
  }
}

const SCHEDULE_CSS = `
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--pc); }
  .day { margin-bottom: 12px; }
  .track { position: relative; height: 28px; border-radius: 8px; background: var(--secondary-background-color, rgba(127,127,127,.12)); }
  .track i { position: absolute; top: 4px; width: 3px; height: 20px; margin-left: -1px; border-radius: 2px; }
  .track i.now { background: var(--pc); opacity: .45; }
  .track i.draft { background: var(--pc); top: 8px; height: 12px; }
  .track .cursor { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--error-color); }
  .ticks { display: flex; justify-content: space-between; font-size: .75rem; color: var(--secondary-text-color); margin: 2px 0 4px; }
  .form { display: flex; flex-direction: column; gap: 8px; }
  .form label { display: flex; flex-direction: column; gap: 3px; font-size: .85rem; color: var(--secondary-text-color); }
  .form label > select, .form label > input { color: var(--primary-text-color); font-size: 1rem; }
  .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; }
  .grid2 input { width: auto; }
  .wd { display: flex; flex-wrap: wrap; gap: 6px; }
  .chk { flex-direction: row !important; align-items: center; gap: 4px !important; color: var(--primary-text-color) !important; }
  .actions { justify-content: flex-end; }
`;

// -- history card ------------------------------------------------------------------------------

class LgalDoserHistoryCard extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: "open" }); this._data = null; this._loading = false; this._at = 0; }
  setConfig(config) { this._config = { days: 14, ...config }; this._days = Number(this._config.days) || 14; this._data = null; if (this._hass) this._load(); }
  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first || Date.now() - this._at > 10 * 60 * 1000) this._load(); else if (!this.shadowRoot.innerHTML) this._render();
  }
  getCardSize() { return 5; }
  static getStubConfig() { return { days: 14 }; }
  static getConfigForm() {
    return {
      schema: [
        { name: "device", selector: { device: { integration: DOMAIN } } },
        { name: "days", default: 14, selector: { select: { options: ["7", "14", "30", "60"] } } },
        { name: "title", selector: { text: {} } },
      ],
      computeLabel: (s) => ({ device: "Doser or pump (optional)", days: "Days", title: "Title" })[s.name],
    };
  }

  async _load() {
    const hass = this._hass;
    const d = pickDoser(hass, this._config.device);
    if (!d || !d.controller || this._loading) { this._render(); return; }
    this._loading = true;
    this._at = Date.now();
    try {
      this._data = await callResponse(hass, "get_daily_history", { device_id: d.controller, days: this._days });
      this._err = null;
    } catch (err) {
      this._err = errText(err);
    }
    this._loading = false;
    this._render();
  }

  _render() {
    const hass = this._hass;
    const d = pickDoser(hass, this._config.device);
    if (!d) { this.shadowRoot.innerHTML = `<style>${BASE_CSS}</style><ha-card><div class="muted">${esc(t(hass, "none"))}</div></ha-card>`; return; }
    const onlyPump = (() => { for (const p of d.pumps.values()) if (p.device_id === this._config.device) return p.n; return null; })();
    const data = this._data;
    let pumps = data ? data.pumps || [] : [];
    if (onlyPump) pumps = pumps.filter((n) => n === onlyPump);
    if (Array.isArray(this._config.pumps) && this._config.pumps.length) pumps = pumps.filter((n) => this._config.pumps.map(Number).includes(n));
    const days = data ? data.days || [] : [];
    const W = 600, H = 180, L = 36, B = 22, T = 8;
    const totals = days.map((day) => pumps.reduce((a, n) => a + (day.ml[n - 1] || 0), 0));
    const max = Math.max(1, ...days.map((day) => Math.max(0, ...pumps.map((n) => day.ml[n - 1] || 0))));
    const step = Math.pow(10, Math.floor(Math.log10(max)));
    const top = Math.ceil(max / step) * step;
    const gw = (W - L) / Math.max(1, days.length);
    const bw = Math.max(2, (gw * 0.8) / Math.max(1, pumps.length));
    const y = (v) => T + (H - T - B) * (1 - v / top);
    const loc = hass?.locale?.language || undefined;
    const todayIso = localDate();
    const bars = days.map((day, i) => pumps.map((n, k) => {
      const v = day.ml[n - 1] || 0;
      const x = L + i * gw + gw * 0.1 + k * bw;
      const name = (data.names && data.names[String(n)]) || t(hass, "pump", { n });
      return `<rect x="${x.toFixed(1)}" y="${y(v).toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${(H - B - y(v)).toFixed(1)}" rx="1.5" fill="${color(hass, n)}">
        <title>${esc(day.date)} · ${esc(name)}: ${fmt(v, 2)} ml, ${day.doses[n - 1]} × ${day.skipped[n - 1] ? `, ${day.skipped[n - 1]} ⨯` : ""}</title></rect>`;
    }).join("")).join("");
    const labelEvery = Math.ceil(days.length / 8);
    const labels = days.map((day, i) => (i % labelEvery === 0 || i === days.length - 1)
      ? `<text x="${(L + i * gw + gw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${day.date === todayIso ? esc(t(hass, "todayShort")) : esc(new Date(`${day.date}T12:00:00`).toLocaleDateString(loc, { day: "numeric", month: "numeric" }))}</text>` : "").join("");
    const grid = [0, 0.5, 1].map((f) => `<line x1="${L}" x2="${W}" y1="${y(top * f)}" y2="${y(top * f)}"/><text x="${L - 4}" y="${y(top * f) + 4}" text-anchor="end">${fmt(top * f, 1)}</text>`).join("");
    this.shadowRoot.innerHTML = `
      <style>${BASE_CSS}
        svg { width: 100%; height: auto; display: block; }
        svg text { font-size: 11px; fill: var(--secondary-text-color); }
        svg line { stroke: var(--divider-color); }
        .legend { display: flex; flex-wrap: wrap; gap: 10px; font-size: .85rem; margin-top: 6px; }
        .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; }
        .range { display: flex; gap: 6px; margin-left: auto; }
        .range button.on { border-color: var(--primary-color); color: var(--primary-color); }
      </style>
      <ha-card>
        <div class="title">${esc(this._config.title || t(hass, "history"))}
          <div class="range">${[7, 14, 30, 60].map((n) => `<button class="btn small ${n === this._days ? "on" : ""}" data-days="${n}">${n}</button>`).join("")}</div></div>
        ${this._err ? `<div class="msg err">${esc(this._err)}</div>` : ""}
        ${!data ? `<div class="muted">…</div>` : !days.length || !totals.some((x) => x > 0) ? `<div class="muted">${esc(t(hass, "noData"))}</div>` : `
          <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t(hass, "history"))}">${grid}${bars}${labels}</svg>`}
        <div class="legend">${pumps.map((n) => `<span><i style="background:${color(hass, n)}"></i>${esc((data && data.names && data.names[String(n)]) || t(hass, "pump", { n }))}: ${fmt(days.reduce((a, day) => a + (day.ml[n - 1] || 0), 0), 1)} ml</span>`).join("")}</div>
      </ha-card>`;
    this.shadowRoot.querySelectorAll("[data-days]").forEach((el) => el.addEventListener("click", () => { this._days = Number(el.dataset.days); this._load(); }));
  }
}

// -- registration ------------------------------------------------------------------------------

const CARDS = [
  ["lgal-doser-card", LgalDoserCard, "LGAL Doser", "Overview of the pumps of an LG Aquatic Life doser, with dose, prime, container, boost and calibration."],
  ["lgal-doser-schedule-card", LgalDoserScheduleCard, "LGAL Doser schedule", "Edit the schedule of one pump."],
  ["lgal-doser-history-card", LgalDoserHistoryCard, "LGAL Doser history", "Dosed amount per day and pump."],
];
window.customCards = window.customCards || [];
for (const [tag, cls, name, description] of CARDS) {
  if (!customElements.get(tag)) customElements.define(tag, cls);
  if (!window.customCards.some((c) => c.type === tag)) window.customCards.push({ type: tag, name, description, preview: false });
}
console.info(`%c LG Aquatic Life cards %c ${VERSION} `, "background:#0d263b;color:#d69f31;font-weight:bold", "background:#3595a2;color:#fff");
})();
