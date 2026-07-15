# Lane 1 — Trainingsmanagement für Schwimmteams

Eine Offline-first, Single-Page Progressive Web App (PWA) für das
Trainingsmanagement eines Schwimmteams. Läuft vollständig im Browser,
speichert alle Daten lokal (IndexedDB) und benötigt nach dem ersten
Laden keine Internetverbindung mehr.

## Funktionsumfang

- **Athleten- & Teammanagement** — Profile, Trainingsgruppen. Athletenprofile (Name/Identität) werden ausschließlich von Admins/Superadmins angelegt, geändert und gelöscht; Trainer:innen sehen den Bestand und arbeiten damit (Zeiten, Pläne, Einheiten, Handlungsfelder), können aber keine neuen Athlet:innen per Namenseingabe hinzufügen oder bestehende umbenennen/entfernen
- **Wettkampfmanagement** — Wettkämpfe, Startlisten (Wettkampfnummer, Lauf, Startbahn) mit integrierter Stoppuhr (inkl. Rundenzeiten) zur direkten Zeitmessung, und Ergebniserfassung
- **Zeiten- & Leistungserfassung** — Bestzeiten, Verlaufsdiagramme
- **Trainingspläne** — Wochenkalender mit Sets/Serien **und Wiederholungsblöcken** (z. B. „3× [2×25 Sprint, 50 locker]“), aus Vorlagen erstellbar
- **Wiederverwendbare Vorlagen** für Trainingspläne
- **Übungskatalog** — durchsuchbare, taggable Übungsbibliothek inkl. benötigter Ausrüstung, direkt im Trainingsplan-Editor sichtbar und dort auch bearbeitbar (ohne den Übungskatalog verlassen zu müssen)
- **Einheiten-Tracking & Feedback** — Anwesenheit, RPE, Notizen
- **Handlungsfelder** — dokumentierte Entwicklungsziele je Athlet:in mit Status
- **Statistiken & Auswertungen** — Anwesenheitsquote, RPE-Trend, Leistungsentwicklung
- **Sync-Warteschlange** — Event-Queue (Outbox-Pattern) zur Vorbereitung einer künftigen Backend-Synchronisation, inkl. simulierter Übertragung in der Demo
- **Mehrsprachigkeit** — Deutsch (de-DE) und Englisch (en-US) von Anfang an, Sprachumschalter in der Kopfzeile, pro Nutzer:in gespeichert, leicht um weitere Sprachen erweiterbar
- **Mein Profil** — jede:r Nutzer:in kann eigene Kontodaten (Name, E-Mail) sowie die bevorzugte Sprache selbst verwalten
- **Nutzerverwaltung** — Superadministrator:innen legen Vereine an und laden deren ersten Admin per zeitlich befristetem Einladungslink ein; Admins laden Trainer:innen/Athlet:innen ihres Vereins ebenso ein (aktuell als lokale Simulation, echte Backend-Anbindung folgt in Phase 4). Hinweis für bereits laufende Installationen: `js/db.js` wurde auf `DB_VERSION = 2` angehoben, damit die dafür neu benötigten IndexedDB-Stores (`clubs`, `invitations`) bei bestehenden Datenbanken automatisch nachträglich angelegt werden.

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

| Konto | Rolle | Sichtbare Bereiche | Sprache |
|---|---|---|---|
| System-Superadmin | Superadministrator:in | Nutzerverwaltung (Vereine anlegen, Admin-Einladungen) | de-DE |
| Sabine Reuter | Trainer:in | Alle Bereiche außer reinen Athleten-Ansichten | de-DE |
| Team-Administrator | Administrator | Alle Bereiche inkl. Nutzerverwaltung (Team einladen) | de-DE |
| Mara Vogel | Athlet:in | Dashboard, Zeiten, Trainingspläne, Einheiten, eigene Handlungsfelder | en-US |

