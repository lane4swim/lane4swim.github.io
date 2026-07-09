# Lane 1 — Trainingsmanagement für Schwimmteams

Eine Offline-first, Single-Page Progressive Web App (PWA) für das
Trainingsmanagement eines Schwimmteams. Läuft vollständig im Browser,
speichert alle Daten lokal (IndexedDB) und benötigt nach dem ersten
Laden keine Internetverbindung mehr.

## Funktionsumfang

- **Athleten- & Teammanagement** — Profile, Trainingsgruppen
- **Wettkampfmanagement** — Wettkämpfe, Ergebnisse
- **Zeiten- & Leistungserfassung** — Bestzeiten, Verlaufsdiagramme
- **Trainingspläne** — Wochenkalender mit Sets/Serien **und Wiederholungsblöcken** (z. B. „3× [2×25 Sprint, 50 locker]“), aus Vorlagen erstellbar
- **Wiederverwendbare Vorlagen** für Trainingspläne
- **Übungskatalog** — durchsuchbare, taggable Übungsbibliothek
- **Einheiten-Tracking & Feedback** — Anwesenheit, RPE, Notizen
- **Handlungsfelder** — dokumentierte Entwicklungsziele je Athlet:in mit Status
- **Statistiken & Auswertungen** — Anwesenheitsquote, RPE-Trend, Leistungsentwicklung
- **Sync-Warteschlange** — Event-Queue (Outbox-Pattern) zur Vorbereitung einer künftigen Backend-Synchronisation, inkl. simulierter Übertragung in der Demo

Drei Rollen: **Trainer**, **Athlet** und **Administrator** (siehe unten).

## Lokal ausführen

Da die App ES-Module (`<script type="module">`) und einen Service
Worker verwendet, muss sie über **http(s)** ausgeliefert werden (nicht
per `file://` öffnen). Am einfachsten mit einem simplen lokalen Server,
z. B.:

```bash
cd swimapp
python3 -m http.server 8080
# dann im Browser: http://localhost:8080
```

Alternativ z. B. mit `npx serve` oder jedem anderen statischen
Webserver. Nach dem ersten Laden funktioniert die App auch offline
(Flugmodus, Server aus) — der Service Worker liefert dann alle
Dateien aus dem Cache, die Daten liegen bereits in IndexedDB.

## Installation als App

Im Browser (Chrome/Edge/Safari) über "Zum Startbildschirm hinzufügen"
bzw. das Installations-Icon in der Adressleiste. Die App startet dann
wie eine native App, inklusive Offline-Betrieb.

## Rollen & Demo-Zugänge

Beim ersten Start wird automatisch Demo-Daten geladen (Athlet:innen,
Gruppen, ein Wettkampf, Übungen, ein Trainingsplan). Über das
Auswahlfeld oben rechts kann zwischen drei Demo-Konten gewechselt
werden:

| Konto | Rolle | Sichtbare Bereiche |
|---|---|---|
| Sabine Reuter | Trainer:in | Alle Bereiche außer reinen Athleten-Ansichten |
| Team-Administrator | Administrator | Alle Bereiche |
| Mara Vogel | Athlet:in | Dashboard, Zeiten, Trainingspläne, Einheiten, eigene Handlungsfelder |

Da die App bewusst ohne Server/Backend läuft, ist "Anmelden" hier ein
einfacher Profil-Wechsler — für einen echten Mehrbenutzerbetrieb über
Geräte hinweg wäre eine Sync-Schicht nötig (siehe Erweiterbarkeit).

Unter **Einstellungen** (unten in der Seitenleiste) lassen sich alle
Daten als JSON exportieren oder auf die Demo-Daten zurücksetzen.

## Architektur & Erweiterbarkeit

- **Kein Build-Schritt.** Reines HTML/CSS/JS mit ES-Modulen — einfach
  zu hosten (auch als statische Dateien) und leicht nachvollziehbar.
- **`js/db.js`** — generischer IndexedDB-Wrapper (`getAll/get/put/remove`)
  über benannte "Stores". Ein neues Datenmodell = ein neuer Store-Name.
  `put()`/`remove()` schreiben bei jeder Änderung an einem fachlichen
  Store automatisch ein Event in den Store `syncQueue` (Outbox-Pattern,
  siehe unten) — Seed-/Import-Daten über `bulkPut()` lösen bewusst
  **keine** Sync-Events aus, da sie keine echte Nutzeraktion sind.
