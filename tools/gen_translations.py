# SPDX-FileCopyrightText: 2026 Lars Greiss / LG Aquatic Life
# SPDX-License-Identifier: GPL-3.0-or-later
# Usage: python3 tools/gen_translations.py custom_components/lg_aquatic_life/translations
"""Generates translations/en.json and de.json of lg_aquatic_life from one table (keys identical)."""
import json, pathlib, sys
OUT = pathlib.Path(sys.argv[1])

def t(en, de): return (en, de)

ACTIVITY = {"idle": t("Idle", "Bereit"), "dosing": t("Dosing", "Dosiert"), "priming": t("Priming", "Ansaugen"), "calibrating": t("Calibrating", "Kalibriert")}
RESULT = {"success": t("Done", "Erledigt"), "aborted": t("Stopped", "Abgebrochen"), "fault": t("Driver fault", "Treiberfehler"),
          "locked": t("Locked", "Gesperrt"), "supply_missing": t("No 24 V supply", "Keine 24-V-Versorgung"),
          "supply_low": t("24 V supply too low", "24-V-Versorgung zu niedrig"), "heartbeat_lost": t("Released", "Losgelassen"),
          "max_duration": t("Maximum duration", "Maximaldauer")}
PUMP_EVENTS = {"dose": t("Dose", "Dosierung"), "skip": t("Dose skipped", "Dosis übersprungen"), "prime": t("Priming", "Ansaugen"),
    "calib_run": t("Calibration run", "Kalibrierlauf"), "container": t("Container", "Behälter"), "calibration": t("Calibration applied", "Kalibrierung übernommen"),
    "tube": t("Tube", "Schlauch"), "alarm": t("Alarm", "Alarm"), "alarm_end": t("Alarm ended", "Alarm beendet"), "boost": t("Boost", "Boost"),
    "mode": t("Mode", "Betriebsart"), "schedule": t("Schedule", "Zeitplan"), "settings": t("Settings", "Einstellungen")}
DEVICE_EVENTS = {"system": t("System", "System"), "locks": t("Lock rules", "Sperrregeln"), "alarm": t("Alarm", "Alarm"), "alarm_end": t("Alarm ended", "Alarm beendet")}

