<p align="center"><a href="https://github.com/ssiergl/lgal-brand"><img src="https://raw.githubusercontent.com/ssiergl/lgal-brand/main/logo/lgal-plaque.svg" width="200" alt="LG Aquatic Life"></a></p>

# LG Aquatic Life für Home Assistant

Kurzfassung auf Deutsch. Die vollständige Doku (alle Entitäten, Aktionen, Karten-Optionen) steht in
[README.md](README.md).

Eigene Integration für die Geräte von **LG Aquatic Life**. Sie spricht jedes Gerät direkt im lokalen
Netz über dessen REST-API und eine Live-WebSocket-Verbindung an: keine Cloud, kein MQTT-Broker, keine
zusätzlichen Container. Geräte im Netz werden per mDNS von selbst gefunden; du fügst nur einen
API-Schlüssel ein.

Erster Gerätetyp ist der **LGAL Doser** (1 bis 5 Pumpenköpfe). Weitere Gerätetypen kommen als kleine
Module dazu. Drei Dashboard-Karten sind dabei und werden von der Integration selbst als Ressource
eingetragen.

Voraussetzung: **Home Assistant 2026.10** oder neuer.

## Installation

**Marketplace (Home Assistant 2026.11 und neuer):** **Einstellungen → Marketplace**, oben rechts
*Add from link* (Hinzufügen per Link), `ssiergl/lgal-ha` (oder `https://github.com/ssiergl/lgal-ha`)
eingeben, falls gefragt Typ *Integrations* wählen. „LG Aquatic Life" installieren und Home Assistant
neu starten. Neue Versionen erscheinen danach als Update.

**HACS (Home Assistant 2026.10):** HACS → ⋮ → Benutzerdefinierte Repositories →
`https://github.com/ssiergl/lgal-ha`, Typ *Integration*; installieren, neu starten. Ab 2026.11 zieht
HACS von selbst in den Marketplace um.

**Von Hand:** `custom_components/lg_aquatic_life` in den Ordner `custom_components` deiner
Home-Assistant-Konfiguration kopieren und neu starten.

## Einrichtung

1. In der Weboberfläche des Dosers auf die **Profi**-Ansicht schalten, **Einstellungen → Anmeldung →
   API-Schlüssel** öffnen, einen Schlüssel für Home Assistant anlegen und kopieren (`lgal_…`).
2. In Home Assistant erscheint der Doser meist unter **Einstellungen → Geräte & Dienste → Entdeckt**.
   *Hinzufügen* klicken und den Schlüssel einfügen. Sonst die Integration **LG Aquatic Life**
   hinzufügen und Adresse (`lgal-doser-xxxx.local` oder IP) und Schlüssel eingeben.
3. Der Einrichtungsassistent des Geräts muss abgeschlossen sein.

Wird der Schlüssel am Gerät gelöscht, fragt Home Assistant nach einem neuen.

## Geräte und Entitäten