- **`js/router.js`** — minimaler Hash-Router mit Modul-Registry.
  Jedes Feature ist ein Modul mit `{ id, label, icon, roles, render() }`.
  Neue Module registrieren sich in `js/app.js` und erscheinen automatisch
  in Navigation (Desktop-Seitenleiste & Mobile-Tableiste), inkl.
  Rollenfilterung über `roles`.
- **`js/modules/*.js`** — ein Modul pro Fachbereich, lose gekoppelt
  über den Router (keine direkten Abhängigkeiten zwischen Modulen
  außer über `navigate()`).
- **`js/modules/setEditor.js`** — gemeinsame UI-Komponente für
  Sets/Serien, genutzt von Vorlagen und Trainingsplänen.
- **`js/utils.js`** — DOM-Helfer, Datumsfunktionen, Zeitformatierung,
  eigene, abhängigkeitsfreie SVG-Mini-Chart-Funktionen (kein CDN nötig
  → funktioniert offline).
- **`sw.js`** — Service Worker mit versioniertem Cache; beim Ändern
  von Dateien `CACHE_VERSION` erhöhen, damit Clients die neue Version
  laden.

### Ideen für künftige Erweiterungen

- Server-Sync-Adapter (z. B. REST/GraphQL) ergänzen, der die gleichen
  `db.js`-Funktionen im Hintergrund mit einem Server abgleicht
  (Conflict-Resolution nach `updatedAt`).
- Echtes Auth-System statt Profil-Wechsler, sobald ein Backend existiert.
- Export/Import einzelner Bereiche (z. B. nur Übungskatalog) zum
  Teilen zwischen Vereinen.
- Push-Benachrichtigungen für anstehende Einheiten/Wettkämpfe.
- Mehrsprachigkeit (aktuell auf Deutsch ausgelegt).

### Sync-Warteschlange (Event Queue / Outbox-Pattern)

Unter **„Sync-Warteschlange"** (Trainer/Admin) wird sichtbar, was im
Hintergrund passiert: Jedes Anlegen, Bearbeiten oder Löschen an einem
fachlichen Datensatz (Athlet:innen, Pläne, Zeiten, …) erzeugt ein
Event mit Status `pending`. Diese Events sind der Ausgangspunkt für
eine spätere echte Backend-Synchronisation:

1. Ein künftiger Sync-Prozess würde `pending`/`error`-Events in
   Reihenfolge an eine Server-API senden, sobald eine Verbindung
   besteht (z. B. beim `online`-Event des Browsers).
2. Erfolgreich übertragene Events werden als `synced` markiert
   (inkl. Zeitstempel), fehlgeschlagene als `error` mit Fehlermeldung
   und Retry-Zähler.
3. Da diese Version ganz ohne Server läuft, simuliert der Button
   „Jetzt synchronisieren (Demo)" genau diesen Ablauf lokal (inkl.
   gelegentlicher künstlicher Fehler, um die Retry-Funktion zu zeigen).

Die Anzahl offener Events erscheint als kleines Badge neben dem
Navigationspunkt. Für die echte Anbindung müsste im Wesentlichen nur
`runSimulatedSync()` in `js/modules/syncQueue.js` durch einen
tatsächlichen API-Aufruf ersetzt werden — die Datenstruktur der
Warteschlange (`store`, `entityId`, `action`, `payload`) ist bereits
so gehalten, dass sie sich 1:1 in typische REST-/GraphQL-Mutationen
übersetzen lässt.

## Design

Gestaltungsleitidee: die "Leinenmarkierung" (Lane Line) im
Schwimmbecken als wiederkehrendes Wellenmotiv, dazu eine an
Poolwasser/Kacheln angelehnte Farbpalette (tiefes Wasserblau, Petrol,
Chlor-Türkis als Akzent, Leinenkorall als Warnfarbe). Zeiten und
Zahlen werden konsequent in einer Monospace-Schrift gesetzt, Überschriften
in einer editorial wirkenden Serife.