ENTITY = {
 "sensor": {
  "container_remaining": (t("Container content", "Behälterinhalt"), None),
  "container_level": (t("Container level", "Füllstand"), None),
  "remaining_days": (t("Range", "Reichweite"), None),
  "dosed_today": (t("Dosed today", "Heute dosiert"), None),
  "planned_today": (t("Planned today", "Heute geplant"), None),
  "total_dosed": (t("Total dosed", "Gesamt dosiert"), None),
  "next_dose": (t("Next dose", "Nächste Dosis"), None),
  "next_dose_amount": (t("Next dose amount", "Menge nächste Dosis"), None),
  "activity": (t("Activity", "Aktivität"), ACTIVITY),
  "dose_progress": (t("Dose progress", "Dosierfortschritt"), None),
  "last_result": (t("Last result", "Letztes Ergebnis"), RESULT),
  "last_dose": (t("Last dose", "Letzte Dosis"), None),
  "skipped_today": (t("Skipped today", "Heute übersprungen"), None),
  "boost_remaining": (t("Boost remaining", "Boost Rest"), None),
  "schedule": (t("Schedule", "Zeitplan"), {"none": t("None", "Keiner"), "spread": t("Spread", "Verteilt"), "times": t("Single times", "Einzelzeiten")}),
  "calibration": (t("Calibration", "Kalibrierung"), None),
  "calibrated_at": (t("Calibrated at", "Kalibriert am"), None),
  "tube_hours": (t("Tube operating hours", "Schlauch-Betriebsstunden"), None),
  "tube_wear": (t("Tube wear", "Schlauchverschleiß"), None),
  "supply_voltage": (t("Supply voltage", "Versorgungsspannung"), None),
  "last_boot": (t("Last start", "Letzter Start"), None),
  "ip_address": (t("IP address", "IP-Adresse"), None),
  "network": (t("Network", "Netzwerk"), {"lan": t("LAN", "LAN"), "wlan": t("Wi-Fi", "WLAN"), "none": t("None", "Keins")}),
  "time_source": (t("Time source", "Zeitquelle"), None),
  "heap_free": (t("Free memory", "Freier Speicher"), None),
 },
 "binary_sensor": {
  "running": t("Running", "Läuft"),
  "container_low": t("Container almost empty", "Behälter fast leer"),
  "container_warning": t("Container running low", "Behälter wird knapp"),
  "driver_fault": t("Driver fault", "Treiberfehler"),
  "daily_limit_reached": t("Daily limit reached", "Tageslimit erreicht"),
  "calibration_due": t("Calibration due", "Kalibrierung fällig"),
  "tube_worn": t("Tube worn", "Schlauch verschlissen"),
  "boost_active": t("Boost", "Boost"),
  "calibration_pending": t("Calibration waiting for measurement", "Kalibrierung wartet auf Messwert"),
  "alarm": t("Alarm", "Alarm"),
  "warning": t("Warning", "Warnung"),
  "clock_problem": t("Clock", "Uhr"),
  "supply_problem": t("24 V supply", "24-V-Versorgung"),
  "live_connection": t("Live connection", "Live-Verbindung"),
 },
 "number": {
  "daily_limit": t("Daily limit", "Tageslimit"),
  "container_capacity": t("Container size", "Behältergröße"),
  "container_content": t("Container content", "Behälterinhalt"),
  "warn_days": t("Container warning (days)", "Behälter-Warnung (Tage)"),
  "low_days": t("Container alarm (days)", "Behälter-Alarm (Tage)"),
  "remind_months": t("Calibration reminder", "Kalibrier-Erinnerung"),
  "retract_rev": t("Anti-drip retract", "Rückzug gegen Tropfen"),
  "led_night_brightness": t("LED night brightness", "LED-Helligkeit nachts"),
  "dose_amount": t("Dose amount", "Dosiermenge"),
 },
 "select": {
  "mode": (t("Mode", "Betriebsart"), {"auto": t("Automatic", "Automatisch"), "manual_only": t("Manual only", "Nur manuell"), "disabled": t("Off", "Aus")}),
  "speed": (t("Speed", "Geschwindigkeit"), {"slow": t("Slow", "Langsam"), "medium": t("Medium", "Mittel"), "fast": t("Fast", "Schnell")}),
  "direction": (t("Direction", "Drehrichtung"), {"cw": t("Clockwise", "Im Uhrzeigersinn"), "ccw": t("Counter-clockwise", "Gegen den Uhrzeigersinn")}),
  "retract": (t("Retract", "Rückzug"), {"off": t("Off", "Aus"), "global": t("Default", "Standard"), "own": t("Own value", "Eigener Wert")}),
  "manual_during_lock": (t("Manual dose during lock time", "Manuelle Dosis in Sperrzeit"), {"reject": t("Reject", "Ablehnen"), "queue": t("Wait", "Warten")}),
 },
 "switch": {"automatic": t("Schedule", "Zeitplan"), "led_night_mode": t("LED night mode", "LED-Nachtmodus")},
 "text": {"name": t("Name", "Name")},
 "time": {"led_night_start": t("LED night start", "LED-Nacht Beginn"), "led_night_end": t("LED night end", "LED-Nacht Ende")},
 "button": {
  "dose": t("Dose", "Dosieren"), "stop": t("Stop", "Stopp"), "refill": t("Container refilled", "Behälter aufgefüllt"),
  "tube_replaced": t("Tube replaced", "Schlauch gewechselt"), "boost_stop": t("End boost", "Boost beenden"),
  "stop_all": t("Stop all", "Alle stoppen"), "restart": t("Restart", "Neustart"), "check_update": t("Check for updates", "Nach Updates suchen"),
 },
 "event": {"pump_events": (t("Events", "Ereignisse"), PUMP_EVENTS), "device_events": (t("Events", "Ereignisse"), DEVICE_EVENTS)},
 "update": {"firmware": t("Firmware", "Firmware")},
}

