/*
 * SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Dashboard cards of the LG Aquatic Life integration (plain web components, no build step).
 * Colours, surfaces and controls come from the Home Assistant theme.
 *
 *   type: custom:lgal-doser-card               Overview: one graduated container per pump (level,
 *   device: <doser or pump device id>          ml scale, range, today, next dose). Tapping a pump
 *   pumps: [1, 2]                              opens a dialog with tabs for dosing, schedule, boost,
 *   title: Dosing                              calibration, pump settings and device settings.
 *   show_controls / show_scale / show_amount / show_days_left / show_today / show_next: true
 *
 *   Each tab is also a card of its own, for one pump (device: the pump device, or the doser plus
 *   "pump: 2"; without either the first pump of the first doser):
 *   type: custom:lgal-doser-manual-card        manual dose (amount, speed), prime by holding, stop
 *   type: custom:lgal-doser-schedule-card      dosing schedule: 24 h bar, wizards, editor, days
 *   type: custom:lgal-doser-boost-card         boost over days or doses
 *   type: custom:lgal-doser-calibration-card   calibration wizard
 *   type: custom:lgal-doser-pump-settings-card name, mode, speed, limit, container, tube, …
 *   type: custom:lgal-doser-device-card        (doser) LED night mode, lock times, restart, firmware
 *   type: custom:lgal-doser-history-card       dosed ml per day and pump (7/14/30/60 days)
 *
 * The cards find the entities through the entity registry (platform + translation key), so renamed
 * entity ids keep working. Actions go through the integration's actions (lg_aquatic_life.*) and the
 * entities' own actions (number.set_value, select.select_option, …).
 */

(() => {
const DOMAIN = "lg_aquatic_life";
const VERSION = "0.2.0";
const TIERS = ["slow", "medium", "fast"];
const MODES = ["auto", "manual_only", "disabled"];
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const MIN_DOSE = 0.02;
const MAX_TIMES = 24;
const MAX_SPREAD = 96;
const FIELDS = new Set(["INPUT", "SELECT", "TEXTAREA"]);
const SERIES = ["#4269d0", "#efb118", "#ff725c", "#6cc5b0", "#a463f2"]; // used when the theme has no graph colours
let LOCALE;

// -- texts -------------------------------------------------------------------------------------

const TEXTS = {
  en: {
    pump: "Pump {n}", none: "No LGAL Doser found. Add it with the LG Aquatic Life integration.",
    choosePump: "Choose a pump in the card settings.", unavailable: "unavailable", done: "Done.", saved: "Saved.",
    cancel: "Cancel", close: "Close", apply: "Apply", ml: "ml", min: "min", stop: "Stop", stopAll: "Stop all",
    // overview
    lastsDays: "lasts about {n} days", today: "today {done} / {target} ml", next: "next: {when}", noNext: "no dose planned",
    notTracked: "container not tracked", liveDown: "Live connection lost", supply_problem: "24 V supply missing or too low",
    clock_problem: "Clock not set", boostOn: "Boost running",
    auto: "Automatic", manual_only: "Manual only", disabled: "Off",
    dosing: "Dosing", priming: "Priming", calibrating: "Calibration run",
    driver_fault: "Driver fault in the last run", daily_limit_reached: "Daily limit reached",
    container_low: "Container almost empty", container_warning: "Container running low",
    calibration_due: "Calibrate again", tube_worn: "Tube worn", skipped: "{n} dose(s) skipped today",
    tabDose: "Dose", tabSchedule: "Schedule", tabBoost: "Boost", tabCalibration: "Calibration", tabSettings: "Pump", tabDevice: "Device",
    // manual
    manualTitle: "Manual dosing", amount: "Amount", speed: "Speed", slow: "Slow", medium: "Medium", fast: "Fast",
    doseBtn: "Dose…", confirmTitle: "Start manual dosing?", confirmText: "Dose {ml} ml at {speed} speed. The pump starts right away.",
    start: "Start", runningDose: "Dosing: {done} of {target} ml", runningPrime: "Filling the tube …",
    runningCal: "Calibration run: {done} of {target} ml", queued: "A manual dose waits for the end of a lock time.",
    pumpOff: "The pump is off (mode). Set it to automatic or manual only to dose.",
    usedToday: "Dosed today {used} ml", limit: "daily limit {limit} ml",
    primeTitle: "Fill the tube", primeBtn: "Hold to prime", primeHint: "Runs while you hold the button (at most 60 s).",
    invalidAmount: "Amount: at least 0.02 ml",
    // schedule
    scheduleTitle: "Dosing schedule", unsaved: "Unsaved changes", wizardNew: "New schedule…", wizardTotal: "Adjust total amount…",
    wizardCount: "Change number of doses…", edit: "Edit…", activeOn: "Active on", reload: "Reload", saveSchedule: "Save schedule",
    wd: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"], doseOne: "dose", doseMany: "doses", dailyTotal: "Total per day",
    summaryNone: "No schedule – the pump only doses by hand.", summaryEmpty: "The schedule is not complete yet.",
    varied: "varying amounts ({a}–{b} ml)", each: "{ml} ml each", everyN: "every {n} days from {date}", daily: "daily",
    afterPowerCut: "After a power cut", skip_missed: "skip missed doses", catch_up_window: "catch up within {n} min",
    skipMissedLong: "Skip missed doses", catchUpLong: "Catch up", catchUpWithin: "Catch up within",
    editTitle: "Edit schedule", kind: "Kind", kindSpread: "Spread a daily amount", kindTimes: "Single times", kindNone: "No schedule",
    dailyAmount: "Daily amount", doseCount: "Number of doses", firstDose: "First dose", lastDose: "Last dose",
    addDose: "Add dose", remove: "Remove", days: "Days", daysDaily: "Daily", daysWeekdays: "Weekdays", daysInterval: "Every N days",
    every: "Every", daysUnit: "days", from: "from", doneBtn: "Done",
    newTitle: "New schedule", newHint: "Spreads the total amount evenly. Without an end time the doses are spread over the whole day.",
    totalAmount: "Total amount", startTime: "Start time", useEnd: "Spread up to an end time", endTime: "End time",
    totalTitle: "Adjust total daily amount", totalHint: "Scales every dose so the total matches; times and count stay.",
    currentTotal: "Current total", newTotal: "New total",
    countTitle: "Change number of doses", countHint: "Spreads the doses evenly again; the total amount stays.",
    splitEven: "= {n}× {ml} ml", splitMixed: "= {a}× {ma} ml + {b}× {mb} ml",
    pCount: "Number of doses: 1–{max}", pTime: "Invalid time", pEnd: "The last dose must be after the first",
    pAmount: "At least 0.02 ml per dose", pDup: "Two doses at the same time", pWeekdays: "Choose at least one weekday",
    pEvery: "Every 1–30 days", pAnchor: "Invalid start date", pCatch: "Catch up: 0–1440 min", needsDoses: "Add a dose first.",
    todayBar: "Today on the device: {ml} ml", draftBar: "Draft: {ml} ml per day",
    // boost
    boostTitle: "Boost", boostRunning: "Boost running: {rest} of {total} ml left", boostEnd: "ends {when}",
    boostDosesLeft: "{n} doses left, ≈ {ml} ml extra each", boostToday: "{ml} ml of it today", boostPaused: "Paused – the pump is not on automatic.",
    endBoost: "End boost", boostAmount: "Extra amount", spreadOver: "Spread over", byDays: "Days", byDoses: "Doses",
    perDayPrev: "≈ {ml} ml extra per day", perDosePrev: "≈ {ml} ml extra per dose", startBoost: "Start boost",
    boostNoSchedule: "A boost needs a schedule.", boostNotAuto: "The pump is not on automatic – no boost possible.",
    boostCount: "Days: 1–30, doses: 1–100",
    // calibration
    calTitle: "Calibration", calOk: "Calibrated on {when}", calNever: "Not calibrated yet", calDue: "Calibration due.",
    calTube: "New tube – please calibrate again.", calStep1: "Fill the tube", calStep2: "Put the outlet into a measuring cup",
    calStep3: "Run the calibration", calTarget: "Target amount", calStart: "Start calibration run",
    calMeasuredQ: "How much is in the measuring cup?", calMeasured: "Measured", calApply: "Apply", calDiscard: "Discard",
    calRate: "{v} ml per revolution",
    // settings
    settingsTitle: "Pump settings", name: "Name", mode: "Mode", dailyLimit: "Daily limit", zeroOff: "0 = off",
    container: "Container", capacity: "Size", capacityHint: "0 = do not track", content: "Content", refilled: "Refilled",
    warnDays: "Warning below", lowDays: "Alarm below", daysRange: "days of range", zeroDefault: "0 = default ({n})",
    remind: "Calibration reminder", remindOff: "Off", months: "{n} months", tube: "Tube", tubeHours: "{h} of {limit} h",
    tubeReplaced: "Tube replaced…", tubeConfirm: "Reset the tube's running time to 0? Calibrate the pump afterwards.",
    advanced: "Advanced", direction: "Direction", cw: "Clockwise", ccw: "Counter-clockwise", retract: "Anti-drip retract",
    off: "Off", global: "Default", own: "Own value", retractRev: "Revolutions", confirm: "Confirm",
    // device
    deviceTitle: "Doser", ledNight: "Status LED night mode", ledFrom: "From", ledTo: "To", brightness: "Brightness",
    locks: "Lock times", locksHint: "Minimum gap between the doses of two pumps.", manualInLock: "Manual dose during a lock time",
    reject: "Reject", queue: "Wait", addRule: "Add rule", gap: "gap", saveLocks: "Save lock times", noRules: "No rules.",
    pSamePump: "Choose two different pumps", pGap: "Gap: 1–1440 min",
    firmware: "Firmware", installed: "Installed {v}", latest: "available {v}", upToDate: "up to date", details: "Details…",
    restart: "Restart…", restartConfirm: "Restart the doser now? Running doses stop.", on: "On",
    // history
    history: "History", noData: "No data yet.", todayShort: "today",
  },
  de: {
    pump: "Pumpe {n}", none: "Kein LGAL Doser gefunden. Füge ihn mit der Integration LG Aquatic Life hinzu.",
    choosePump: "Wähle in den Karteneinstellungen eine Pumpe.", unavailable: "nicht verfügbar", done: "Erledigt.", saved: "Gespeichert.",
    cancel: "Abbrechen", close: "Schließen", apply: "Übernehmen", ml: "ml", min: "min", stop: "Stopp", stopAll: "Alle stoppen",
    lastsDays: "reicht noch ~{n} Tage", today: "heute {done} / {target} ml", next: "nächste: {when}", noNext: "keine Dosis geplant",
    notTracked: "Behälter nicht verfolgt", liveDown: "Live-Verbindung getrennt", supply_problem: "24-V-Versorgung fehlt oder zu niedrig",
    clock_problem: "Uhrzeit nicht gestellt", boostOn: "Boost läuft",
    auto: "Automatisch", manual_only: "Nur manuell", disabled: "Aus",
    dosing: "Dosiert", priming: "Ansaugen", calibrating: "Kalibrierlauf",
    driver_fault: "Treiberfehler im letzten Lauf", daily_limit_reached: "Tageslimit erreicht",
    container_low: "Behälter fast leer", container_warning: "Behälter wird knapp",
    calibration_due: "Neu kalibrieren", tube_worn: "Schlauch verschlissen", skipped: "{n} Dosis/Dosen heute übersprungen",
    tabDose: "Dosieren", tabSchedule: "Zeitplan", tabBoost: "Boost", tabCalibration: "Kalibrierung", tabSettings: "Pumpe", tabDevice: "Gerät",
    manualTitle: "Manuelle Dosierung", amount: "Menge", speed: "Geschwindigkeit", slow: "Langsam", medium: "Mittel", fast: "Schnell",
    doseBtn: "Dosieren…", confirmTitle: "Manuelle Dosierung starten?", confirmText: "{ml} ml mit Geschwindigkeit „{speed}“ dosieren. Die Pumpe startet sofort.",
    start: "Starten", runningDose: "Dosiert: {done} von {target} ml", runningPrime: "Schlauch wird gefüllt …",
    runningCal: "Kalibrierlauf: {done} von {target} ml", queued: "Eine manuelle Dosis wartet auf das Ende einer Sperrzeit.",
    pumpOff: "Die Pumpe ist aus (Betriebsart). Zum Dosieren auf Automatisch oder Nur manuell stellen.",
    usedToday: "Heute dosiert {used} ml", limit: "Tageslimit {limit} ml",
    primeTitle: "Schlauch füllen", primeBtn: "Gedrückt halten zum Ansaugen", primeHint: "Läuft, solange du die Taste hältst (höchstens 60 s).",
    invalidAmount: "Menge: mindestens 0,02 ml",
    scheduleTitle: "Dosierplan", unsaved: "Ungespeicherte Änderungen", wizardNew: "Neuer Zeitplan…", wizardTotal: "Gesamtmenge anpassen…",
    wizardCount: "Anzahl Dosierungen ändern…", edit: "Bearbeiten…", activeOn: "Aktiv an", reload: "Neu laden", saveSchedule: "Plan speichern",
    wd: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"], doseOne: "Dosierung", doseMany: "Dosierungen", dailyTotal: "Gesamt pro Tag",
    summaryNone: "Kein Zeitplan – die Pumpe dosiert nur von Hand.", summaryEmpty: "Der Zeitplan ist noch nicht vollständig.",
    varied: "unterschiedliche Mengen ({a}–{b} ml)", each: "je {ml} ml", everyN: "alle {n} Tage ab {date}", daily: "täglich",
    afterPowerCut: "Nach Stromausfall", skip_missed: "verpasste Dosen auslassen", catch_up_window: "innerhalb von {n} min nachholen",
    skipMissedLong: "Verpasste auslassen", catchUpLong: "Nachholen", catchUpWithin: "Nachholen innerhalb",
    editTitle: "Zeitplan bearbeiten", kind: "Art", kindSpread: "Tagesmenge verteilen", kindTimes: "Einzelzeiten", kindNone: "Kein Plan",
    dailyAmount: "Tagesmenge", doseCount: "Anzahl Dosierungen", firstDose: "Erste Dosis", lastDose: "Letzte Dosis",
    addDose: "Dosierung hinzufügen", remove: "Entfernen", days: "Tage", daysDaily: "Täglich", daysWeekdays: "Wochentage", daysInterval: "Alle N Tage",
    every: "Alle", daysUnit: "Tage", from: "ab", doneBtn: "Fertig",
    newTitle: "Neuen Zeitplan erstellen", newHint: "Verteilt die Gesamtmenge gleichmäßig. Ohne Endzeit werden die Dosierungen über den ganzen Tag verteilt.",
    totalAmount: "Gesamtmenge", startTime: "Startzeit", useEnd: "Bis zu einer Endzeit verteilen", endTime: "Endzeit",
    totalTitle: "Gesamte Tagesmenge anpassen", totalHint: "Skaliert jede Dosis, sodass die Summe passt – Uhrzeiten und Anzahl bleiben.",
    currentTotal: "Aktuelle Gesamtmenge", newTotal: "Neue Gesamtmenge",
    countTitle: "Anzahl der Dosierungen ändern", countHint: "Verteilt die Dosierungen gleichmäßig neu, die Gesamtmenge bleibt gleich.",
    splitEven: "= {n}× {ml} ml", splitMixed: "= {a}× {ma} ml + {b}× {mb} ml",
    pCount: "Anzahl Dosierungen: 1–{max}", pTime: "Ungültige Uhrzeit", pEnd: "Die letzte Dosis muss nach der ersten liegen",
    pAmount: "Mindestens 0,02 ml pro Dosis", pDup: "Zwei Dosierungen zur selben Uhrzeit", pWeekdays: "Mindestens einen Wochentag wählen",
    pEvery: "Alle 1–30 Tage", pAnchor: "Ungültiges Startdatum", pCatch: "Nachholen: 0–1440 min", needsDoses: "Zuerst eine Dosierung anlegen.",
    todayBar: "Heute am Gerät: {ml} ml", draftBar: "Entwurf: {ml} ml pro Tag",
    boostTitle: "Boost", boostRunning: "Boost läuft: noch {rest} von {total} ml", boostEnd: "endet {when}",
    boostDosesLeft: "noch {n} Dosen, je ≈ {ml} ml extra", boostToday: "davon heute {ml} ml", boostPaused: "Pausiert – die Pumpe steht nicht auf Automatisch.",
    endBoost: "Boost beenden", boostAmount: "Zusatzmenge", spreadOver: "Verteilen über", byDays: "Tage", byDoses: "Dosierungen",
    perDayPrev: "≈ {ml} ml extra pro Tag", perDosePrev: "≈ {ml} ml extra pro Dosis", startBoost: "Boost starten",
    boostNoSchedule: "Ein Boost braucht einen Zeitplan.", boostNotAuto: "Die Pumpe steht nicht auf Automatisch – kein Boost möglich.",
    boostCount: "Tage: 1–30, Dosierungen: 1–100",
    calTitle: "Kalibrierung", calOk: "Kalibriert am {when}", calNever: "Noch nicht kalibriert", calDue: "Kalibrierung fällig.",
    calTube: "Neuer Schlauch – bitte neu kalibrieren.", calStep1: "Schlauch füllen", calStep2: "Auslass in einen Messbecher halten",
    calStep3: "Kalibrierlauf starten", calTarget: "Zielmenge", calStart: "Kalibrierlauf starten",
    calMeasuredQ: "Wie viel ist im Messbecher?", calMeasured: "Gemessen", calApply: "Übernehmen", calDiscard: "Verwerfen",
    calRate: "{v} ml pro Umdrehung",
    settingsTitle: "Pumpeneinstellungen", name: "Name", mode: "Betriebsart", dailyLimit: "Tageslimit", zeroOff: "0 = aus",
    container: "Behälter", capacity: "Größe", capacityHint: "0 = nicht verfolgen", content: "Inhalt", refilled: "Aufgefüllt",
    warnDays: "Warnung unter", lowDays: "Alarm unter", daysRange: "Tage Reichweite", zeroDefault: "0 = Standard ({n})",
    remind: "Kalibrier-Erinnerung", remindOff: "Aus", months: "{n} Monate", tube: "Schlauch", tubeHours: "{h} von {limit} h",
    tubeReplaced: "Schlauch gewechselt…", tubeConfirm: "Die Laufzeit des Schlauchs auf 0 setzen? Danach die Pumpe neu kalibrieren.",
    advanced: "Erweitert", direction: "Drehrichtung", cw: "Im Uhrzeigersinn", ccw: "Gegen den Uhrzeigersinn", retract: "Rückzug gegen Nachtropfen",
    off: "Aus", global: "Standard", own: "Eigener Wert", retractRev: "Umdrehungen", confirm: "Bestätigen",
    deviceTitle: "Doser", ledNight: "Nachtmodus der Status-LED", ledFrom: "Von", ledTo: "Bis", brightness: "Helligkeit",
    locks: "Sperrzeiten", locksHint: "Mindestabstand zwischen den Dosierungen zweier Pumpen.", manualInLock: "Manuelle Dosis in einer Sperrzeit",
    reject: "Ablehnen", queue: "Warten", addRule: "Regel hinzufügen", gap: "Abstand", saveLocks: "Sperrzeiten speichern", noRules: "Keine Regeln.",
    pSamePump: "Zwei verschiedene Pumpen wählen", pGap: "Abstand: 1–1440 min",
    firmware: "Firmware", installed: "Installiert {v}", latest: "verfügbar {v}", upToDate: "aktuell", details: "Details…",
    restart: "Neu starten…", restartConfirm: "Den Doser jetzt neu starten? Laufende Dosierungen stoppen.", on: "An",
    history: "Historie", noData: "Noch keine Daten.", todayShort: "heute",
  },
};

const langOf = (hass) => ((hass && ((hass.locale && hass.locale.language) || hass.language)) || "en").startsWith("de") ? "de" : "en";
function t(hass, key, vars) {
  const table = TEXTS[langOf(hass)];
  let s = key in table ? table[key] : key in TEXTS.en ? TEXTS.en[key] : key;
  if (vars && typeof s === "string") for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

// -- small helpers -----------------------------------------------------------------------------

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const parse = (v) => num(String(v ?? "").trim().replace(",", "."));
const fmt = (v, max = 2, min = 0) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "–"
  : Number(v).toLocaleString(LOCALE, { maximumFractionDigits: max, minimumFractionDigits: min }));
const round2 = (v) => Math.round(v * 100) / 100;
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const validTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s || "");
const hm = (s) => { const [h, m] = String(s || "0:0").split(":").map(Number); return h * 60 + m; };
const hmText = (min) => { const w = ((Math.round(min) % 1440) + 1440) % 1440; return `${String(Math.floor(w / 60)).padStart(2, "0")}:${String(w % 60).padStart(2, "0")}`; };
const seriesColor = (n) => `var(--graph-color-${n}, ${SERIES[(n - 1) % SERIES.length]})`;
const isTouch = () => !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);