Jeder Doser ist ein Gerät, **jeder bestückte Pumpenkopf ein eigenes Untergerät**, benannt wie die
Pumpe (z. B. „KH"). Gib dem Doser einen Bereich und lass den der Pumpenköpfe leer: Sie übernehmen
den Bereich des Dosers (einen eigenen nur für einen Kopf, der woanders steht). Die Entitäts-IDs
enthalten die Nummer der Pumpe, nicht ihren Namen, z. B. `sensor.lgal_doser_5_1122_pump_2_container_level`
mit dem angezeigten Namen „KH Füllstand“, die Entitäten des Dosers selbst enthalten keinen Bereich,
z. B. `binary_sensor.lgal_doser_5_1122_alarm`. Benennst du eine Pumpe um oder stellst den Doser in
einen anderen Bereich, ändern sich die angezeigten Namen, die IDs (und damit deine Automationen)
bleiben. Alte IDs, die Home Assistant beim Entfernen und erneuten Hinzufügen der Integration
zurückgibt, werden einmal auf dieses Schema umbenannt; IDs, die du danach selbst änderst, bleiben. Pro Pumpe gibt es u. a.
Behälterinhalt, Füllstand, Reichweite, heute dosiert/geplant, nächste Dosis, Aktivität mit Fortschritt
(live), letztes Ergebnis, Zeitplan, Kalibrierung, Schlauchverschleiß, Alarme als Binärsensoren,
Betriebsart, Tageslimit, Behältergröße, Name, Tasten für Dosieren/Stopp/Aufgefüllt und eine
Ereignis-Entität. Am Doser: Alarm und Warnung (wie die Status-LED), Uhr, 24-V-Versorgung,
Live-Verbindung, LED-Nachtmodus, Alle stoppen, Neustart und Firmware-Update.

## Aktionen

`dose`, `stop`, `prime`, `calibrate`, `set_container`, `refill`, `set_tube_hours`, `set_schedule`,
`start_boost`, `stop_boost`, `set_lock_rules`, `get_history`, `get_daily_history` (Domain
`lg_aquatic_life`). Alle nehmen ein `device_id`: das Pumpengerät oder den Doser plus `pump: 1…5`.
Fehler des Geräts kommen als verständliche, übersetzte Meldung zurück.

Jeder Eintrag der Geräte-Historie (Dosierung, ausgelassene Dosis, Ansaugen, Kalibrierung, Alarme, …)
ist ein Ereignis der Ereignis-Entitäten und ein `lg_aquatic_life_event` auf dem Event-Bus.

## Karten

```yaml
type: custom:lgal-doser-card            # Übersicht: ein Messzylinder je Pumpe mit Füllstand, ml-Skala,
                                        # Reichweite, heute und nächster Dosis. Tippen öffnet den
                                        # Pumpendialog mit den Reitern Dosieren, Zeitplan, Boost,
                                        # Kalibrierung, Pumpe und Gerät
```

Jeder Reiter gibt es auch als eigene Karte für eine Pumpe (`device: <Pumpengerät>` oder der Doser
plus `pump: 2`), etwa für eine Seite je Pumpe:

| Karte | Inhalt |
|---|---|
| `custom:lgal-doser-manual-card` | Manuelle Dosierung (Menge, Geschwindigkeit, Bestätigung, Stopp) und Ansaugen per Halten |
| `custom:lgal-doser-schedule-card` | Dosierplan: 24-h-Balken, Assistenten (Neuer Zeitplan, Gesamtmenge, Anzahl Dosierungen), Wochentage zum Antippen, Editor (Tagesmenge verteilen oder Einzelzeiten, Tage, Stromausfall), speichern |
| `custom:lgal-doser-boost-card` | Boost über Tage oder Dosierungen, laufenden Boost beenden |
| `custom:lgal-doser-calibration-card` | Kalibrier-Assistent Schritt für Schritt |
| `custom:lgal-doser-pump-settings-card` | Name, Betriebsart, Geschwindigkeit, Tageslimit, Behälter, Schwellen, Erinnerung, Schlauch |
| `custom:lgal-doser-device-card` | (Doser) Alle stoppen, Neustart, Nachtmodus der Status-LED, Sperrzeiten, Firmware |
| `custom:lgal-doser-history-card` | dosierte ml je Tag und Pumpe (7/14/30/60 Tage) |

Alle Karten haben einen visuellen Editor, finden Doser und Pumpen selbst, nehmen Farben, Flächen und
Bedienelemente aus dem Theme und sprechen Deutsch oder Englisch je nach Sprache des Benutzers.

## REST/WebSocket oder MQTT?

Der Doser kann auch an einen MQTT-Broker senden, mit *Home-Assistant-Discovery*. Das ist der Weg ohne
diese Integration (oder für andere Systeme, die MQTT lesen): Das Gerät erscheint dann über die
MQTT-Integration mit Sensoren je Pumpe und, wenn erlaubt, ein paar Steuerungen.

Diese Integration nutzt **kein** MQTT, sondern spricht direkt mit dem Gerät. Damit steht alles zur
Verfügung, was das Gerät kann (Zeitpläne, Kalibrierung, Boost, Sperrzeiten, Historie,
Firmware-Updates, Karten), ohne Broker und mit verständlichen Fehlermeldungen.

**Für Home Assistant nur einen der beiden Wege nutzen.** Mit dieser Integration in den MQTT-Einstellungen
des Dosers die *Home-Assistant-Discovery* ausschalten (oder MQTT ganz), sonst erscheint jede Pumpe
doppelt. MQTT für andere Abnehmer (Node-RED, Logger, …) kann an bleiben.

## Lizenz

GPL-3.0-or-later, siehe [LICENSE](LICENSE). Name und Logo von LG Aquatic Life
(`custom_components/lg_aquatic_life/brand/`) kennzeichnen die Marke und fallen nicht unter die Lizenz.