CODES = {
 "pump_busy": t("The pump is busy.", "Die Pumpe läuft gerade."),
 "pump_disabled": t("The pump is switched off.", "Die Pumpe ist ausgeschaltet."),
 "pump_not_fitted": t("The pump is not fitted.", "Die Pumpe ist nicht bestückt."),
 "pump_manual_only": t("The pump is set to manual only.", "Die Pumpe steht auf „Nur manuell“."),
 "locked": t("The pumps are locked (firmware update running).", "Die Pumpen sind gesperrt (Firmware-Update läuft)."),
 "supply_missing": t("No 24 V supply.", "Keine 24-V-Versorgung."),
 "supply_low": t("The 24 V supply is too low.", "Die 24-V-Versorgung ist zu niedrig."),
 "daily_limit": t("The daily limit would be exceeded.", "Das Tageslimit würde überschritten."),
 "time_invalid": t("The device has no valid time, the daily limit cannot be checked.", "Das Gerät hat keine gültige Zeit, das Tageslimit kann nicht geprüft werden."),
 "driver_unavailable": t("The pump driver does not answer.", "Der Pumpentreiber antwortet nicht."),
 "dose_too_small": t("The amount is below the smallest dose.", "Die Menge liegt unter der kleinsten Dosis."),
 "dose_too_large": t("The amount is too large.", "Die Menge ist zu groß."),
 "measured_out_of_range": t("The measured amount is implausible (0.25 to 4 times the nominal value).", "Die gemessene Menge ist unplausibel (0,25- bis 4-facher Nennwert)."),
 "no_calibration_run": t("There is no finished calibration run.", "Es gibt keinen abgeschlossenen Kalibrierlauf."),
 "not_priming": t("The pump is not priming.", "Die Pumpe saugt gerade nicht an."),
 "collision_lock": t("A lock time to another pump is running; possible from {retry}.", "Eine Sperrzeit zu einer anderen Pumpe läuft; möglich ab {retry}."),
 "queue_full": t("A dose is already waiting for the lock time to end.", "Eine Dosis wartet bereits auf das Ende der Sperrzeit."),
 "no_steps": t("The calibration run has no steps.", "Der Kalibrierlauf hat keine Schritte."),
 "speed_out_of_range": t("Speed out of range.", "Geschwindigkeit außerhalb des Bereichs."),
 "conflict": t("The schedule collides: {conflicts}", "Der Zeitplan kollidiert: {conflicts}"),
 "exceeds_daily_limit": t("The schedule exceeds the daily limit.", "Der Zeitplan überschreitet das Tageslimit."),
 "off_grid": t("Times must lie on the schedule grid (e.g. every 5 minutes): {message}", "Zeiten müssen im Raster liegen (z. B. alle 5 Minuten): {message}"),
 "duplicate_time": t("A time appears twice: {message}", "Eine Zeit kommt doppelt vor: {message}"),
 "invalid_count": t("Invalid number of doses (1–96).", "Ungültige Anzahl Dosen (1–96)."),
 "invalid_range": t("The end must lie after the start.", "Das Ende muss nach dem Beginn liegen."),
 "slots_too_dense": t("Too many doses for this time window.", "Zu viele Dosen für dieses Zeitfenster."),
 "invalid_days": t("No weekday selected.", "Kein Wochentag gewählt."),
 "no_slots": t("No scheduled doses in this period (a boost needs a schedule and automatic mode).", "Keine geplanten Dosen in diesem Zeitraum (Boost braucht einen Zeitplan und Automatik)."),
 "invalid_lock": t("Invalid lock rule.", "Ungültige Sperrregel."),
 "pump_running": t("Not possible while a pump runs.", "Nicht möglich, während eine Pumpe läuft."),
 "ota_in_progress": t("A firmware update is already running.", "Ein Firmware-Update läuft bereits."),
 "no_source": t("The device has no update source.", "Das Gerät hat keine Update-Quelle."),
 "no_update": t("No newer firmware available.", "Keine neuere Firmware verfügbar."),
 "invalid_param": t("Invalid value: {message}", "Ungültiger Wert: {message}"),
 "setup_required": t("The initial setup of the device is not finished.", "Die Ersteinrichtung des Geräts ist nicht abgeschlossen."),
 "storage_error": t("The device could not save.", "Das Gerät konnte nicht speichern."),
}