Die Spalte „Sprache" zeigt bewusst unterschiedliche Werte: Mara Vogels
Konto ist auf Englisch voreingestellt, damit die Mehrsprachigkeit beim
Kontowechsel sofort sichtbar wird (Oberfläche wechselt automatisch
mit dem Konto — siehe Abschnitt „Mehrsprachigkeit" unten).

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
  Jedes Feature ist ein Modul mit `{ id, icon, roles, render() }` (der
  Navigationstext kommt über `t('nav.<id>')` aus dem i18n-System, nicht
  als fest codierter String im Modul). Neue Module registrieren sich in
  `js/app.js` und erscheinen automatisch in Navigation (Desktop-Seitenleiste
  & Mobile-Tableiste), inkl. Rollenfilterung über `roles`.
- **`js/i18n.js`** + **`js/i18n/de-DE.js`** / **`js/i18n/en-US.js`** —
  Übersetzungs-Engine (siehe eigener Abschnitt „Mehrsprachigkeit" unten).
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
- Weitere Sprachen über zusätzliche `js/i18n/<locale>.js`-Dateien (siehe unten).

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

## Mehrsprachigkeit (i18n)

Die App liegt von Anfang an in zwei Sprachpaketen vor: **Deutsch
(`de-DE`, Referenzsprache)** und **Englisch (`en-US`)**.

**Sprachwahl im UI:** In der Kopfzeile, direkt links neben dem
Konto-Auswahlfeld, sitzt ein kleines Sprach-Dropdown (🇩🇪/🇺🇸) — von
überall in der App mit einem Klick erreichbar. Die Auswahl wirkt
sofort auf die gesamte Oberfläche, ohne Neuladen.

**Datenmodell:** Jeder Nutzer-Datensatz im Store `users` trägt ein
Feld `locale` (z. B. `"de-DE"`, `"en-US"`) — die bevorzugte
Anzeigesprache dieses Kontos. Beim Wechseln des Kontos (oben rechts)
wechselt die Sprache automatisch mit; ändert man die Sprache über das
Dropdown, wird sie im aktuell aktiven Nutzer-Datensatz gespeichert
(`state.js: setUserLocale()`). Ohne bekannten Nutzer (z. B. ganz
erster Start) wird zunächst die Browsersprache erkannt, sonst auf
Deutsch zurückgefallen (`i18n.js: detectInitialLocale()`). Ein
Sprachwechsel löst dabei genau **einen** Re-Render aus (`setUserLocale()`
benachrichtigt nur die Sprach-Listener, nicht zusätzlich die
Konto-Listener) — jedes Fachmodul sichert seinen Render zusätzlich per
`beginRender()`/`isCurrent()` ab (`js/utils.js`), damit überlappende
Render-Aufrufe (gleich aus welchem Grund) nie zu doppelt angezeigtem
Inhalt führen können.

**Architektur:**
- **`js/i18n/de-DE.js`**, **`js/i18n/en-US.js`** — je ein flaches,
  nach Modul benanntes Schlüssel-Objekt (`{ athletes: {...}, plans: {...}, refdata: {...}, ... }`).
  `de-DE.js` ist die Referenz-/Fallback-Sprache; jeder neue Textschlüssel
  sollte zuerst dort ergänzt werden.
- **`js/i18n.js`** — die Engine: `t(key, vars)` löst einen Punkt-Pfad
  wie `t('athletes.deleteConfirm', { name })` in der aktiven Sprache
  auf, mit Fallback-Kette aktive Sprache → Deutsch → Schlüssel selbst
  (damit ein fehlender Text nie zum Absturz führt, sondern bestenfalls
  auffällt). `getAvailableLocales()` liefert die Liste fürs Dropdown.
- **Referenzdaten (Disziplinen, Schwimmlagen, Kategorien, Status, …)**
  bleiben in `js/refdata.js` unverändert als stabile, sprachunabhängige
  Codes (z. B. `"100 Freistil"`, `"technik"`, `"offen"`) — das sind die
  Werte, die tatsächlich in Athlet:innen, Ergebnissen, Plänen usw.
  gespeichert werden. Für die Anzeige übersetzt `trCode()` /
  `trLabel()` / `trOptions()` / `trOptionsFlat()` aus `i18n.js` diese
  Codes just-in-time in die aktive Sprache. Ein Wechsel der
  Anzeigesprache verändert also nie gespeicherte Daten, nur deren
  Darstellung.
- **`js/utils.js`** — `fmtDateLong()`/`fmtDateShort()` nutzen
  `getLocale()` für `toLocaleDateString()`, Datumsformate passen sich
  also ebenfalls an (z. B. `Mo., 12. Jan. 2026` vs. `Mon, Jan 12, 2026`).

**Eine weitere Sprache hinzufügen** (z. B. Französisch):
1. `js/i18n/de-DE.js` nach `js/i18n/fr-FR.js` kopieren (vollständigste
   Vorlage) und alle Werte übersetzen — Schlüssel-Struktur unverändert lassen.
2. In `js/i18n.js` im `LOCALES`-Objekt eine Zeile ergänzen:
   `'fr-FR': { label: 'Français', flag: '🇫🇷', dict: fr_FR }` (plus den
   passenden Import oben in der Datei).
3. Fertig — das Sprach-Dropdown, alle `t()`-Aufrufe und die
   Referenzdaten-Übersetzung (`refdata.*` im neuen Wörterbuch)
   funktionieren automatisch, ohne dass ein anderes Modul angefasst
   werden muss. Fehlt eine Übersetzung im neuen Sprachpaket, greift
   automatisch der Deutsch-Fallback.

## Design

Gestaltungsleitidee: die "Leinenmarkierung" (Lane Line) im
Schwimmbecken als wiederkehrendes Wellenmotiv, dazu eine an
Poolwasser/Kacheln angelehnte Farbpalette (tiefes Wasserblau, Petrol,
Chlor-Türkis als Akzent, Leinenkorall als Warnfarbe). Zeiten und
Zahlen werden konsequent in einer Monospace-Schrift gesetzt, Überschriften
in einer editorial wirkenden Serife.