function fmtTime(iso) {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  const time = d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString(LOCALE, { weekday: "short", day: "numeric", month: "numeric" })} ${time}`;
}
function fmtDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "–" : d.toLocaleDateString(LOCALE, { day: "numeric", month: "numeric", year: "numeric" });
}

// -- finding the doser and its pumps -----------------------------------------------------------

let registryCache = { src: null, states: null, value: null };
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

/** The pump of a config: a pump device, the doser plus "pump", or (nothing set) the first pump. */
function pickPump(hass, config) {
  const d = pickDoser(hass, config.device);
  if (!d) return null;
  for (const p of d.pumps.values()) if (p.device_id === config.device) return p;
  if (config.pump) return d.pumps.get(Number(config.pump)) || null;
  if (!config.device) return [...d.pumps.values()].sort((a, b) => a.n - b.n)[0] || null;
  return null;
}

const st = (hass, eid) => (eid ? hass.states[eid] : undefined);
const val = (hass, eid) => { const s = st(hass, eid); return s && !["unknown", "unavailable"].includes(s.state) ? s.state : null; };
const attr = (hass, eid, key) => st(hass, eid)?.attributes?.[key];
const isOn = (hass, eid) => val(hass, eid) === "on";
const usable = (hass, eid) => { const s = st(hass, eid); return !!s && s.state !== "unavailable"; };

function pumpName(hass, p) {
  const name = val(hass, p.ents.name);
  return name && name.trim() ? name.trim() : t(hass, "pump", { n: p.n });
}

function call(hass, service, data) {
  return hass.callService(DOMAIN, service, data);
}
async function callResponse(hass, service, data) {
  const r = await hass.callWS({ type: "call_service", domain: DOMAIN, service, service_data: data, return_response: true });
  return r && r.response;
}
function setEntity(hass, eid, value) {
  const domain = eid.split(".")[0];
  if (domain === "number") return hass.callService("number", "set_value", { entity_id: eid, value });
  if (domain === "select") return hass.callService("select", "select_option", { entity_id: eid, option: value });
  if (domain === "text") return hass.callService("text", "set_value", { entity_id: eid, value });
  if (domain === "switch") return hass.callService("switch", value ? "turn_on" : "turn_off", { entity_id: eid });
  if (domain === "time") return hass.callService("time", "set_value", { entity_id: eid, time: value.length === 5 ? `${value}:00` : value });
  if (domain === "button") return hass.callService("button", "press", { entity_id: eid });
  return Promise.reject(new Error(`cannot set ${eid}`));
}
function errText(err) {
  return (err && (err.message || err.error || (err.body && err.body.message))) || String(err);
}

/** Like the firmware: daily amount in N doses evenly on the grid, the remainder on the first doses. */
function spreadSlots(s, grid) {
  const n = Number(s.count);
  if (!Number.isInteger(n) || n < 1 || n > MAX_SPREAD || !(Number(s.ml) > 0) || !validTime(s.start)) return [];
  if (n > 1 && (!validTime(s.end) || hm(s.end) <= hm(s.start))) return [];
  const ul = Math.round(Number(s.ml) * 1000);
  const start = hm(s.start);
  const end = n > 1 ? hm(s.end) : start;
  const base = Math.floor(ul / n);
  const rest = ul % n;
  const out = [];
  for (let i = 0; i < n; i++) {
    const m = n > 1 ? start + Math.floor((2 * i * (end - start) + (n - 1) * grid) / (2 * (n - 1) * grid)) * grid : start;
    out.push({ time: hmText(m), ml: (base + (i < rest ? 1 : 0)) / 1000 });
  }
  return out;
}

/** Splits a total into "count" amounts with two decimals that add up exactly. */
function splitTotal(total, count) {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const extra = cents - base * count;
  const amounts = [];
  for (let i = 0; i < count; i++) amounts.push((base + (i < extra ? 1 : 0)) / 100);
  return { amounts, base, extra };
}

// -- shared styles -----------------------------------------------------------------------------

const BASE_CSS = `
  :host { display: block; }
  ha-card { padding: 16px; height: 100%; box-sizing: border-box; }
  .hdr { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .hdr .title { font-size: 1.15em; font-weight: 500; color: var(--primary-text-color); }
  .card { display: flex; flex-direction: column; gap: 10px; color: var(--primary-text-color); }
  .none { color: var(--secondary-text-color); text-align: center; padding: 8px; }
  .muted { color: var(--secondary-text-color); }
  .small { font-size: .85em; }
  .spacer { flex: 1; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 36px; flex-wrap: wrap; }
  .row > .lbl { display: flex; flex-direction: column; gap: 1px; }
  .row > .lbl small { color: var(--secondary-text-color); font-size: .8em; }
  .ctl { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; margin-left: auto; }
  .section { font-weight: 500; margin-top: 8px; padding-top: 12px; border-top: 1px solid var(--divider-color, rgba(127,127,127,.3)); }
  .section:first-child { border-top: none; padding-top: 0; margin-top: 0; }
  input, select {
    font: inherit; color: var(--primary-text-color); background: transparent; min-width: 0; box-sizing: border-box;
    border: 1px solid var(--divider-color, rgba(127,127,127,.4)); border-radius: 8px; padding: 6px 8px;
  }
  input:focus, select:focus { outline: none; border-color: var(--primary-color); }
  input.bad { border-color: var(--error-color); }
  select option { background: var(--card-background-color, #fff); color: var(--primary-text-color); }
  input.num { width: 6.5em; text-align: right; }
  input.short { width: 4.5em; text-align: right; }
  input[type=time] { width: 7.2em; }
  input[type=checkbox] { width: 18px; height: 18px; accent-color: var(--primary-color); }
  .unit { color: var(--secondary-text-color); font-size: .9em; min-width: 1.6em; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
  .chip {
    font: inherit; font-size: .9em; border: 1px solid var(--divider-color, rgba(127,127,127,.5)); border-radius: 16px;
    padding: 4px 12px; background: none; color: var(--primary-text-color); cursor: pointer; line-height: 1.4;
  }
  .chip.on { background: var(--primary-color); border-color: var(--primary-color); color: var(--text-primary-color, #fff); }
  .chip.ro { cursor: default; }
  .chip:disabled { opacity: .45; cursor: default; }
  .link {
    font: inherit; font-size: .9em; background: none; border: 1px solid var(--divider-color, rgba(127,127,127,.5));
    border-radius: 16px; color: var(--primary-color); cursor: pointer; padding: 4px 12px;
  }
  .link:disabled { opacity: .45; cursor: default; }
  .btn {
    font: inherit; border-radius: 8px; padding: 7px 16px; cursor: pointer; background: none;
    border: 1px solid var(--divider-color, rgba(127,127,127,.5)); color: var(--primary-text-color);
  }
  .btn.primary { background: var(--primary-color); border-color: var(--primary-color); color: var(--text-primary-color, #fff); }
  .btn.danger { color: var(--error-color); border-color: var(--error-color); }
  .btn:disabled { opacity: .5; cursor: default; }
  .btn.hold { user-select: none; -webkit-user-select: none; touch-action: none; }
  .btn.hold.active { background: var(--primary-color); border-color: var(--primary-color); color: var(--text-primary-color, #fff); }
  .actions { display: flex; justify-content: flex-end; align-items: center; gap: 8px; flex-wrap: wrap; }
  .bar { height: 6px; border-radius: 3px; background: rgba(127,127,127,.3); overflow: hidden; }
  .bar > i { display: block; height: 100%; background: var(--accent-color, var(--primary-color)); transition: width .4s; }
  .status { display: flex; flex-direction: column; gap: 6px; }
  .msg { font-size: .9em; }
  .msg.err, .error { color: var(--error-color); font-size: .9em; }
  .msg.ok { color: var(--success-color, #4caf50); }
  .hint { color: var(--secondary-text-color); font-size: .9em; }
  .alert { border-radius: 8px; padding: 6px 10px; font-size: .9em; }
  .alert.err { background: color-mix(in srgb, var(--error-color) 14%, transparent); color: var(--error-color); }
  .alert.warn { background: color-mix(in srgb, var(--warning-color) 16%, transparent); color: var(--primary-text-color); }
  .badge { font-size: .8em; border-radius: 10px; padding: 2px 8px; }
  .badge.dirty { color: var(--warning-color); background: color-mix(in srgb, var(--warning-color) 15%, transparent); }
  .badge.saved { color: var(--success-color, #4caf50); background: color-mix(in srgb, var(--success-color, #4caf50) 15%, transparent); }
  dialog {
    border: none; border-radius: 16px; padding: 20px; width: min(440px, calc(100vw - 24px)); max-height: calc(100vh - 24px);
    overflow: auto; box-sizing: border-box; color: var(--primary-text-color);
    background: var(--ha-dialog-surface-background, var(--mdc-theme-surface, var(--card-background-color, #fff)));
    box-shadow: 0 8px 32px rgba(0,0,0,.35);
  }
  dialog::backdrop { background: rgba(0,0,0,.5); }
  .dtitle { font-size: 1.15em; font-weight: 500; margin-bottom: 4px; }
  .dhint { font-size: .88em; color: var(--secondary-text-color); margin-bottom: 12px; }
  .dbody { display: flex; flex-direction: column; gap: 8px; }
  .dactions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
  button.icon { background: none; border: none; color: inherit; cursor: pointer; padding: 4px; border-radius: 50%; display: inline-flex; }
  button.icon:hover { background: color-mix(in srgb, var(--primary-text-color) 8%, transparent); }
`;

// -- base class --------------------------------------------------------------------------------

/**
 * Persistent skeleton (#root for the card, #dlg for its dialog), delegated events and a render that
 * only runs when what the card shows has changed and never while someone types in the card.
 */
class LgalBase extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._sig = "";
    this._msg = null;
    this._busy = false;
    this._dialog = null;
    this._form = {};
    this.shadowRoot.innerHTML = `<style>${BASE_CSS}${this.constructor.css || ""}</style><div id="root"></div><dialog id="dlg"></dialog>`;
    this._root = this.shadowRoot.getElementById("root");
    this._dlg = this.shadowRoot.getElementById("dlg");
    this._root.addEventListener("focusout", () => setTimeout(() => { if (this._deferred) this._render(); }, 0));
    this._dlg.addEventListener("click", (ev) => { // backdrop (the dialog's own padding belongs to the dialog)
      if (ev.target !== this._dlg) return;
      const r = this._dlg.getBoundingClientRect();
      if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) this._closeDialog();
    });
    this._dlg.addEventListener("cancel", (ev) => { ev.preventDefault(); this._closeDialog(); }); // Escape
    for (const host of [this._root, this._dlg]) {
      host.addEventListener("click", (ev) => {
        const el = ev.target.closest && ev.target.closest("[data-act]");
        if (!el || !host.contains(el) || el.disabled) return;
        ev.stopPropagation();
        this._act(el.dataset.act, el, ev);
      });
      host.addEventListener("keydown", (ev) => {
        const hold = ev.target.closest && ev.target.closest("[data-hold]");
        if (hold && (ev.key === " " || ev.key === "Enter")) { if (!ev.repeat) this._holdStart(hold, ev); else ev.preventDefault(); return; }
        const el = ev.target.closest && ev.target.closest('[data-act][role="button"]');
        if (el && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); this._act(el.dataset.act, el, ev); }
      });
      host.addEventListener("keyup", (ev) => { if (ev.target.closest && ev.target.closest("[data-hold]")) this._holdStop(); });
      host.addEventListener("input", (ev) => { const el = ev.target.closest && ev.target.closest("[data-f]"); if (el) this._input(el, false); });
      host.addEventListener("change", (ev) => { const el = ev.target.closest && ev.target.closest("[data-f]"); if (el) this._input(el, true); });
      host.addEventListener("pointerdown", (ev) => { const el = ev.target.closest && ev.target.closest("[data-hold]"); if (el && !el.disabled) this._holdStart(el, ev); });
      host.addEventListener("contextmenu", (ev) => { if (ev.target.closest && ev.target.closest("[data-hold]")) ev.preventDefault(); });
    }
  }

  setConfig(config) {
    this._config = { ...(this.constructor.defaults || {}), ...(config || {}) };
    this._sig = "";
    this._configChanged();
    if (this._hass) this._render(true);
  }

  set hass(hass) {
    this._hass = hass;
    LOCALE = (hass && hass.locale && hass.locale.language) || undefined;
    this._render();
    this._hassChanged();
  }

  get hass() { return this._hass; }
  getCardSize() { return 4; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }
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

  t(key, vars) { return t(this._hass, key, vars); }
  get embedded() { return !!(this._config && this._config.embedded); }
  _pump() { return pickPump(this._hass, this._config); }
  _configChanged() {}
  _hassChanged() { if (this._dialog) this._dialogLive(); }
  _dialogLive() {}
  _title() { return null; }
  _signature() { return ""; }
  _body() { return ""; }
  _act() {}
  _input() {}

  _typing() {
    const a = this.shadowRoot.activeElement;
    return !!a && this._root.contains(a) && FIELDS.has(a.tagName);
  }

  _render(force = false) {
    if (!this._config || !this._hass) return;
    const sig = JSON.stringify([langOf(this._hass), this._signature(), this._msg, this._busy, !!this._priming]);
    if (!force && sig === this._sig) return;
    if (!force && this._typing()) { this._deferred = true; return; }
    this._deferred = false;
    this._sig = sig;
    const body = this._body();
    const msg = this._msg ? `<div class="msg ${this._msg.err ? "err" : "ok"}">${esc(this._msg.text)}</div>` : "";
    if (this.embedded) {
      this._root.innerHTML = `<div class="card embedded">${body}${msg}</div>`;
    } else {
      const title = this._title();
      this._root.innerHTML = `<ha-card>${title ? `<div class="hdr"><span class="title">${esc(title)}</span></div>` : ""}<div class="card">${body}${msg}</div></ha-card>`;
    }
  }

  _note(text, err = false) {
    this._msg = { text, err };
    this._render(true);
    if (!err) setTimeout(() => { if (this._msg && this._msg.text === text) { this._msg = null; this._render(true); } }, 3500);
  }

  async _do(fn, ok) {
    this._busy = true;
    this._msg = null;
    this._render(true);
    try {
      await fn();
      this._busy = false;
      if (ok === false) this._render(true); else this._note(ok || this.t("done"));
      return true;
    } catch (err) {
      this._busy = false;
      this._note(errText(err), true);
      return false;
    }
  }

  // dialogs: _dialogHtml() renders the content of this._dialog
  _openDialog(kind, form = {}) {
    this._dialog = kind;
    this._form = form;
    this._renderDialog();
    if (!this._dlg.open) {
      if (isTouch()) { this._dlg.setAttribute("autofocus", ""); this._dlg.tabIndex = -1; } // no keyboard popping up by itself
      this._dlg.showModal();
      if (isTouch()) this._dlg.focus({ preventScroll: true });
    }
  }
  _renderDialog() {
    if (!this._dialog) return;
    this._dlg.innerHTML = this._dialogHtml();
  }
  _dialogHtml() { return ""; }
  _closeDialog() {
    this._dialog = null;
    this._form = {};
    if (this._dlg.open) this._dlg.close();
    this._dlg.innerHTML = "";
  }

  // prime by holding: the integration keeps the device's 150 ms heartbeat, this only says "still held"
  _holdStart(el, ev) {
    ev.preventDefault();
    if (this._priming) return;
    const p = this._pump();
    if (!p) return;
    const release = () => this._holdStop();
    const timer = setInterval(() => call(this._hass, "prime", { device_id: p.device_id, action: "beat" }).catch(() => {}), 400);
    this._priming = { device_id: p.device_id, timer, release };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    this.shadowRoot.querySelectorAll("[data-hold]").forEach((b) => b.classList.add("active"));
    call(this._hass, "prime", { device_id: p.device_id, action: "start" }).catch((err) => { this._holdStop(); this._note(errText(err), true); });
  }
  _holdStop() {
    const run = this._priming;
    if (!run) return;
    this._priming = null;
    clearInterval(run.timer);
    window.removeEventListener("pointerup", run.release);
    window.removeEventListener("pointercancel", run.release);
    window.removeEventListener("blur", run.release);
    this.shadowRoot.querySelectorAll("[data-hold]").forEach((b) => b.classList.remove("active"));
    call(this._hass, "prime", { device_id: run.device_id, action: "stop" }).catch(() => {});
  }
  disconnectedCallback() { this._holdStop(); }

  _holdButton(disabled) {
    return `<button class="btn hold ${this._priming ? "active" : ""}" data-hold="1" ${disabled ? "disabled" : ""}>${esc(this.t("primeBtn"))}</button>`;
  }
  _speedChips(selected, act = "tier") {
    return `<div class="chips">${TIERS.map((k) => `<button class="chip ${k === selected ? "on" : ""}" data-act="${act}" data-v="${k}">${esc(this.t(k))}</button>`).join("")}</div>`;
  }
  _missing() {
    return `<div class="none">${esc(this.t(pickDoser(this._hass, this._config.device) ? "choosePump" : "none"))}</div>`;
  }
  _running(p) {
    const hass = this._hass;
    const e = p.ents;
    const activity = val(hass, e.activity) || "idle";
    if (activity === "idle") return "";
    const target = num(attr(hass, e.activity, "target_ml"));
    const done = num(attr(hass, e.activity, "done_ml")) ?? 0;
    const progress = num(attr(hass, e.activity, "progress"));
    const text = activity === "priming" ? this.t("runningPrime")
      : this.t(activity === "calibrating" ? "runningCal" : "runningDose", { done: fmt(done), target: fmt(target) });
    return `<div class="status">
        <div class="row"><span>${esc(text)}</span><button class="btn danger" data-act="stop">${esc(this.t("stop"))}</button></div>
        ${progress !== null ? `<div class="bar"><i style="width:${progress}%"></i></div>` : ""}
      </div>`;
  }
}

// -- overview card -----------------------------------------------------------------------------

const TABS = [
  ["dose", "tabDose", "lgal-doser-manual-card"],
  ["schedule", "tabSchedule", "lgal-doser-schedule-card"],
  ["boost", "tabBoost", "lgal-doser-boost-card"],
  ["calibration", "tabCalibration", "lgal-doser-calibration-card"],
  ["settings", "tabSettings", "lgal-doser-pump-settings-card"],
  ["device", "tabDevice", "lgal-doser-device-card"],
];

function pumpProblems(hass, p, tr) {
  const e = p.ents;
  const errors = ["driver_fault", "daily_limit_reached"].filter((k) => isOn(hass, e[k])).map((k) => tr(k));
  const warns = ["container_low", "container_warning", "calibration_due", "tube_worn"].filter((k) => isOn(hass, e[k]));
  if (warns.includes("container_low") && warns.includes("container_warning")) warns.splice(warns.indexOf("container_warning"), 1);
  const out = { errors, warns: warns.map((k) => tr(k)) };
  const skipped = num(val(hass, e.skipped_today)) || 0;
  if (skipped) out.warns.push(tr("skipped", { n: skipped }));
  return out;
}

class LgalDoserCard extends LgalBase {
  static defaults = { show_controls: true, show_scale: true, show_amount: true, show_days_left: true, show_today: true, show_next: true };

  getCardSize() { return 5; }
  static getConfigForm() {
    return {
      schema: [
        { name: "device", selector: { device: { integration: DOMAIN } } },
        { name: "title", selector: { text: {} } },
        { name: "show_controls", default: true, selector: { boolean: {} } },
        { name: "show_scale", default: true, selector: { boolean: {} } },
        { name: "show_amount", default: true, selector: { boolean: {} } },
        { name: "show_days_left", default: true, selector: { boolean: {} } },
        { name: "show_today", default: true, selector: { boolean: {} } },
        { name: "show_next", default: true, selector: { boolean: {} } },
      ],
      computeLabel: (s) => ({
        device: "Doser (optional; a pump device shows only that pump)", title: "Title (optional)",
        show_controls: "Open the pump dialog on tap", show_scale: "Show the ml scale", show_amount: "Show the amount left",
        show_days_left: "Show the range in days", show_today: "Show today's progress", show_next: "Show the next dose",
      })[s.name],
    };
  }

  _title() { return this._config.title || null; }

  _doser() { return pickDoser(this._hass, this._config.device); }

  _pumps(d) {
    let pumps = [...d.pumps.values()].sort((a, b) => a.n - b.n);
    const only = pumps.find((p) => p.device_id === this._config.device);
    if (only) return [only];
    if (Array.isArray(this._config.pumps) && this._config.pumps.length) {
      const want = this._config.pumps.map(Number);
      pumps = pumps.filter((p) => want.includes(p.n));
    }
    return pumps;
  }

  _signature() {
    const d = this._doser();
    if (!d) return "none";
    const parts = [];
    for (const p of d.pumps.values()) for (const eid of Object.values(p.ents)) { const s = this._hass.states[eid]; parts.push(s && s.state, s && s.last_updated); }
    for (const eid of Object.values(d.ents)) { const s = this._hass.states[eid]; parts.push(s && s.state); }
    parts.push(Math.floor(Date.now() / 60000)); // "next" turns from a weekday into a time at midnight
    return parts.join("|");
  }

  _body() {
    const hass = this._hass;
    const d = this._doser();
    if (!d) return `<div class="none">${esc(this.t("none"))}</div>`;
    const c = this._config;
    const pumps = this._pumps(d);
    const running = pumps.some((p) => (val(hass, p.ents.activity) || "idle") !== "idle");
    const alerts = [];
    if (d.ents.live_connection && val(hass, d.ents.live_connection) === "off") alerts.push(this.t("liveDown"));
    for (const k of ["supply_problem", "clock_problem"]) if (isOn(hass, d.ents[k])) alerts.push(this.t(k));
    const top = alerts.length || (running && c.show_controls) ? `<div class="top">
        ${alerts.map((a) => `<span class="warn-text"><ha-icon icon="mdi:alert"></ha-icon>${esc(a)}</span>`).join("")}
        <span class="spacer"></span>
        ${running && c.show_controls ? `<button class="btn danger" data-act="stopall">${esc(this.t("stopAll"))}</button>` : ""}
      </div>` : "";
    return `${top}<div class="grid ${pumps.length === 1 ? "single" : ""}">${pumps.map((p) => this._column(p)).join("")}</div>`;
  }

  _column(p) {
    const hass = this._hass;
    const c = this._config;
    const e = p.ents;
    const name = esc(pumpName(hass, p));
    if (!st(hass, e.activity) || val(hass, e.activity) === null) {
      return `<div class="pump static"><div class="name-row"><span class="name">${name}</span></div><div class="sub">${esc(this.t("unavailable"))}</div></div>`;
    }
    const mode = val(hass, e.mode);
    const activity = val(hass, e.activity) || "idle";
    const tracked = !!attr(hass, e.container_remaining, "tracked");
    const pct = tracked ? num(val(hass, e.container_level)) : null;
    const rem = num(val(hass, e.container_remaining));
    const cap = num(attr(hass, e.container_remaining, "capacity_ml"));
    const days = num(val(hass, e.remaining_days));
    const warnDays = num(attr(hass, e.container_remaining, "warn_days")) ?? 7;
    const lowDays = num(attr(hass, e.container_remaining, "low_days")) ?? 4;
    const level = !tracked || days === null ? "ok" : days < lowDays ? "low" : days < warnDays ? "warn" : "ok";
    const fill = level === "low" ? "var(--error-color)" : level === "warn" ? "var(--warning-color)" : "var(--accent-color, var(--primary-color))";
    const dosed = num(val(hass, e.dosed_today)) ?? 0;
    const planned = num(val(hass, e.planned_today)) ?? 0;
    const boost = isOn(hass, e.boost_active);
    const nextIso = val(hass, e.next_dose);
    const nextMl = num(attr(hass, e.next_dose, "ml"));
    const nextBoost = num(attr(hass, e.next_dose, "boost_ml"));
    const probs = pumpProblems(hass, p, (k, v) => this.t(k, v));

    let ticks = "";
    let scale = "";
    for (const f of [1, 0.75, 0.5, 0.25, 0]) {
      if (f > 0 && f < 1) ticks += `<div class="tick" style="bottom:${f * 100}%"></div>`;
      const label = cap ? fmt(Math.round(cap * f), 0) : `${f * 100} %`;
      scale += `<div class="mark" style="top:calc(${(1 - f) * 100}% - 6px)">${label}${f === 1 && cap ? " ml" : ""}</div>`;
    }
    const shown = pct === null ? null : Math.round(pct);
    const todayPct = planned > 0 ? Math.min(100, (100 * dosed) / planned) : dosed > 0 ? 100 : 0;
    const progress = num(attr(hass, e.activity, "progress"));
    const target = num(attr(hass, e.activity, "target_ml"));
    const done = num(attr(hass, e.activity, "done_ml"));
    const icons = [
      boost ? `<ha-icon class="boost" icon="mdi:rocket-launch" title="${esc(this.t("boostOn"))}"></ha-icon>` : "",
      probs.errors.length ? `<ha-icon class="err" icon="mdi:alert-circle" title="${esc(probs.errors.join("\n"))}"></ha-icon>` : "",
      probs.warns.length ? `<ha-icon class="warn" icon="mdi:alert" title="${esc(probs.warns.join("\n"))}"></ha-icon>` : "",
    ].join("");
    return `
      <div class="pump ${mode === "disabled" ? "dim" : ""} ${c.show_controls ? "" : "info"}" data-act="open" data-p="${p.n}" tabindex="0" role="button">
        <div class="name-row"><span class="name">${name}</span>${icons ? `<span class="icons">${icons}</span>` : ""}</div>
        ${mode && mode !== "auto" ? `<span class="mode-chip">${esc(this.t(mode))}</span>` : ""}
        <div class="bottlewrap">
          <div class="bottle ${tracked ? "" : "untracked"}">
            <div class="fill" style="height:${shown === null ? 0 : Math.max(0, Math.min(100, pct))}%;background:${fill}"></div>
            ${tracked ? ticks : ""}
            <div class="pct">${shown === null ? "–" : `${fmt(shown, 0)} %`}</div>
            <div class="outline"></div>
          </div>
          ${c.show_scale && tracked ? `<div class="scale">${scale}</div>` : ""}
        </div>
        ${c.show_amount ? `<div class="amount">${tracked ? `${fmt(rem, rem !== null && rem < 100 ? 1 : 0)} / ${fmt(cap, 0)} ml` : `<span class="muted">${esc(this.t("notTracked"))}</span>`}</div>` : ""}
        ${c.show_days_left && tracked && days !== null ? `<div class="days ${level}">${esc(this.t("lastsDays", { n: fmt(days, 0) }))}</div>` : ""}
        ${c.show_today ? `<div class="today"><div class="bar"><i style="width:${todayPct}%"></i></div>
          <div class="sub">${esc(this.t("today", { done: fmt(dosed), target: fmt(planned) }))}</div></div>` : ""}
        ${c.show_next ? `<div class="sub ${nextBoost ? "boosted" : ""}">${nextIso
          ? esc(this.t("next", { when: `${fmtTime(nextIso)}${nextMl !== null ? ` · ${fmt(nextMl)} ml` : ""}` }))
          : esc(this.t("noNext"))}</div>` : ""}
        ${activity !== "idle" ? `<div class="run">
            <span>${esc(this.t(activity))}${target ? ` ${fmt(done)} / ${fmt(target)} ml` : ""}</span>
            ${c.show_controls ? `<button class="btn danger" data-act="stop" data-p="${p.n}">${esc(this.t("stop"))}</button>` : ""}
          </div>${progress !== null ? `<div class="bar run-bar"><i style="width:${progress}%"></i></div>` : ""}` : ""}
      </div>`;
  }

  _act(act, el) {
    const hass = this._hass;
    const d = this._doser();
    if (!d) return;
    if (act === "open") {
      const p = d.pumps.get(Number(el.dataset.p));
      if (!p) return;
      if (!this._config.show_controls) {
        this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: p.ents.activity } }));
        return;
      }
      this._openPump(p.n);
    } else if (act === "stop") {
      const p = d.pumps.get(Number(el.dataset.p));
      if (p) call(hass, "stop", { device_id: p.device_id }).catch((err) => this._note(errText(err), true));
    } else if (act === "stopall") {
      if (d.controller) call(hass, "stop", { device_id: d.controller }).catch((err) => this._note(errText(err), true));
    } else if (act === "tab") {
      this._tab = el.dataset.v;
      this._dialogLive();
    } else if (act === "close") {
      this._closeDialog();
    }
  }

  // the pump dialog keeps its tab element, so drafts and focus survive state updates
  _openPump(n) {
    this._open = n;
    this._tab = this._tab || "dose";
    this._dialog = "pump";
    this._dlg.classList.add("pumpdlg");
    this._dlg.innerHTML = `<div id="dhead"></div><div id="tabhost"></div>`;
    this._childKey = null;
    this._headSig = null;
    this._dialogLive();
    if (!this._dlg.open) {
      if (isTouch()) { this._dlg.setAttribute("autofocus", ""); this._dlg.tabIndex = -1; }
      this._dlg.showModal();
      if (isTouch()) this._dlg.focus({ preventScroll: true });
      else this._dlg.querySelector("button.icon")?.focus({ preventScroll: true });
    }
  }

  _dialogLive() {
    if (this._dialog !== "pump") return;
    const hass = this._hass;
    const d = this._doser();
    const p = d && d.pumps.get(this._open);
    if (!p) { this._closeDialog(); return; }
    const tabs = TABS.filter(([key]) => key !== "device" || d.controller);
    if (!tabs.some(([key]) => key === this._tab)) this._tab = "dose";
    const probs = pumpProblems(hass, p, (k, v) => this.t(k, v));
    const mode = val(hass, p.ents.mode);
    const headSig = JSON.stringify([pumpName(hass, p), probs, mode, this._tab, langOf(hass)]);
    if (headSig !== this._headSig) {
      this._headSig = headSig;
      this._dlg.querySelector("#dhead").innerHTML = `
        <div class="dhead"><span class="dname">${esc(pumpName(hass, p))}</span>
          ${mode && mode !== "auto" ? `<span class="mode-chip">${esc(this.t(mode))}</span>` : ""}
          <span class="spacer"></span>
          <button class="icon" data-act="close" aria-label="${esc(this.t("close"))}"><ha-icon icon="mdi:close"></ha-icon></button></div>
        ${probs.errors.length ? `<div class="alert err">${probs.errors.map(esc).join("<br>")}</div>` : ""}
        ${probs.warns.length ? `<div class="alert warn">${probs.warns.map(esc).join("<br>")}</div>` : ""}
        <div class="tabs">${tabs.map(([key, label]) => `<button class="chip ${key === this._tab ? "on" : ""}" data-act="tab" data-v="${key}">${esc(this.t(label))}</button>`).join("")}</div>`;
    }
    const [, , tag] = TABS.find(([key]) => key === this._tab);
    const device = this._tab === "device" ? d.controller : p.device_id;
    const key = `${tag}|${device}`;
    const host = this._dlg.querySelector("#tabhost");
    if (key !== this._childKey) {
      this._childKey = key;
      host.innerHTML = "";
      const child = document.createElement(tag);
      child.setConfig({ device, embedded: true });
      child.hass = hass;
      host.appendChild(child);
      this._child = child;
    } else if (this._child) {
      this._child.hass = hass;
    }
  }

  _closeDialog() {
    super._closeDialog();
    this._dlg.classList.remove("pumpdlg");
    this._child = null;
    this._childKey = null;
    this._open = null;
  }

  connectedCallback() {
    if (!this._closeListener) {
      this._closeListener = () => this._closeDialog();
      this.shadowRoot.addEventListener("lgal-close-dialog", this._closeListener);
    }
  }
}

LgalDoserCard.css = `
  .top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .warn-text { color: var(--warning-color); display: inline-flex; align-items: center; gap: 4px; font-size: .9em; --mdc-icon-size: 18px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 16px 10px; }
  @media (max-width: 480px) { .grid:not(.single) { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .pump { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; padding: 8px 4px;
    border-radius: 12px; cursor: pointer; outline: none; transition: background .15s; }
  .pump:hover, .pump:focus-visible { background: color-mix(in srgb, var(--primary-text-color) 6%, transparent); }
  .pump.static { cursor: default; }
  .pump.dim .bottlewrap, .pump.dim .today { opacity: .45; }
  .name-row { display: flex; align-items: center; justify-content: center; gap: 4px; max-width: 100%; }
  .name { font-weight: 600; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; }
  .icons { display: inline-flex; gap: 2px; --mdc-icon-size: 16px; flex: none; }
  .icons .err { color: var(--error-color); } .icons .warn { color: var(--warning-color); } .icons .boost { color: var(--primary-color); }
  .mode-chip { font-size: 11px; border: 1px solid var(--divider-color, rgba(127,127,127,.5)); border-radius: 10px; padding: 0 7px; color: var(--secondary-text-color); }
  .bottlewrap { position: relative; width: 56px; height: 140px; margin: 8px 0 6px; }
  .bottle { position: relative; width: 100%; height: 100%; border-radius: 8px 8px 14px 14px; overflow: hidden; background: rgba(127,127,127,.15); }
  .fill { position: absolute; left: 0; right: 0; bottom: 0; opacity: .85; transition: height .4s; }
  .tick { position: absolute; left: 0; right: 0; height: 1px; background: rgba(255,255,255,.4); }
  .pct { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px;
    color: #fff; text-shadow: 0 0 4px rgba(0,0,0,.7); }
  .outline { position: absolute; inset: 0; border-radius: 8px 8px 14px 14px; box-shadow: inset 0 0 0 2px var(--secondary-text-color); }
  .untracked .outline { box-shadow: none; border: 2px dashed var(--secondary-text-color); box-sizing: border-box; }
  .scale { position: absolute; left: calc(100% + 6px); top: 0; bottom: 0; font-size: 10px; color: var(--secondary-text-color); }
  .mark { position: absolute; left: 0; line-height: 12px; white-space: nowrap; }
  .amount { font-size: 13px; text-align: center; }
  .days { font-size: 12px; color: var(--secondary-text-color); text-align: center; }
  .days.warn { color: var(--warning-color); } .days.low { color: var(--error-color); }
  .today { width: 100%; max-width: 150px; margin-top: 4px; }
  .sub { font-size: 11px; color: var(--secondary-text-color); text-align: center; margin-top: 2px; }
  .sub.boosted { color: var(--primary-color); }
  .run { font-size: 12px; color: var(--primary-color); display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
  .run .btn { padding: 1px 10px; font-size: 12px; }
  .run-bar { width: 100%; max-width: 150px; }
  .run-bar > i { background: var(--primary-color); }
  /* anchored at the top: a centred dialog would jump whenever a tab changes its height */
  dialog.pumpdlg { width: min(560px, calc(100vw - 24px)); margin: max(12px, 6vh) auto auto; max-height: calc(100vh - max(12px, 6vh) - 12px); }
  .dhead { display: flex; align-items: center; gap: 8px; }
  .dname { font-size: 1.25em; font-weight: 500; }
  #dhead .alert { margin-top: 8px; }
  .tabs { display: flex; gap: 6px; flex-wrap: wrap; margin: 14px 0 16px; }
`;

// -- manual dosing card ------------------------------------------------------------------------

class LgalDoserManualCard extends LgalBase {
  _title() { const p = this._pump(); return this._config.title || (p ? `${this.t("manualTitle")} · ${pumpName(this._hass, p)}` : this.t("manualTitle")); }
  _configChanged() { this._amount = null; this._tier = null; }
  _signature() {
    const p = this._pump();
    if (!p) return "none";
    const e = p.ents;
    return [e.activity, e.mode, e.speed, e.dose_amount, e.next_dose, e.dosed_today, e.daily_limit].map((x) => { const s = st(this._hass, x); return s && [s.state, s.last_updated]; })
      .concat([this._amount, this._tier]);
  }

  _amountValue(p) { return this._amount ?? val(this._hass, p.ents.dose_amount) ?? "1"; }

  _body() {
    const p = this._pump();
    if (!p) return this._missing();
    const hass = this._hass;
    const e = p.ents;
    const activity = val(hass, e.activity) || "idle";
    const mode = val(hass, e.mode);
    const tier = this._tier || val(hass, e.speed) || "medium";
    const amount = parse(this._amountValue(p));
    const ok = amount !== null && amount >= MIN_DOSE;
    const queued = attr(hass, e.next_dose, "queued");
    const used = num(val(hass, e.dosed_today));
    const limit = num(val(hass, e.daily_limit));
    return `
      ${this._running(p)}
      ${queued ? `<div class="row"><span class="hint">${esc(this.t("queued"))}</span>${activity === "idle" ? `<button class="btn danger" data-act="stop">${esc(this.t("stop"))}</button>` : ""}</div>` : ""}
      ${mode === "disabled" ? `<div class="alert warn">${esc(this.t("pumpOff"))}</div>` : ""}
      <div class="row"><span>${esc(this.t("amount"))}</span>
        <span class="ctl"><input class="num ${ok || this._amount === null ? "" : "bad"}" type="number" inputmode="decimal" min="${MIN_DOSE}" step="any" data-f="amount" value="${esc(this._amountValue(p))}"><span class="unit">ml</span></span></div>
      ${e.speed ? `<div class="row"><span>${esc(this.t("speed"))}</span>${this._speedChips(tier)}</div>` : ""}
      <div class="actions">
        ${used !== null ? `<span class="hint spacer">${esc(this.t("usedToday", { used: fmt(used) }))}${limit ? ` · ${esc(this.t("limit", { limit: fmt(limit) }))}` : ""}</span>` : ""}
        <button class="btn primary" data-act="confirm" ${this._busy || !ok || mode === "disabled" || activity !== "idle" ? "disabled" : ""}>${esc(this.t("doseBtn"))}</button>
      </div>
      <div class="section">${esc(this.t("primeTitle"))}</div>
      <div class="row"><span class="hint">${esc(this.t("primeHint"))}</span>${this._holdButton(mode === "disabled" || (activity !== "idle" && activity !== "priming"))}</div>`;
  }

  _input(el) {
    if (el.dataset.f !== "amount") return;
    this._amount = el.value;
    const amount = parse(el.value);
    const ok = amount !== null && amount >= MIN_DOSE;
    el.classList.toggle("bad", !ok);
    const btn = this._root.querySelector('[data-act="confirm"]');
    const p = this._pump();
    if (btn && p) btn.disabled = this._busy || !ok || val(this._hass, p.ents.mode) === "disabled" || (val(this._hass, p.ents.activity) || "idle") !== "idle";
  }

  _act(act, el) {
    const p = this._pump();
    if (!p) return;
    const hass = this._hass;
    if (act === "tier") { this._tier = el.dataset.v; this._render(true); }
    else if (act === "stop") this._do(() => call(hass, "stop", { device_id: p.device_id }));
    else if (act === "confirm") this._openDialog("confirm");
    else if (act === "cancel") this._closeDialog();
    else if (act === "go") {
      this._closeDialog();
      const amount = parse(this._amountValue(p));
      const speed = this._tier || val(hass, p.ents.speed);
      if (p.ents.dose_amount) setEntity(hass, p.ents.dose_amount, amount).catch(() => {});
      this._do(() => call(hass, "dose", { device_id: p.device_id, amount, ...(speed && TIERS.includes(speed) ? { speed } : {}) }));
    }
  }

  _dialogHtml() {
    const p = this._pump();
    if (!p) return "";
    const tier = this._tier || val(this._hass, p.ents.speed) || "medium";
    return `<div class="dtitle">${esc(this.t("confirmTitle"))}</div>
      <div class="dhint">${esc(this.t("confirmText", { ml: fmt(parse(this._amountValue(p))), speed: this.t(tier) }))}</div>
      <div class="dactions"><button class="btn" data-act="cancel">${esc(this.t("cancel"))}</button>
        <button class="btn primary" data-act="go">${esc(this.t("start"))}</button></div>`;
  }
}

// -- schedule card -----------------------------------------------------------------------------

class LgalDoserScheduleCard extends LgalBase {
  _title() { const p = this._pump(); return this._config.title || (p ? `${this.t("scheduleTitle")} · ${pumpName(this._hass, p)}` : this.t("scheduleTitle")); }
  _configChanged() { this._draft = null; this._dirty = false; this._saved = false; }
  getCardSize() { return 5; }

  _signature() {
    const p = this._pump();
    if (!p) return "none";
    const s = st(this._hass, p.ents.schedule);
    return [s && s.last_updated, val(this._hass, p.ents.name), this._dirty && this._draft, this._dirty, this._saved, Math.floor(Date.now() / 60000)];
  }

  _grid(p) { return attr(this._hass, p.ents.schedule, "grid_min") || 5; }

  _fromState(p) {
    const hass = this._hass;
    const a = st(hass, p.ents.schedule)?.attributes || {};
    return {
      kind: val(hass, p.ents.schedule) || "none",
      ml: a.ml ?? 10, count: a.count ?? 4, start: a.start || "08:00", end: a.end || "20:00",
      times: (a.times && a.times.length ? a.times : [{ time: "09:00", ml: 1 }]).map((x) => ({ time: x.time, ml: x.ml })),
      days: { mode: "daily", weekdays: [...WEEKDAYS], every: 2, anchor: localDate(), ...(a.days || {}) },
      power_loss: a.power_loss || "skip_missed", catch_up_min: a.catch_up_min ?? 60,
    };
  }

  _ensureDraft(p) {
    if (!this._draft || !this._dirty) this._draft = this._fromState(p);
    if (!Array.isArray(this._draft.days.weekdays) || !this._draft.days.weekdays.length) this._draft.days.weekdays = [...WEEKDAYS];
    return this._draft;
  }

  _doses(d, grid) {
    if (d.kind === "spread") return spreadSlots(d, grid);
    if (d.kind === "times") return d.times.filter((x) => validTime(x.time) && num(x.ml) !== null).map((x) => ({ time: x.time, ml: num(x.ml) })).sort((a, b) => hm(a.time) - hm(b.time));
    return [];
  }

  _problems(d) {
    const out = [];
    if (d.kind === "spread") {
      const n = Number(d.count);
      if (!Number.isInteger(n) || n < 1 || n > MAX_SPREAD) out.push(this.t("pCount", { max: MAX_SPREAD }));
      if (!validTime(d.start) || (n > 1 && !validTime(d.end))) out.push(this.t("pTime"));
      else if (n > 1 && hm(d.end) <= hm(d.start)) out.push(this.t("pEnd"));
      if (!(num(d.ml) > 0) || (n >= 1 && num(d.ml) / n < MIN_DOSE - 1e-9)) out.push(this.t("pAmount"));
    } else if (d.kind === "times") {
      if (!d.times.length || d.times.length > MAX_TIMES) out.push(this.t("pCount", { max: MAX_TIMES }));
      if (d.times.some((x) => !validTime(x.time))) out.push(this.t("pTime"));
      if (d.times.some((x) => !(num(x.ml) >= MIN_DOSE))) out.push(this.t("pAmount"));
      const seen = new Set();
      if (d.times.some((x) => seen.size === seen.add(x.time).size)) out.push(this.t("pDup"));
    }
    if (d.kind !== "none") {
      if (d.days.mode === "weekdays" && !d.days.weekdays.length) out.push(this.t("pWeekdays"));
      if (d.days.mode === "interval") {
        const every = Number(d.days.every);
        if (!Number.isInteger(every) || every < 1 || every > 30) out.push(this.t("pEvery"));
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d.days.anchor || "")) out.push(this.t("pAnchor"));
      }
      const cu = Number(d.catch_up_min);
      if (d.power_loss === "catch_up_window" && (!Number.isInteger(cu) || cu < 0 || cu > 1440)) out.push(this.t("pCatch"));
    }
    return out;
  }

  _document() {
    const d = this._draft;
    if (d.kind === "none") return { kind: "none" };
    const days = { mode: d.days.mode };
    if (d.days.mode === "weekdays") days.weekdays = WEEKDAYS.filter((w) => d.days.weekdays.includes(w));
    if (d.days.mode === "interval") { days.every = Number(d.days.every); days.anchor = d.days.anchor; }
    const doc = { kind: d.kind, days, power_loss: d.power_loss, catch_up_min: Number(d.catch_up_min) || 0 };
    if (d.kind === "spread") Object.assign(doc, { ml: num(d.ml), count: Number(d.count), start: d.start, ...(Number(d.count) > 1 ? { end: d.end } : {}) });
    else doc.times = d.times.map((x) => ({ time: x.time, ml: num(x.ml) })).sort((a, b) => hm(a.time) - hm(b.time));
    return doc;
  }

  _summary(d, doses) {
    if (d.kind === "none") return esc(this.t("summaryNone"));
    if (!doses.length) return esc(this.t("summaryEmpty"));
    const times = doses.map((x) => x.time);
    const parts = [`${doses.length} ${esc(this.t(doses.length === 1 ? "doseOne" : "doseMany"))}`];
    parts.push(times.length === 1 ? esc(times[0]) : `${esc(times[0])}–${esc(times[times.length - 1])}`);
    if (doses.length > 1) {
      const groups = new Map();
      for (const x of doses) { const k = round2(x.ml); groups.set(k, (groups.get(k) || 0) + 1); }
      const sorted = [...groups].sort((a, b) => b[0] - a[0]);
      if (sorted.length === 1) parts.push(esc(this.t("each", { ml: fmt(sorted[0][0]) })));
      else if (sorted.length === 2) parts.push(sorted.map(([ml, n]) => `${n}× ${fmt(ml)} ml`).join(" + "));
      else parts.push(esc(this.t("varied", { a: fmt(sorted[sorted.length - 1][0]), b: fmt(sorted[0][0]) })));
    }
    const total = doses.reduce((a, x) => a + x.ml, 0);
    parts.push(`<strong>${esc(this.t("dailyTotal"))}: ${fmt(total)} ml</strong>`);
    return parts.join(" · ");
  }

  _bar(p, d, doses) {
    const hass = this._hass;
    const today = attr(hass, p.ents.schedule, "today") || {};
    const deviceSlots = today.slots || [];
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const marks = (list, cls) => list.map((x) => `<i class="${cls} ${hm(x.time) < nowMin ? "past" : ""}" style="left:${(hm(x.time) / 1440) * 100}%" title="${esc(x.time)} · ${fmt(x.ml)} ml"></i>`).join("");
    const draftTotal = doses.reduce((a, x) => a + x.ml, 0);
    return `<div class="day">
        <div class="track">${this._dirty ? marks(deviceSlots, "dev") + marks(doses, "draft") : marks(deviceSlots, "draft")}
          <span class="cursor" style="left:${(nowMin / 1440) * 100}%"></span></div>
        <div class="ticks"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>
        <div class="hint small">${esc(this.t("todayBar", { ml: fmt(today.ml ?? 0) }))}${this._dirty ? ` · ${esc(this.t("draftBar", { ml: fmt(draftTotal) }))}` : ""}</div>
      </div>`;
  }

  _dayChips(d, act = "day") {
    const on = d.days.mode === "daily" ? WEEKDAYS : d.days.weekdays;
    const wd = this.t("wd");
    return `<div class="chips days">${WEEKDAYS.map((w, i) => `<button class="chip ${on.includes(w) ? "on" : ""}" data-act="${act}" data-v="${w}">${esc(wd[i])}</button>`).join("")}</div>`;
  }

  _body() {
    const p = this._pump();
    if (!p) return this._missing();
    const d = this._ensureDraft(p);
    const grid = this._grid(p);
    const doses = this._doses(d, grid);
    const problems = this._problems(d);
    const plText = d.power_loss === "catch_up_window" ? this.t("catch_up_window", { n: d.catch_up_min }) : this.t("skip_missed");
    const has = d.kind !== "none" && doses.length > 0;
    return `
      ${this._dirty || this._saved ? `<div class="toprow"><span class="badge ${this._dirty ? "dirty" : "saved"}">${esc(this.t(this._dirty ? "unsaved" : "saved"))}</span></div>` : ""}
      ${this._bar(p, d, doses)}
      <div class="wizards">
        <button class="link" data-act="w-new">${esc(this.t("wizardNew"))}</button>
        <button class="link" data-act="w-total" ${has ? "" : "disabled"} title="${has ? "" : esc(this.t("needsDoses"))}">${esc(this.t("wizardTotal"))}</button>
        <button class="link" data-act="w-count" ${has ? "" : "disabled"} title="${has ? "" : esc(this.t("needsDoses"))}">${esc(this.t("wizardCount"))}</button>
      </div>
      <div class="row summary"><div>${this._summary(d, doses)}
          ${d.kind !== "none" ? `<div class="hint small">${esc(this.t("afterPowerCut"))}: ${esc(plText)}</div>` : ""}</div>
        <button class="link" data-act="edit">${esc(this.t("edit"))}</button></div>
      ${d.kind !== "none" ? `<div class="row"><span class="muted">${esc(this.t("activeOn"))}</span>
        ${d.days.mode === "interval"
          ? `<span class="ctl">${esc(this.t("everyN", { n: d.days.every, date: fmtDate(`${d.days.anchor}T12:00:00`) }))}</span>`
          : this._dayChips(d)}</div>` : ""}
      ${problems.length && this._dirty ? `<div class="error">${problems.map(esc).join(" · ")}</div>` : ""}
      <div class="actions">
        <button class="btn" data-act="reload" ${this._busy ? "disabled" : ""}>${esc(this.t("reload"))}</button>
        <button class="btn primary" data-act="save" ${this._busy || !this._dirty || problems.length ? "disabled" : ""}>${esc(this.t("saveSchedule"))}</button>
      </div>`;
  }

  _changed(dialogToo = false) {
    this._dirty = true;
    this._saved = false;
    this._msg = null;
    this._render(true);
    if (dialogToo) this._renderDialog(); else this._dialogLive();
  }

  _toggleDay(w) {
    const d = this._draft;
    const set = new Set(d.days.mode === "daily" ? WEEKDAYS : d.days.weekdays);
    if (set.has(w)) { if (set.size === 1) return; set.delete(w); } else set.add(w);
    d.days.weekdays = WEEKDAYS.filter((x) => set.has(x));
    d.days.mode = set.size === 7 ? "daily" : "weekdays";
  }

  // "New schedule": evenly over the whole day (from the start time) or up to an end time
  _build(total, count, startMin, endMin, grid) {
    if (!(total > 0) || !Number.isInteger(count) || count < 1 || count > MAX_SPREAD || startMin === null) return null;
    if (total / count < MIN_DOSE - 1e-9) return null;
    if (count === 1) return { kind: "spread", ml: round2(total), count: 1, start: hmText(startMin), end: hmText(startMin) };
    let start = startMin;
    let end;
    if (endMin === null) {
      const interval = 1440 / count;
      start = Math.round((startMin % interval) / grid) * grid;
      end = Math.floor((start + interval * (count - 1)) / grid) * grid;
      if (end > 1439) end = Math.floor(1439 / grid) * grid;
    } else {
      end = endMin;
      if (end <= start) return null;
    }
    return { kind: "spread", ml: round2(total), count, start: hmText(start), end: hmText(end) };
  }

  _wizardResult(p) {
    const f = this._form;
    const d = this._draft;
    const grid = this._grid(p);
    if (this._dialog === "w-new") {
      const start = validTime(f.start) ? hm(f.start) : null;
      const end = f.useEnd ? (validTime(f.end) ? hm(f.end) : -1) : null;
      if (end === -1) return null;
      return this._build(parse(f.total), Number(f.count), start, end, grid);
    }
    const doses = this._doses(d, grid);
    const total = doses.reduce((a, x) => a + x.ml, 0);
    if (this._dialog === "w-total") {
      const target = parse(f.total);
      if (!(target > 0)) return null;
      if (d.kind === "spread") return Number(d.count) && target / Number(d.count) >= MIN_DOSE - 1e-9 ? { ml: round2(target) } : null;
      const cents = Math.round(target * 100);
      const raw = d.times.map((x) => (total > 0 ? (num(x.ml) * cents) / total : cents / d.times.length));
      const out = raw.map(Math.floor);
      let left = cents - out.reduce((a, b) => a + b, 0);
      raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { out[i] += 1; left -= 1; } });
      if (out.some((c) => c / 100 < MIN_DOSE)) return null;
      return { times: d.times.map((x, i) => ({ time: x.time, ml: out[i] / 100 })) };
    }
    if (this._dialog === "w-count") {
      const count = Number(f.count);
      if (d.kind === "spread") {
        if (!Number.isInteger(count) || count < 1 || count > MAX_SPREAD || num(d.ml) / count < MIN_DOSE - 1e-9) return null;
        return { count, ...(count > 1 && !(validTime(d.end) && hm(d.end) > hm(d.start)) ? { end: hmText(Math.min(1435, hm(d.start) + 12 * 60)) } : {}) };
      }
      const first = doses.length ? hm(doses[0].time) : 480;
      const last = doses.length ? hm(doses[doses.length - 1].time) : first;
      return this._build(total, count, first, count > 1 && last > first ? last : null, grid);
    }
    return null;
  }

  _splitLine(total, count) {
    if (!(total > 0) || !Number.isInteger(count) || count < 1) return "";
    const { base, extra } = splitTotal(total, count);
    return extra === 0 ? this.t("splitEven", { n: count, ml: fmt(base / 100) })
      : this.t("splitMixed", { a: extra, ma: fmt((base + 1) / 100), b: count - extra, mb: fmt(base / 100) });
  }

  _preview(p) {
    const grid = this._grid(p);
    if (this._dialog === "edit") {
      const d = this._draft;
      const doses = this._doses(d, grid);
      const total = doses.reduce((a, x) => a + x.ml, 0);
      const problems = this._problems(d);
      const list = d.kind === "spread" && doses.length ? `${esc(this._splitLine(num(d.ml), Number(d.count)))} · ${doses.map((x) => x.time).join(", ")}` : "";
      return `${list ? `<div class="hint small">${list}</div>` : ""}
        ${d.kind !== "none" ? `<div class="small">${esc(this.t("dailyTotal"))}: <strong>${fmt(total)} ml</strong></div>` : ""}
        ${problems.length ? `<div class="error">${problems.map(esc).join(" · ")}</div>` : ""}`;
    }
    const r = this._wizardResult(p);
    if (!r) return "";
    if (this._dialog === "w-new" || (this._dialog === "w-count" && r.kind)) {
      const doses = spreadSlots(r, grid);
      return `<div class="hint small">${esc(this._splitLine(r.ml, r.count))}<br>${doses.map((x) => x.time).join(", ")}</div>`;
    }
    if (this._dialog === "w-count") {
      const doses = spreadSlots({ ...this._draft, ...r }, grid);
      return `<div class="hint small">${esc(this._splitLine(num(this._draft.ml), r.count))}<br>${doses.map((x) => x.time).join(", ")}</div>`;
    }
    return "";
  }

  _dialogLive() {
    const p = this._pump();
    if (!p || !this._dialog) return;
    const prev = this._dlg.querySelector("#dprev");
    if (prev) prev.innerHTML = this._preview(p);
    const apply = this._dlg.querySelector('[data-act="apply"]');
    if (apply) apply.disabled = !this._wizardResult(p);
  }

  _dialogHtml() {
    const p = this._pump();
    if (!p) return "";
    const d = this._draft;
    const f = this._form;
    const grid = this._grid(p);
    const step = `step="${grid * 60}"`;
    const foot = (applyable) => `<div id="dprev"></div><div class="dactions">
        ${applyable ? `<button class="btn" data-act="dclose">${esc(this.t("cancel"))}</button><button class="btn primary" data-act="apply">${esc(this.t("apply"))}</button>`
          : `<button class="btn primary" data-act="dclose">${esc(this.t("doneBtn"))}</button>`}</div>`;
    const row = (label, ctl) => `<div class="row"><span>${esc(label)}</span><span class="ctl">${ctl}</span></div>`;
    const chips = (act, cur, items) => `<div class="chips">${items.map(([v, label]) => `<button class="chip ${v === cur ? "on" : ""}" data-act="${act}" data-v="${v}">${esc(label)}</button>`).join("")}</div>`;
    if (this._dialog === "edit") {
      let body = `<div class="row"><span>${esc(this.t("kind"))}</span>${chips("kind", d.kind, [["spread", this.t("kindSpread")], ["times", this.t("kindTimes")], ["none", this.t("kindNone")]])}</div>`;
      if (d.kind === "spread") {
        body += row(this.t("dailyAmount"), `<input class="num" type="number" inputmode="decimal" min="0" step="any" data-f="ml" value="${esc(d.ml)}"><span class="unit">ml</span>`);
        body += row(this.t("doseCount"), `<input class="short" type="number" min="1" max="${MAX_SPREAD}" step="1" data-f="count" value="${esc(d.count)}">`);
        body += row(this.t("firstDose"), `<input type="time" ${step} data-f="start" value="${esc(d.start)}">`);
        if (Number(d.count) > 1) body += row(this.t("lastDose"), `<input type="time" ${step} data-f="end" value="${esc(d.end)}">`);
      } else if (d.kind === "times") {
        body += `<div class="times">${d.times.map((x, i) => `<div class="trow">
            <input type="time" ${step} data-f="t-time" data-i="${i}" value="${esc(x.time)}" aria-label="${esc(this.t("startTime"))}">
            <input class="num" type="number" inputmode="decimal" min="${MIN_DOSE}" step="any" data-f="t-ml" data-i="${i}" value="${esc(x.ml)}" aria-label="ml"><span class="unit">ml</span>
            <button class="icon" data-act="deltime" data-i="${i}" title="${esc(this.t("remove"))}" ${d.times.length <= 1 ? "disabled" : ""}><ha-icon icon="mdi:close"></ha-icon></button>
          </div>`).join("")}</div>
          <div><button class="link" data-act="addtime" ${d.times.length >= MAX_TIMES ? "disabled" : ""}>+ ${esc(this.t("addDose"))}</button></div>`;
      }
      if (d.kind !== "none") {
        body += `<div class="section">${esc(this.t("days"))}</div>`;
        body += chips("daysmode", d.days.mode, [["daily", this.t("daysDaily")], ["weekdays", this.t("daysWeekdays")], ["interval", this.t("daysInterval")]]).replace('class="chips"', 'class="chips left"');
        if (d.days.mode === "weekdays") body += this._dayChips(d, "eday").replace('class="chips days"', 'class="chips days left"');
        if (d.days.mode === "interval") {
          body += row(this.t("every"), `<input class="short" type="number" min="1" max="30" step="1" data-f="every" value="${esc(d.days.every)}"><span class="unit">${esc(this.t("daysUnit"))}</span>`);
          body += row(this.t("from"), `<input type="date" data-f="anchor" value="${esc(d.days.anchor)}">`);
        }
        body += `<div class="section">${esc(this.t("afterPowerCut"))}</div>`;
        body += chips("pl", d.power_loss, [["skip_missed", this.t("skipMissedLong")], ["catch_up_window", this.t("catchUpLong")]]).replace('class="chips"', 'class="chips left"');
        if (d.power_loss === "catch_up_window") body += row(this.t("catchUpWithin"), `<input class="short" type="number" min="0" max="1440" step="1" data-f="catch" value="${esc(d.catch_up_min)}"><span class="unit">min</span>`);
      }
      return `<div class="dtitle">${esc(this.t("editTitle"))}</div><div class="dbody">${body}</div>${foot(false)}`;
    }
    if (this._dialog === "w-new") {
      return `<div class="dtitle">${esc(this.t("newTitle"))}</div><div class="dhint">${esc(this.t("newHint"))}</div><div class="dbody">
        ${row(this.t("totalAmount"), `<input class="num" type="number" inputmode="decimal" min="0" step="any" data-f="w-total" value="${esc(f.total)}"><span class="unit">ml</span>`)}
        ${row(this.t("doseCount"), `<input class="short" type="number" min="1" max="${MAX_SPREAD}" step="1" data-f="w-count" value="${esc(f.count)}">`)}
        ${row(this.t("startTime"), `<input type="time" ${step} data-f="w-start" value="${esc(f.start)}">`)}
        ${row(this.t("useEnd"), `<input type="checkbox" data-f="w-useend" ${f.useEnd ? "checked" : ""}>`)}
        ${f.useEnd ? row(this.t("endTime"), `<input type="time" ${step} data-f="w-end" value="${esc(f.end)}">`) : ""}
      </div>${foot(true)}`;
    }
    if (this._dialog === "w-total") {
      const total = this._doses(d, grid).reduce((a, x) => a + x.ml, 0);
      return `<div class="dtitle">${esc(this.t("totalTitle"))}</div><div class="dhint">${esc(this.t("totalHint"))}</div><div class="dbody">
        ${row(this.t("currentTotal"), `<span>${fmt(total)} ml</span>`)}
        ${row(this.t("newTotal"), `<input class="num" type="number" inputmode="decimal" min="0" step="any" data-f="w-total" value="${esc(f.total)}"><span class="unit">ml</span>`)}
      </div>${foot(true)}`;
    }
    return `<div class="dtitle">${esc(this.t("countTitle"))}</div><div class="dhint">${esc(this.t("countHint"))}</div><div class="dbody">
        ${row(this.t("doseCount"), `<input class="short" type="number" min="1" max="${d.kind === "spread" ? MAX_SPREAD : MAX_SPREAD}" step="1" data-f="w-count" value="${esc(f.count)}">`)}
      </div>${foot(true)}`;
  }

  _openDialog(kind, form) {
    super._openDialog(kind, form);
    this._dialogLive();
  }
  _renderDialog() {
    super._renderDialog();
    this._dialogLive();
  }

  _input(el, commit) {
    const p = this._pump();
    if (!p || !this._draft) return;
    const d = this._draft;
    const f = el.dataset.f;
    const v = el.value;
    if (f.startsWith("w-")) {
      if (f === "w-useend") { this._form.useEnd = el.checked; this._renderDialog(); return; }
      this._form[f.slice(2)] = v;
      this._dialogLive();
      return;
    }
    let structural = false;
    if (f === "ml") d.ml = v;
    else if (f === "count") { structural = commit && (Number(v) > 1) !== !!this._dlg.querySelector('[data-f="end"]'); d.count = v === "" ? "" : Number(v); }
    else if (f === "start") d.start = v;
    else if (f === "end") d.end = v;
    else if (f === "every") d.days.every = v === "" ? "" : Number(v);
    else if (f === "anchor") d.days.anchor = v;
    else if (f === "catch") d.catch_up_min = v === "" ? "" : Number(v);
    else if (f === "t-time") d.times[Number(el.dataset.i)].time = v;
    else if (f === "t-ml") d.times[Number(el.dataset.i)].ml = v;
    else return;
    this._changed(structural);
  }

  _act(act, el) {
    const p = this._pump();
    if (!p) return;
    const d = this._ensureDraft(p);
    const grid = this._grid(p);
    const v = el.dataset.v;
    switch (act) {
      case "day": this._toggleDay(v); this._changed(); return;
      case "eday": this._toggleDay(v); this._changed(true); return;
      case "edit": this._openDialog("edit"); return;
      case "dclose": this._closeDialog(); return;
      case "kind": {
        // spread → single times keeps the doses (as the device's own web UI does)
        const spread = d.kind === "spread" ? spreadSlots(d, grid) : [];
        if (v === "times" && spread.length && spread.length <= MAX_TIMES) d.times = spread.map((x) => ({ time: x.time, ml: x.ml }));
        d.kind = v;
        if (v === "times" && !d.times.length) d.times = [{ time: "09:00", ml: 1 }];
        this._changed(true);
        return;
      }
      case "daysmode":
        d.days.mode = v;
        if (v === "weekdays" && d.days.weekdays.length === 7) d.days.weekdays = WEEKDAYS.slice(0, 5);
        this._changed(true);
        return;
      case "pl": d.power_loss = v; this._changed(true); return;
      case "addtime": {
        const last = d.times[d.times.length - 1];
        d.times.push({ time: last && validTime(last.time) ? hmText(Math.min(1435, hm(last.time) + 60)) : "12:00", ml: last ? last.ml : 1 });
        this._changed(true);
        return;
      }
      case "deltime": d.times.splice(Number(el.dataset.i), 1); this._changed(true); return;
      case "w-new": {
        const doses = this._doses(d, grid);
        const total = doses.reduce((a, x) => a + x.ml, 0);
        this._openDialog("w-new", { total: String(round2(total) || 10), count: String(doses.length || 4), start: doses.length ? doses[0].time : "08:00", useEnd: false, end: "20:00" });
        return;
      }
      case "w-total": this._openDialog("w-total", { total: String(round2(this._doses(d, grid).reduce((a, x) => a + x.ml, 0))) }); return;
      case "w-count": this._openDialog("w-count", { count: String(this._doses(d, grid).length || 4) }); return;
      case "apply": {
        const r = this._wizardResult(p);
        if (!r) return;
        Object.assign(d, r);
        this._closeDialog();
        this._changed();
        return;
      }
      case "reload": this._draft = null; this._dirty = false; this._saved = false; this._msg = null; this._render(true); return;
      case "save":
        this._do(async () => {
          await call(this._hass, "set_schedule", { device_id: p.device_id, schedule: this._document() });
          this._dirty = false;
          this._draft = null;
          this._saved = true;
        }, false); // the "Saved." badge says it
        return;
      default:
    }
  }
}

LgalDoserScheduleCard.css = `
  .toprow { display: flex; justify-content: flex-end; margin-top: -4px; }
  .track { position: relative; height: 26px; border-radius: 8px; background: rgba(127,127,127,.15); }
  .track i { position: absolute; top: 4px; width: 3px; height: 18px; margin-left: -1px; border-radius: 2px; }
  .track i.draft { background: var(--primary-color); }
  .track i.dev { background: var(--secondary-text-color); opacity: .45; top: 2px; height: 22px; }
  .track i.past { opacity: .4; }
  .track .cursor { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--error-color); }
  .ticks { display: flex; justify-content: space-between; font-size: .75em; color: var(--secondary-text-color); margin: 2px 0; }
  .wizards { display: flex; flex-wrap: wrap; gap: 8px; }
  .summary { align-items: center; }
  .summary > div { flex: 1; min-width: 200px; }
  .chips.left { justify-content: flex-start; }
  .chips.days .chip { min-width: 2.6em; padding: 4px 8px; }
  .times { display: flex; flex-direction: column; gap: 6px; max-height: 45vh; overflow: auto; }
  .trow { display: flex; align-items: center; gap: 6px; }
  .trow .icon { margin-left: auto; color: var(--secondary-text-color); }
  .trow .icon:disabled { opacity: .3; cursor: default; }
  #dprev { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; }
`;

// -- boost card --------------------------------------------------------------------------------

class LgalDoserBoostCard extends LgalBase {
  _title() { const p = this._pump(); return this._config.title || (p ? `${this.t("boostTitle")} · ${pumpName(this._hass, p)}` : this.t("boostTitle")); }
  _configChanged() { this._f = { ml: "10", by: "days", n: "3" }; }
  _signature() {
    const p = this._pump();
    if (!p) return "none";
    return [p.ents.boost_active, p.ents.boost_remaining, p.ents.mode, p.ents.schedule, p.ents.planned_today].map((x) => { const s = st(this._hass, x); return s && [s.state, s.last_updated]; }).concat([this._f]);
  }

  _preview() {
    const ml = parse(this._f.ml);
    const n = Number(this._f.n);
    const max = this._f.by === "days" ? 30 : 100;
    if (!(ml > 0) || !Number.isInteger(n) || n < 1 || n > max) return { ok: false, text: this.t("boostCount") };
    return { ok: true, text: this.t(this._f.by === "days" ? "perDayPrev" : "perDosePrev", { ml: fmt(ml / n) }) };
  }

  _body() {
    const p = this._pump();
    if (!p) return this._missing();
    const hass = this._hass;
    const e = p.ents;
    const a = st(hass, e.boost_remaining)?.attributes || {};
    const rest = num(val(hass, e.boost_remaining)) || 0;
    const active = isOn(hass, e.boost_active) || rest > 0;
    const mode = val(hass, e.mode);
    if (active) {
      const total = num(a.total_ml) || rest;
      const pct = total > 0 ? Math.min(100, (100 * (total - rest)) / total) : 0;
      return `<div class="status">
          <div>${esc(this.t("boostRunning", { rest: fmt(rest), total: fmt(total) }))}</div>
          <div class="bar"><i style="width:${pct}%"></i></div>
          <div class="hint">${[a.end ? this.t("boostEnd", { when: fmtTime(a.end) }) : "",
            a.doses_left ? this.t("boostDosesLeft", { n: a.doses_left, ml: fmt(a.per_dose_ml) }) : "",
            a.today_ml ? this.t("boostToday", { ml: fmt(a.today_ml) }) : ""].filter(Boolean).map(esc).join(" · ")}</div>
          ${mode !== "auto" ? `<div class="alert warn">${esc(this.t("boostPaused"))}</div>` : ""}
        </div>
        <div class="actions"><button class="btn danger" data-act="end" ${this._busy ? "disabled" : ""}>${esc(this.t("endBoost"))}</button></div>`;
    }
    const noSchedule = (val(hass, e.schedule) || "none") === "none";
    const blocked = noSchedule || mode !== "auto";
    const prev = this._preview();
    return `
      ${noSchedule ? `<div class="alert warn">${esc(this.t("boostNoSchedule"))}</div>` : mode !== "auto" ? `<div class="alert warn">${esc(this.t("boostNotAuto"))}</div>` : ""}
      <div class="row"><span>${esc(this.t("boostAmount"))}</span><span class="ctl"><input class="num" type="number" inputmode="decimal" min="0" step="any" data-f="ml" value="${esc(this._f.ml)}"><span class="unit">ml</span></span></div>
      <div class="row"><span>${esc(this.t("spreadOver"))}</span><span class="ctl">
        <input class="short" type="number" min="1" max="${this._f.by === "days" ? 30 : 100}" step="1" data-f="n" value="${esc(this._f.n)}">
        <span class="chips"><button class="chip ${this._f.by === "days" ? "on" : ""}" data-act="by" data-v="days">${esc(this.t("byDays"))}</button>
          <button class="chip ${this._f.by === "doses" ? "on" : ""}" data-act="by" data-v="doses">${esc(this.t("byDoses"))}</button></span></span></div>
      <div class="actions"><span class="hint spacer" id="prev">${esc(prev.text)}</span>
        <button class="btn primary" data-act="start" ${this._busy || blocked || !prev.ok ? "disabled" : ""}>${esc(this.t("startBoost"))}</button></div>`;
  }

  _input(el) {
    this._f = { ...this._f, [el.dataset.f]: el.value };
    const prev = this._preview();
    const span = this._root.querySelector("#prev");
    if (span) span.textContent = prev.text;
    const p = this._pump();
    const btn = this._root.querySelector('[data-act="start"]');
    if (btn && p) btn.disabled = this._busy || !prev.ok || val(this._hass, p.ents.mode) !== "auto" || (val(this._hass, p.ents.schedule) || "none") === "none";
  }

  _act(act, el) {
    const p = this._pump();
    if (!p) return;
    if (act === "by") { this._f = { ...this._f, by: el.dataset.v }; this._render(true); }
    else if (act === "end") this._do(() => call(this._hass, "stop_boost", { device_id: p.device_id }));
    else if (act === "start") {
      this._do(() => call(this._hass, "start_boost", { device_id: p.device_id, amount: parse(this._f.ml), [this._f.by]: Number(this._f.n) }));
    }
  }
}

// -- calibration card --------------------------------------------------------------------------

class LgalDoserCalibrationCard extends LgalBase {
  _title() { const p = this._pump(); return this._config.title || (p ? `${this.t("calTitle")} · ${pumpName(this._hass, p)}` : this.t("calTitle")); }
  _configChanged() { this._target = null; this._measured = null; this._tier = null; }
  _signature() {
    const p = this._pump();
    if (!p) return "none";
    return [p.ents.calibration, p.ents.calibration_pending, p.ents.calibration_due, p.ents.activity, p.ents.mode, p.ents.speed]
      .map((x) => { const s = st(this._hass, x); return s && [s.state, s.last_updated]; }).concat([this._target, this._tier]);
  }

  _body() {
    const p = this._pump();
    if (!p) return this._missing();
    const hass = this._hass;
    const e = p.ents;
    const cal = st(hass, e.calibration)?.attributes || {};
    const activity = val(hass, e.activity) || "idle";
    const mode = val(hass, e.mode);
    const pending = isOn(hass, e.calibration_pending) || !!cal.pending;
    const dueAttrs = st(hass, e.calibration_due)?.attributes || {};
    const rate = num(val(hass, e.calibration));
    const status = `<div class="row"><span>${cal.calibrated !== false && cal.calibrated_at
      ? esc(this.t("calOk", { when: fmtDate(cal.calibrated_at) }))
      : esc(this.t("calNever"))}</span>${rate ? `<span class="hint">${esc(this.t("calRate", { v: fmt(rate, 4) }))}</span>` : ""}</div>
      ${dueAttrs.tube_changed ? `<div class="alert warn">${esc(this.t("calTube"))}</div>` : isOn(hass, e.calibration_due) ? `<div class="alert warn">${esc(this.t("calDue"))}</div>` : ""}`;
    if (activity === "calibrating") return status + this._running(p);
    if (pending) {
      const target = num(attr(hass, e.calibration_pending, "target_ml")) || num(cal.target_ml) || 10;
      const measured = this._measured ?? String(target);
      return `${status}
        <div class="section">${esc(this.t("calMeasuredQ"))}</div>
        <div class="row"><span>${esc(this.t("calMeasured"))}</span><span class="ctl"><input class="num" type="number" inputmode="decimal" min="0" step="any" data-f="measured" value="${esc(measured)}"><span class="unit">ml</span></span></div>
        <div class="actions"><button class="btn" data-act="cancel" ${this._busy ? "disabled" : ""}>${esc(this.t("calDiscard"))}</button>
          <button class="btn primary" data-act="apply" ${this._busy ? "disabled" : ""}>${esc(this.t("calApply"))}</button></div>`;
    }
    const off = mode === "disabled";
    const busy = activity !== "idle" && activity !== "priming";
    const tier = this._tier || val(hass, e.speed) || "medium";
    return `${status}
      ${off ? `<div class="alert warn">${esc(this.t("pumpOff"))}</div>` : ""}
      ${activity !== "idle" ? this._running(p) : ""}
      <div class="step"><span class="num-badge">1</span><span class="grow">${esc(this.t("calStep1"))}</span>${this._holdButton(off || busy)}</div>
      <div class="step"><span class="num-badge">2</span><span class="grow">${esc(this.t("calStep2"))}</span></div>
      <div class="step"><span class="num-badge">3</span><span class="grow">${esc(this.t("calStep3"))}</span></div>
      <div class="row"><span>${esc(this.t("calTarget"))}</span><span class="ctl"><input class="num" type="number" inputmode="decimal" min="1" max="200" step="any" data-f="target" value="${esc(this._target ?? (cal.target_ml || 10))}"><span class="unit">ml</span></span></div>
      ${e.speed ? `<div class="row"><span>${esc(this.t("speed"))}</span>${this._speedChips(tier)}</div>` : ""}
      <div class="actions"><button class="btn primary" data-act="start" ${this._busy || off || activity !== "idle" ? "disabled" : ""}>${esc(this.t("calStart"))}</button></div>`;
  }

  _input(el) {
    if (el.dataset.f === "target") this._target = el.value;
    if (el.dataset.f === "measured") this._measured = el.value;
  }

  _act(act, el) {
    const p = this._pump();
    if (!p) return;
    const hass = this._hass;
    if (act === "tier") { this._tier = el.dataset.v; this._render(true); }
    else if (act === "stop") this._do(() => call(hass, "stop", { device_id: p.device_id }));
    else if (act === "start") {
      const amount = parse(this._target ?? attr(hass, p.ents.calibration, "target_ml") ?? 10);
      const speed = this._tier || val(hass, p.ents.speed);
      this._measured = null;
      this._do(() => call(hass, "calibrate", { device_id: p.device_id, action: "start", ...(amount ? { amount } : {}), ...(speed && TIERS.includes(speed) ? { speed } : {}) }));
    } else if (act === "apply") {
      const target = num(attr(hass, p.ents.calibration_pending, "target_ml")) || num(attr(hass, p.ents.calibration, "target_ml")) || 10;
      const amount = parse(this._measured ?? target);
      if (!(amount > 0)) return;
      this._do(() => call(hass, "calibrate", { device_id: p.device_id, action: "apply", amount }).then(() => { this._measured = null; }));
    } else if (act === "cancel") {
      this._do(() => call(hass, "calibrate", { device_id: p.device_id, action: "cancel" }).then(() => { this._measured = null; }));
    }
  }
}

LgalDoserCalibrationCard.css = `
  .step { display: flex; align-items: center; gap: 10px; min-height: 36px; flex-wrap: wrap; }
  .step .grow { flex: 1; min-width: 140px; }
  .num-badge { width: 22px; height: 22px; border-radius: 50%; background: var(--primary-color); color: var(--text-primary-color, #fff);
    font-size: .8em; display: inline-flex; align-items: center; justify-content: center; flex: none; }
`;

// -- pump settings card ------------------------------------------------------------------------

class LgalDoserPumpSettingsCard extends LgalBase {
  _title() { const p = this._pump(); return this._config.title || (p ? `${this.t("settingsTitle")} · ${pumpName(this._hass, p)}` : this.t("settingsTitle")); }
  getCardSize() { return 7; }
  _signature() {
    const p = this._pump();
    if (!p) return "none";
    return Object.values(p.ents).map((x) => { const s = st(this._hass, x); return s && s.state; });
  }

  _numRow(key, label, unit, hint, opts = {}) {
    const eid = this._pump().ents[key];
    if (!eid || !st(this._hass, eid)) return "";
    const s = st(this._hass, eid);
    const v = val(this._hass, eid);
    const a = s.attributes || {};
    return `<div class="row"><span class="lbl">${esc(label)}${hint ? `<small>${esc(hint)}</small>` : ""}</span><span class="ctl">
        <input class="${opts.short ? "short" : "num"}" type="number" inputmode="decimal" min="${a.min ?? 0}" max="${a.max ?? ""}" step="${opts.step || "any"}"
          data-f="${key}" value="${esc(v === null ? "" : fmtPlain(v))}" ${usable(this._hass, eid) ? "" : "disabled"}>
        ${unit ? `<span class="unit">${esc(unit)}</span>` : ""}</span></div>`;
  }

  _chipRow(key, label, options) {
    const eid = this._pump().ents[key];
    if (!eid || !st(this._hass, eid)) return "";
    const cur = val(this._hass, eid);
    const dis = usable(this._hass, eid) ? "" : "disabled";
    return `<div class="row"><span>${esc(label)}</span><div class="chips">${options.map(([v, l]) => `<button class="chip ${v === cur ? "on" : ""}" data-act="set" data-k="${key}" data-v="${v}" ${dis}>${esc(l)}</button>`).join("")}</div></div>`;
  }

  _body() {
    const p = this._pump();
    if (!p) return this._missing();
    const hass = this._hass;
    const e = p.ents;
    const tracked = !!attr(hass, e.container_remaining, "tracked");
    const defWarn = attr(hass, e.container_remaining, "warn_days");
    const defLow = attr(hass, e.container_remaining, "low_days");
    const remind = num(val(hass, e.remind_months));
    const remindOpts = [0, 1, 2, 3, 6, 9, 12, 18, 24];
    if (remind !== null && !remindOpts.includes(remind)) remindOpts.push(remind);
    const tubeH = num(val(hass, e.tube_hours));
    const tubeLimit = num(attr(hass, e.tube_hours, "limit_h"));
    const tubeWear = num(val(hass, e.tube_wear));
    const retract = val(hass, e.retract);
    const advanced = (e.direction && st(hass, e.direction)) || (e.retract && st(hass, e.retract));
    return `
      ${e.name ? `<div class="row"><span>${esc(this.t("name"))}</span><span class="ctl"><input class="text" type="text" maxlength="23" data-f="name" value="${esc(val(hass, e.name) || "")}" placeholder="${esc(this.t("pump", { n: p.n }))}"></span></div>` : ""}
      ${this._chipRow("mode", this.t("mode"), MODES.map((m) => [m, this.t(m)]))}
      ${this._chipRow("speed", this.t("speed"), TIERS.map((k) => [k, this.t(k)]))}
      ${this._numRow("daily_limit", this.t("dailyLimit"), "ml", this.t("zeroOff"))}

      <div class="section">${esc(this.t("container"))}</div>
      ${this._numRow("container_capacity", this.t("capacity"), "ml", this.t("capacityHint"), { step: 1 })}
      ${tracked ? this._numRow("container_content", this.t("content"), "ml", "", { step: "any" }) : ""}
      ${tracked && e.refill ? `<div class="actions"><button class="btn" data-act="press" data-k="refill" ${this._busy ? "disabled" : ""}>${esc(this.t("refilled"))}</button></div>` : ""}
      ${tracked ? this._numRow("warn_days", `${this.t("warnDays")} …`, this.t("daysUnit"), this.t("zeroDefault", { n: defWarn ?? 7 }), { short: true, step: 1 }) : ""}
      ${tracked ? this._numRow("low_days", `${this.t("lowDays")} …`, this.t("daysUnit"), this.t("zeroDefault", { n: defLow ?? 4 }), { short: true, step: 1 }) : ""}

      <div class="section">${esc(this.t("calTitle"))}</div>
      ${e.remind_months ? `<div class="row"><span>${esc(this.t("remind"))}</span><span class="ctl"><select data-f="remind_months">
        ${remindOpts.sort((a, b) => a - b).map((m) => `<option value="${m}" ${m === remind ? "selected" : ""}>${esc(m ? this.t("months", { n: m }) : this.t("remindOff"))}</option>`).join("")}
      </select></span></div>` : ""}

      <div class="section">${esc(this.t("tube"))}</div>
      <div class="row"><span>${esc(tubeH !== null ? this.t("tubeHours", { h: fmt(tubeH, 1), limit: fmt(tubeLimit, 0) }) : "–")}${tubeWear !== null ? ` · ${fmt(tubeWear, 0)} %` : ""}</span>
        ${e.tube_replaced ? `<button class="btn" data-act="tube">${esc(this.t("tubeReplaced"))}</button>` : ""}</div>
      ${tubeWear !== null ? `<div class="bar"><i style="width:${Math.min(100, tubeWear)}%;${tubeWear >= 100 ? "background:var(--error-color)" : tubeWear >= 80 ? "background:var(--warning-color)" : ""}"></i></div>` : ""}

      ${advanced ? `<div class="section">${esc(this.t("advanced"))}</div>
        ${this._chipRow("direction", this.t("direction"), [["cw", this.t("cw")], ["ccw", this.t("ccw")]])}
        ${this._chipRow("retract", this.t("retract"), [["off", this.t("off")], ["global", this.t("global")], ["own", this.t("own")]])}
        ${retract === "own" ? this._numRow("retract_rev", this.t("retractRev"), "", "", { short: true, step: 0.05 }) : ""}` : ""}`;
  }

  _input(el, commit) {
    if (!commit) return;
    const p = this._pump();
    if (!p) return;
    const key = el.dataset.f;
    const eid = p.ents[key];
    if (!eid) return;
    let value = el.value;
    if (key === "name") value = value.trim();
    else if (key === "remind_months") value = Number(value);
    else { value = parse(value); if (value === null) { this._render(true); return; } }
    this._do(() => setEntity(this._hass, eid, value));
  }

  _act(act, el) {
    const p = this._pump();
    if (!p) return;
    if (act === "set") {
      const eid = p.ents[el.dataset.k];
      if (eid) this._do(() => setEntity(this._hass, eid, el.dataset.v));
    } else if (act === "press") {
      const eid = p.ents[el.dataset.k];
      if (eid) this._do(() => setEntity(this._hass, eid));
    } else if (act === "tube") this._openDialog("tube");
    else if (act === "cancel") this._closeDialog();
    else if (act === "tube-go") { this._closeDialog(); this._do(() => setEntity(this._hass, p.ents.tube_replaced)); }
  }

  _dialogHtml() {
    return `<div class="dtitle">${esc(this.t("tubeReplaced").replace("…", ""))}</div><div class="dhint">${esc(this.t("tubeConfirm"))}</div>
      <div class="dactions"><button class="btn" data-act="cancel">${esc(this.t("cancel"))}</button><button class="btn primary" data-act="tube-go">${esc(this.t("confirm"))}</button></div>`;
  }
}

/** A number as an input value (dot decimal, no grouping). */
function fmtPlain(v) { const n = num(v); return n === null ? "" : String(Math.round(n * 1000) / 1000); }

LgalDoserPumpSettingsCard.css = `
  input.text { width: 12em; }
  .bar { margin-top: -4px; }
`;

// -- device card -------------------------------------------------------------------------------

class LgalDoserDeviceCard extends LgalBase {
  static getConfigForm() {
    return {
      schema: [{ name: "device", selector: { device: { integration: DOMAIN } } }, { name: "title", selector: { text: {} } }],
      computeLabel: (s) => ({ device: "Doser (optional)", title: "Title" })[s.name],
    };
  }
  getCardSize() { return 6; }
  _title() { return this._config.title || this.t("deviceTitle"); }
  _configChanged() { this._rules = null; this._manual = null; this._dirty = false; }
  _doser() { return pickDoser(this._hass, this._config.device); }
  _signature() {
    const d = this._doser();
    if (!d) return "none";
    return Object.values(d.ents).map((x) => { const s = st(this._hass, x); return s && [s.state, s.last_updated]; }).concat([this._dirty && [this._rules, this._manual], this._dirty]);
  }

  _ensureLocks(d) {
    if (!this._dirty || !this._rules) {
      const rules = attr(this._hass, d.ents.manual_during_lock, "rules") || [];
      this._rules = rules.map((r) => ({ a: r.pumps[0], b: r.pumps[1], gap: r.gap_min }));
      this._manual = val(this._hass, d.ents.manual_during_lock) || "reject";
    }
  }

  _lockProblems() {
    const out = [];
    if (this._rules.some((r) => Number(r.a) === Number(r.b))) out.push(this.t("pSamePump"));
    if (this._rules.some((r) => !Number.isInteger(Number(r.gap)) || Number(r.gap) < 1 || Number(r.gap) > 1440)) out.push(this.t("pGap"));
    return out;
  }

  _body() {
    const d = this._doser();
    if (!d) return `<div class="none">${esc(this.t("none"))}</div>`;
    const hass = this._hass;
    const e = d.ents;
    const pumps = [...d.pumps.values()].sort((a, b) => a.n - b.n);
    let html = "";
    const running = pumps.some((p) => (val(hass, p.ents.activity) || "idle") !== "idle");
    html += `<div class="actions">
        ${e.stop_all ? `<button class="btn danger" data-act="stopall" ${running ? "" : "disabled"}>${esc(this.t("stopAll"))}</button>` : ""}
        ${e.restart ? `<button class="btn" data-act="restart">${esc(this.t("restart"))}</button>` : ""}</div>`;
    if (e.led_night_mode && st(hass, e.led_night_mode)) {
      const on = isOn(hass, e.led_night_mode);
      const tm = (x) => (val(hass, x) || "").slice(0, 5);
      html += `<div class="section">${esc(this.t("ledNight"))}</div>
        <div class="row"><span>${esc(this.t("ledNight"))}</span><div class="chips">
          <button class="chip ${on ? "on" : ""}" data-act="led" data-v="on">${esc(this.t("on"))}</button>
          <button class="chip ${on ? "" : "on"}" data-act="led" data-v="off">${esc(this.t("off"))}</button></div></div>
        ${on && e.led_night_start ? `<div class="row"><span>${esc(this.t("ledFrom"))} / ${esc(this.t("ledTo"))}</span><span class="ctl">
          <input type="time" data-f="led_night_start" value="${esc(tm(e.led_night_start))}"> – <input type="time" data-f="led_night_end" value="${esc(tm(e.led_night_end))}"></span></div>` : ""}
        ${on && e.led_night_brightness ? `<div class="row"><span>${esc(this.t("brightness"))}</span><span class="ctl">
          <input class="short" type="number" min="0" max="100" step="1" data-f="led_night_brightness" value="${esc(fmtPlain(val(hass, e.led_night_brightness)))}"><span class="unit">%</span></span></div>` : ""}`;
    }
    if (e.manual_during_lock && st(hass, e.manual_during_lock)) {
      this._ensureLocks(d);
      const problems = this._lockProblems();
      const sel = (i, k, cur) => `<select data-f="rule-${k}" data-i="${i}">${pumps.map((p) => `<option value="${p.n}" ${p.n === Number(cur) ? "selected" : ""}>${esc(pumpName(hass, p))}</option>`).join("")}</select>`;
      html += `<div class="section">${esc(this.t("locks"))}</div>
        <div class="hint">${esc(this.t("locksHint"))}</div>
        ${this._rules.length ? this._rules.map((r, i) => `<div class="rule">${sel(i, "a", r.a)}<span>↔</span>${sel(i, "b", r.b)}
            <input class="short" type="number" min="1" max="1440" step="1" data-f="rule-gap" data-i="${i}" value="${esc(r.gap)}"><span class="unit">min</span>
            <button class="icon" data-act="delrule" data-i="${i}" title="${esc(this.t("remove"))}"><ha-icon icon="mdi:close"></ha-icon></button></div>`).join("")
          : `<div class="hint">${esc(this.t("noRules"))}</div>`}
        <div><button class="link" data-act="addrule" ${this._rules.length >= 10 || pumps.length < 2 ? "disabled" : ""}>+ ${esc(this.t("addRule"))}</button></div>
        <div class="row"><span>${esc(this.t("manualInLock"))}</span><div class="chips">
          <button class="chip ${this._manual === "reject" ? "on" : ""}" data-act="manual" data-v="reject">${esc(this.t("reject"))}</button>
          <button class="chip ${this._manual === "queue" ? "on" : ""}" data-act="manual" data-v="queue">${esc(this.t("queue"))}</button></div></div>
        ${problems.length ? `<div class="error">${problems.map(esc).join(" · ")}</div>` : ""}
        <div class="actions">${this._dirty ? `<span class="badge dirty">${esc(this.t("unsaved"))}</span><span class="spacer"></span><button class="btn" data-act="resetlocks">${esc(this.t("reload"))}</button>` : ""}
          <button class="btn primary" data-act="savelocks" ${!this._dirty || problems.length || this._busy ? "disabled" : ""}>${esc(this.t("saveLocks"))}</button></div>`;
    }
    if (e.firmware && st(hass, e.firmware)) {
      const a = st(hass, e.firmware).attributes || {};
      html += `<div class="section">${esc(this.t("firmware"))}</div>
        <div class="row"><span>${esc(this.t("installed", { v: a.installed_version || "–" }))}${a.latest_version && a.latest_version !== a.installed_version
          ? ` · <strong>${esc(this.t("latest", { v: a.latest_version }))}</strong>` : ` · ${esc(this.t("upToDate"))}`}</span>
          <button class="link" data-act="fw">${esc(this.t("details"))}</button></div>`;
    }
    return html;
  }

  _input(el, commit) {
    const d = this._doser();
    if (!d) return;
    const f = el.dataset.f;
    if (f.startsWith("rule-")) {
      const r = this._rules[Number(el.dataset.i)];
      if (f === "rule-a") r.a = Number(el.value);
      else if (f === "rule-b") r.b = Number(el.value);
      else r.gap = el.value === "" ? "" : Number(el.value);
      this._dirty = true;
      if (commit) this._render(true);
      return;
    }
    if (!commit) return;
    const eid = d.ents[f];
    if (!eid) return;
    const value = f === "led_night_brightness" ? parse(el.value) : el.value;
    if (value === null || value === "") return;
    this._do(() => setEntity(this._hass, eid, value));
  }

  _act(act, el) {
    const d = this._doser();
    if (!d) return;
    const hass = this._hass;
    const pumps = [...d.pumps.keys()].sort((a, b) => a - b);
    switch (act) {
      case "stopall": this._do(() => call(hass, "stop", { device_id: d.controller })); return;
      case "restart": this._openDialog("restart"); return;
      case "cancel": this._closeDialog(); return;
      case "restart-go": this._closeDialog(); this._do(() => setEntity(hass, d.ents.restart)); return;
      case "led": this._do(() => setEntity(hass, d.ents.led_night_mode, el.dataset.v === "on")); return;
      case "addrule": this._rules.push({ a: pumps[0], b: pumps[1], gap: 5 }); this._dirty = true; this._render(true); return;
      case "delrule": this._rules.splice(Number(el.dataset.i), 1); this._dirty = true; this._render(true); return;
      case "manual": this._manual = el.dataset.v; this._dirty = true; this._render(true); return;
      case "resetlocks": this._dirty = false; this._rules = null; this._render(true); return;
      case "savelocks":
        this._do(async () => {
          await call(hass, "set_lock_rules", {
            device_id: d.controller, manual: this._manual,
            rules: this._rules.map((r) => ({ pumps: [Number(r.a), Number(r.b)], gap_min: Number(r.gap) })),
          });
          this._dirty = false;
          this._rules = null;
        }, this.t("saved"));
        return;
      case "fw":
        this.dispatchEvent(new CustomEvent("lgal-close-dialog", { bubbles: true, composed: true }));
        this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: d.ents.firmware } }));
        return;
      default:
    }
  }

  _dialogHtml() {
    return `<div class="dtitle">${esc(this.t("restart").replace("…", ""))}</div><div class="dhint">${esc(this.t("restartConfirm"))}</div>
      <div class="dactions"><button class="btn" data-act="cancel">${esc(this.t("cancel"))}</button><button class="btn primary" data-act="restart-go">${esc(this.t("confirm"))}</button></div>`;
  }
}

LgalDoserDeviceCard.css = `
  .rule { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .rule select { max-width: 9em; }
  .rule .icon { margin-left: auto; color: var(--secondary-text-color); }
`;

// -- history card ------------------------------------------------------------------------------

class LgalDoserHistoryCard extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: "open" }); this._data = null; this._loading = false; this._at = 0; }
  setConfig(config) { this._config = { days: 14, ...config }; this._days = Number(this._config.days) || 14; this._data = null; if (this._hass) this._load(); }
  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    LOCALE = (hass && hass.locale && hass.locale.language) || undefined;
    if (first || Date.now() - this._at > 10 * 60 * 1000) this._load(); else if (!this.shadowRoot.innerHTML) this._render();
  }
  getCardSize() { return 5; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }
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
    const tr = (k, v) => t(hass, k, v);
    const d = pickDoser(hass, this._config.device);
    if (!d) { this.shadowRoot.innerHTML = `<style>${BASE_CSS}</style><ha-card><div class="none">${esc(tr("none"))}</div></ha-card>`; return; }
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
    const todayIso = localDate();
    const nameOf = (n) => (data && data.names && data.names[String(n)]) || tr("pump", { n });
    const bars = days.map((day, i) => pumps.map((n, k) => {
      const v = day.ml[n - 1] || 0;
      const x = L + i * gw + gw * 0.1 + k * bw;
      return `<rect x="${x.toFixed(1)}" y="${y(v).toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${(H - B - y(v)).toFixed(1)}" rx="1.5" style="fill:${seriesColor(n)}">
        <title>${esc(day.date)} · ${esc(nameOf(n))}: ${fmt(v)} ml, ${day.doses[n - 1]} ×${day.skipped[n - 1] ? `, ${day.skipped[n - 1]} ⨯` : ""}</title></rect>`;
    }).join("")).join("");
    const labelEvery = Math.ceil(days.length / 8);
    const labels = days.map((day, i) => (i % labelEvery === 0 || i === days.length - 1)
      ? `<text x="${(L + i * gw + gw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${day.date === todayIso ? esc(tr("todayShort")) : esc(new Date(`${day.date}T12:00:00`).toLocaleDateString(LOCALE, { day: "numeric", month: "numeric" }))}</text>` : "").join("");
    const grid = [0, 0.5, 1].map((f) => `<line x1="${L}" x2="${W}" y1="${y(top * f)}" y2="${y(top * f)}"/><text x="${L - 4}" y="${y(top * f) + 4}" text-anchor="end">${fmt(top * f, 1)}</text>`).join("");
    this.shadowRoot.innerHTML = `
      <style>${BASE_CSS}
        svg { width: 100%; height: auto; display: block; }
        svg text { font-size: 11px; fill: var(--secondary-text-color); }
        svg line { stroke: var(--divider-color, rgba(127,127,127,.3)); }
        .legend { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: .85em; margin-top: 8px; }
        .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 5px; }
        .hdr .chips { margin-left: auto; }
      </style>
      <ha-card>
        <div class="hdr"><span class="title">${esc(this._config.title || tr("history"))}</span>
          <div class="chips">${[7, 14, 30, 60].map((n) => `<button class="chip ${n === this._days ? "on" : ""}" data-days="${n}">${n}</button>`).join("")}</div></div>
        ${this._err ? `<div class="msg err">${esc(this._err)}</div>` : ""}
        ${!data ? `<div class="muted">…</div>` : !days.length || !totals.some((x) => x > 0) ? `<div class="muted">${esc(tr("noData"))}</div>` : `
          <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(tr("history"))}">${grid}${bars}${labels}</svg>`}
        <div class="legend">${pumps.map((n) => `<span><i style="background:${seriesColor(n)}"></i>${esc(nameOf(n))}: ${fmt(days.reduce((a, day) => a + (day.ml[n - 1] || 0), 0), 1)} ml</span>`).join("")}</div>
      </ha-card>`;
    this.shadowRoot.querySelectorAll("[data-days]").forEach((el) => el.addEventListener("click", () => { this._days = Number(el.dataset.days); this._load(); }));
  }
}

// -- registration ------------------------------------------------------------------------------

const CARDS = [
  ["lgal-doser-card", LgalDoserCard, "LGAL Doser", "Overview of the pumps of an LG Aquatic Life doser; tap a pump for dosing, schedule, boost, calibration and settings."],
  ["lgal-doser-manual-card", LgalDoserManualCard, "LGAL Doser manual dosing", "Dose one pump by hand and prime its tube."],
  ["lgal-doser-schedule-card", LgalDoserScheduleCard, "LGAL Doser schedule", "Edit the dosing schedule of one pump."],
  ["lgal-doser-boost-card", LgalDoserBoostCard, "LGAL Doser boost", "Extra amount for one pump over days or doses."],
  ["lgal-doser-calibration-card", LgalDoserCalibrationCard, "LGAL Doser calibration", "Calibrate one pump step by step."],
  ["lgal-doser-pump-settings-card", LgalDoserPumpSettingsCard, "LGAL Doser pump settings", "Name, mode, speed, daily limit, container and tube of one pump."],
  ["lgal-doser-device-card", LgalDoserDeviceCard, "LGAL Doser device", "Status LED night mode, lock times, restart and firmware of a doser."],
  ["lgal-doser-history-card", LgalDoserHistoryCard, "LGAL Doser history", "Dosed amount per day and pump."],
];
window.customCards = window.customCards || [];
for (const [tag, cls, name, description] of CARDS) {
  if (!customElements.get(tag)) customElements.define(tag, cls);
  if (!window.customCards.some((c) => c.type === tag)) window.customCards.push({ type: tag, name, description, preview: false });
}
console.info(`%c LG Aquatic Life cards %c ${VERSION} `, "background:#0d263b;color:#d69f31;font-weight:bold", "background:#3595a2;color:#fff");
})();