EXCEPTIONS = {
 "auth_failed": t("The API key was refused. Create a new key in the device's web interface.", "Der API-Key wurde abgelehnt. Lege in der Weboberfläche des Geräts einen neuen Key an."),
 "setup_required": t("The initial setup of the device is not finished. Finish it in the device's web interface.", "Die Ersteinrichtung des Geräts ist nicht abgeschlossen. Schließe sie in der Weboberfläche des Geräts ab."),
 "cannot_connect": t("Cannot reach the device at {host}.", "Das Gerät unter {host} ist nicht erreichbar."),
 "wrong_device": t("Another device answers at {host}.", "Unter {host} antwortet ein anderes Gerät."),
 "unsupported_device": t("This LG Aquatic Life device ({project}) is not supported yet.", "Dieses LG-Aquatic-Life-Gerät ({project}) wird noch nicht unterstützt."),
 "no_container": t("The pump has no container size set.", "Für die Pumpe ist keine Behältergröße eingestellt."),
 "pump_not_fitted": t("Pump {pump} is not fitted.", "Pumpe {pump} ist nicht bestückt."),
 "pump_required": t("Select a pump device, or the doser together with a pump number.", "Wähle ein Pumpen-Gerät oder den Doser zusammen mit einer Pumpennummer."),
 "unknown_device": t("This is not a device of the LG Aquatic Life integration (or it is not loaded).", "Das ist kein Gerät der LG-Aquatic-Life-Integration (oder es ist nicht geladen)."),
 "schedule_incomplete": t("The schedule needs: {fields}", "Für den Zeitplan fehlt: {fields}"),
 "measured_required": t("Enter the measured amount.", "Gib die gemessene Menge an."),
 "container_required": t("Enter the container size or the content.", "Gib Behältergröße oder Inhalt an."),
 "boost_period_required": t("Enter days or doses for the boost.", "Gib Tage oder Dosen für den Boost an."),
 "err_device_error": t("The device refused: {message} ({code})", "Das Gerät hat abgelehnt: {message} ({code})"),
}
for code, txt in CODES.items():
    EXCEPTIONS[f"err_{code}"] = txt

DEV_FIELD = {"device_id": (t("Device", "Gerät"), t("A pump, or the doser (then set the pump number).", "Eine Pumpe oder der Doser (dann die Pumpennummer angeben).")),
             "pump": (t("Pump", "Pumpe"), t("Pump number 1–5, only when the doser itself is selected.", "Pumpennummer 1–5, nur wenn der Doser selbst gewählt ist."))}
SPEED_F = {"speed": (t("Speed", "Geschwindigkeit"), t("Speed tier; default: the pump's setting.", "Geschwindigkeitsstufe; Standard: Einstellung der Pumpe."))}
SERVICES = {
 "dose": (t("Dose", "Dosieren"), t("Doses an amount now (daily limit, lock times and container apply).", "Dosiert jetzt eine Menge (Tageslimit, Sperrzeiten und Behälter gelten)."),
          {**DEV_FIELD, "amount": (t("Amount", "Menge"), t("Amount in ml.", "Menge in ml.")), **SPEED_F}),
 "stop": (t("Stop", "Stoppen"), t("Stops a pump (or all, when the doser itself is selected).", "Stoppt eine Pumpe (oder alle, wenn der Doser selbst gewählt ist)."), DEV_FIELD),
 "prime": (t("Prime", "Ansaugen"), t("Fills the tube. With a duration it primes for that long; without one it primes while 'beat' keeps coming (hold to run).", "Füllt den Schlauch. Mit Dauer saugt sie so lange an; ohne Dauer, solange 'beat' kommt (gedrückt halten)."),
          {**DEV_FIELD, "action": (t("Action", "Aktion"), t("start, beat (keep running) or stop.", "start, beat (weiterlaufen) oder stop.")),
           "duration": (t("Duration", "Dauer"), t("Seconds (the device stops at its own maximum).", "Sekunden (das Gerät stoppt bei seinem eigenen Maximum).")), **SPEED_F}),
 "calibrate": (t("Calibrate", "Kalibrieren"), t("Calibration: start a run, then apply the amount measured in the cup, or cancel.", "Kalibrierung: Lauf starten, dann die im Messbecher gemessene Menge übernehmen oder abbrechen."),
          {**DEV_FIELD, "action": (t("Action", "Aktion"), t("start, apply or cancel.", "start, apply oder cancel.")),
           "amount": (t("Amount", "Menge"), t("start: target amount (default from the device); apply: measured amount in ml.", "start: Zielmenge (Standard vom Gerät); apply: gemessene Menge in ml.")), **SPEED_F}),
 "set_container": (t("Set container", "Behälter setzen"), t("Sets container size and/or content. Size alone = new, full container; size 0 = no tracking.", "Setzt Behältergröße und/oder Inhalt. Nur Größe = neuer, voller Behälter; Größe 0 = keine Verfolgung."),
          {**DEV_FIELD, "capacity": (t("Size", "Größe"), t("Container size in ml.", "Behältergröße in ml.")), "remaining": (t("Content", "Inhalt"), t("Current content in ml.", "Aktueller Inhalt in ml."))}),
 "refill": (t("Container refilled", "Behälter aufgefüllt"), t("Sets the content to the container size.", "Setzt den Inhalt auf die Behältergröße."), DEV_FIELD),
 "set_tube_hours": (t("Set tube hours", "Schlauchstunden setzen"), t("Sets the tube operating hours; 0 = new tube (calibrate again afterwards).", "Setzt die Schlauch-Betriebsstunden; 0 = neuer Schlauch (danach neu kalibrieren)."),
          {**DEV_FIELD, "hours": (t("Hours", "Stunden"), t("Operating hours.", "Betriebsstunden."))}),
 "set_schedule": (t("Set schedule", "Zeitplan setzen"), t("Sets the pump's schedule. Fields left out keep their current value; kind 'none' deletes it.", "Setzt den Zeitplan der Pumpe. Weggelassene Felder behalten ihren Wert; Art 'none' löscht ihn."),
          {**DEV_FIELD,
           "schedule": (t("Schedule (JSON)", "Zeitplan (JSON)"), t("The complete schedule as the device's JSON; replaces all other fields.", "Der komplette Zeitplan als JSON des Geräts; ersetzt alle anderen Felder.")),
           "kind": (t("Kind", "Art"), t("spread (daily amount in N doses), times (single times) or none.", "spread (Tagesmenge in N Dosen), times (Einzelzeiten) oder none.")),
           "amount": (t("Daily amount", "Tagesmenge"), t("ml per day (spread).", "ml pro Tag (spread).")),
           "doses": (t("Doses", "Dosen"), t("Number of doses per day (spread).", "Anzahl Dosen pro Tag (spread).")),
           "start": (t("Start", "Beginn"), t("First dose HH:MM (spread).", "Erste Dosis HH:MM (spread).")),
           "end": (t("End", "Ende"), t("Last dose HH:MM (spread, more than one dose).", "Letzte Dosis HH:MM (spread, mehr als eine Dosis).")),
           "times": (t("Times", "Zeiten"), t("List of entries with time (HH:MM) and ml (times).", "Liste von Einträgen mit time (HH:MM) und ml (times).")),
           "days": (t("Days", "Tage"), t("daily, weekdays or interval.", "daily, weekdays oder interval.")),
           "weekdays": (t("Weekdays", "Wochentage"), t("mon … sun (days: weekdays).", "mon … sun (days: weekdays).")),
           "every": (t("Every N days", "Alle N Tage"), t("Interval in days (days: interval).", "Abstand in Tagen (days: interval).")),
           "anchor": (t("Start date", "Startdatum"), t("First day of the interval.", "Erster Tag des Intervalls.")),
           "power_loss": (t("After a power cut", "Nach Stromausfall"), t("skip_missed or catch_up_window.", "skip_missed oder catch_up_window.")),
           "catch_up_min": (t("Catch-up window", "Nachholfenster"), t("Minutes in which missed doses are caught up.", "Minuten, in denen verpasste Dosen nachgeholt werden."))}),
 "start_boost": (t("Start boost", "Boost starten"), t("Doses an extra amount spread over days or over the next scheduled doses.", "Dosiert eine Zusatzmenge verteilt über Tage oder die nächsten geplanten Dosen."),
          {**DEV_FIELD, "amount": (t("Amount", "Menge"), t("Extra amount in ml.", "Zusatzmenge in ml.")),
           "days": (t("Days", "Tage"), t("Spread over 1–30 days.", "Verteilt über 1–30 Tage.")), "doses": (t("Doses", "Dosen"), t("Spread over the next 1–100 doses.", "Verteilt über die nächsten 1–100 Dosen."))}),
 "stop_boost": (t("End boost", "Boost beenden"), t("Ends a running boost.", "Beendet einen laufenden Boost."), DEV_FIELD),
 "set_lock_rules": (t("Set lock rules", "Sperrregeln setzen"), t("Minimum gaps between pumps and what a manual dose does during a lock time.", "Mindestabstände zwischen Pumpen und was eine manuelle Dosis in der Sperrzeit tut."),
          {**DEV_FIELD, "manual": (t("Manual dose", "Manuelle Dosis"), t("reject or queue.", "reject oder queue.")),
           "rules": (t("Rules", "Regeln"), t("List of entries with pumps (two numbers) and gap_min; replaces all rules.", "Liste von Einträgen mit pumps (zwei Nummern) und gap_min; ersetzt alle Regeln."))}),
 "get_history": (t("Get history", "Historie abrufen"), t("Returns the history events of the device (or of one pump).", "Liefert die Historien-Ereignisse des Geräts (oder einer Pumpe)."),
          {**DEV_FIELD, "days": (t("Days", "Tage"), t("Period 1–60 days.", "Zeitraum 1–60 Tage.")),
           "kinds": (t("Kinds", "Arten"), t("e.g. dose, skip, alarm.", "z. B. dose, skip, alarm.")),
           "limit": (t("Limit", "Anzahl"), t("At most this many events (1–500).", "Höchstens so viele Ereignisse (1–500).")),
           "offset": (t("Offset", "Versatz"), t("Skip this many events (paging).", "So viele Ereignisse überspringen (Blättern)."))}),
 "get_daily_history": (t("Get daily amounts", "Tagesmengen abrufen"), t("Returns the dosed amount, number of doses and skipped doses per day and pump.", "Liefert dosierte Menge, Anzahl Dosen und übersprungene Dosen pro Tag und Pumpe."),
          {**DEV_FIELD, "days": (t("Days", "Tage"), t("1–60 days.", "1–60 Tage."))}),
}

CONFIG = {
 "flow_title": t("{name}", "{name}"),
 "step": {
  "user": {"title": t("Add an LG Aquatic Life device", "LG-Aquatic-Life-Gerät hinzufügen"),
           "description": t("Address of the device and an API key. Create the key in the device's web interface: Settings → Sign-in → API keys (pro view).",
                            "Adresse des Geräts und ein API-Key. Den Key legst du in der Weboberfläche des Geräts an: Einstellungen → Anmeldung → API-Keys (Pro-Ansicht)."),
           "data": {"host": t("Address", "Adresse"), "api_key": t("API key", "API-Key")},
           "data_description": {"host": t("Host name (e.g. lgal-doser-e4f5.local) or IP address.", "Hostname (z. B. lgal-doser-e4f5.local) oder IP-Adresse."),
                                "api_key": t("Starts with lgal_. Shown only once when it is created.", "Beginnt mit lgal_. Wird nur beim Anlegen einmal angezeigt.")}},
  "zeroconf_confirm": {"title": t("LG Aquatic Life device found", "LG-Aquatic-Life-Gerät gefunden"),
           "description": t("{name} was found at {host}. Create an API key at {url} (Settings → Sign-in → API keys, pro view) and enter it here.",
                            "{name} wurde unter {host} gefunden. Lege unter {url} einen API-Key an (Einstellungen → Anmeldung → API-Keys, Pro-Ansicht) und gib ihn hier ein."),
           "data": {"api_key": t("API key", "API-Key")}},
  "reauth_confirm": {"title": t("New API key", "Neuer API-Key"),
           "description": t("The device at {host} refused the API key. Create a new one at {url} and enter it here.",
                            "Das Gerät unter {host} hat den API-Key abgelehnt. Lege unter {url} einen neuen an und gib ihn hier ein."),
           "data": {"api_key": t("API key", "API-Key")}},
  "reconfigure": {"title": t("Change address or key", "Adresse oder Key ändern"),
           "description": t("Address and API key of the device.", "Adresse und API-Key des Geräts."),
           "data": {"host": t("Address", "Adresse"), "api_key": t("API key", "API-Key")}},
 },
 "error": {
  "invalid_auth": t("The API key was refused.", "Der API-Key wurde abgelehnt."),
  "cannot_connect": t("The device cannot be reached.", "Das Gerät ist nicht erreichbar."),
  "setup_required": t("Finish the initial setup of the device first.", "Schließe zuerst die Ersteinrichtung des Geräts ab."),
  "not_lgal": t("This is not an LG Aquatic Life device.", "Das ist kein LG-Aquatic-Life-Gerät."),
  "unsupported_device": t("This LG Aquatic Life device is not supported yet.", "Dieses LG-Aquatic-Life-Gerät wird noch nicht unterstützt."),
  "unknown": t("Unexpected error.", "Unerwarteter Fehler."),
 },
 "create_entry": {
  "default": t("**{name}** is set up. Choose an area for **{name}** only: its pump heads below take it over as long as their own area stays empty.",
               "**{name}** ist eingerichtet. Wähle nur für **{name}** einen Bereich: Die Pumpenköpfe darunter übernehmen ihn, solange ihr eigener Bereich leer bleibt."),
 },
 "abort": {
  "already_configured": t("The device is already set up.", "Das Gerät ist bereits eingerichtet."),
  "reauth_successful": t("The new API key is saved.", "Der neue API-Key ist gespeichert."),
  "reconfigure_successful": t("Saved.", "Gespeichert."),
  "wrong_device": t("Another device answers at this address.", "Unter dieser Adresse antwortet ein anderes Gerät."),
  "not_lgal": t("This is not an LG Aquatic Life device.", "Das ist kein LG-Aquatic-Life-Gerät."),
 },
}

def pick(x, i):
    if isinstance(x, tuple) and len(x) == 2 and all(isinstance(s, str) for s in x): return x[i]
    if isinstance(x, dict): return {k: pick(v, i) for k, v in x.items()}
    raise TypeError(x)

def build(i):
    ent = {}
    for platform, items in ENTITY.items():
        ent[platform] = {}
        for key, val in items.items():
            if isinstance(val[0], tuple):
                name, states = val
                e = {"name": name[i]}
                if states:
                    if platform == "event":
                        e["state_attributes"] = {"event_type": {"state": {k: v[i] for k, v in states.items()}}}
                    else:
                        e["state"] = {k: v[i] for k, v in states.items()}
                ent[platform][key] = e
            else:
                ent[platform][key] = {"name": val[i]}
    svc = {}
    for name, (title, desc, fields) in SERVICES.items():
        svc[name] = {"name": title[i], "description": desc[i], "fields": {f: {"name": a[i], "description": b[i]} for f, (a, b) in fields.items()}}
    return {
        "config": pick(CONFIG, i),
        "device": {"pump": {"name": ["Pump {number}", "Pumpe {number}"][i]}},
        "entity": ent,
        "exceptions": {k: {"message": v[i]} for k, v in EXCEPTIONS.items()},
        "services": svc,
    }

for i, lang in enumerate(("en", "de")):
    (OUT / f"{lang}.json").write_text(json.dumps(build(i), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
# services.yaml stub data for the generator below

