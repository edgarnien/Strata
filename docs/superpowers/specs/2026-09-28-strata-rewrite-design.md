# Strata Rewrite: Vite + TypeScript, Mediabunny-Export, CapCut-artiges Mobile-Layout

Datum: 2026-09-28 · Status: Entwurf zur Freigabe

## 1. Ziel und Kontext

Strata verwandelt Fotos in animierte Balken-Grafiken (vertikale „Strokes“) und exportiert sie als PNG oder MP4. Die meisten Exporte landen als Hochformat-Videos auf Social Media (Reels, TikTok, Stories).

Heute besteht das Tool aus einer einzigen `Strata`-Klasse in `script.js` (ca. 2800 Zeilen), dazu `styles.css` und `index.html`, ohne Build-Step. Der Video-Export nutzt `h264-mp4-encoder` (WASM, Software-Encoding): Jeder Frame wird per `getImageData` kopiert. Außerdem muss man die Animation erst live ansehen, bevor dieselbe Dauer gerendert wird.

### Wünsche des Nutzers

1. Der Export soll schneller werden, per Mediabunny.
2. Mobile-Ansicht wie CapCut: bearbeitet wird horizontal auf einer Scroll-Ebene.
3. Der Text „Upload …“ darf nach dem Upload nicht mehr hinter dem Bild durchblitzen.
4. Format: Standard ist 9:16. „FORMAT“ steht als Label über dem Button und nicht mehr darin. Das Dropdown listet 9:16 (vorausgewählt), 4:5, 16:9 und Original, jeweils mit Symbol davor und Pixelmaß dahinter.
5. Aktuelle Web-Technologien.

### Entscheidungen aus dem Brainstorming

| Thema | Entscheidung |
|---|---|
| Tech-Basis | Vite + TypeScript (strict), kein UI-Framework |
| Hosting | GitHub Pages über einen GitHub-Actions-Workflow |
| Encoder | Nur Mediabunny (WebCodecs). Der alte WASM-Encoder wird entfernt, es gibt keinen Fallback. |
| Videolänge | Wird über die Anzahl der **Durchläufe** eingestellt. Länge = Durchläufe × Bilder × (6 s ÷ Speed) |
| Durchlauf bei mehreren Bildern | Ein Durchlauf = alle Bilder je einmal |
| Mobile-Bedienprinzip | Variante A: horizontal scrollbare Werkzeugleiste unten, darüber nur der Regler des aktiven Werkzeugs |
| Architektur | Plattform-first: reine TS-Render-Engine, Video-Export im Web Worker |

### Erfolgskriterien

- Vorschau, PNG und Video sehen bei gleichen Einstellungen identisch aus. Dasselbe *t* ergibt denselben Frame.
- Der Video-Export startet ohne Live-Aufnahme, zeigt Fortschritt und lässt sich abbrechen.
- Der Export ist messbar schneller als bisher. Gemessen wird dieselbe Einstellung (9:16, 1 Bild, 2 Durchläufe, Speed 1×) mit altem und neuem Code in Chrome auf dem Mac. Ziel: mindestens 3× schneller. Die Messwerte werden im PR dokumentiert.
- Mobil (375 px Breite) ist die Vorschau immer sichtbar, und die Seite scrollt nie vertikal.
- Nach dem ersten Upload steht kein Upload-Text mehr im DOM.
- `npm run build` erzeugt eine statische Seite. Ein Push auf `main` deployt sie auf GitHub Pages.

### Nicht im Umfang

Neue Effekte oder Animationen, Audio, weitere Exportformate (WebM, GIF), 60 fps, Undo/Redo, PWA/Offline, Übersetzungen. Die UI-Sprache bleibt Englisch.

## 2. Projektstruktur & Tooling

```
index.html
vite.config.ts          base: '/picture-tool-motion/'
tsconfig.json           strict
package.json            deps: mediabunny · devDeps: vite, typescript, vitest
public/                 favicon.svg, logo.png
src/
  main.ts               Store anlegen, UI mounten, Capability-Check
  state/
    signal.ts           minimaler Signal-/Effect-Mechanismus
    store.ts            Settings-Typ, Defaults, Validierung, localStorage ('strata:v2')
  engine/               kein DOM-Zugriff; läuft im Main-Thread und im Worker
    rng.ts              Zufallsgenerator mit Seed (mulberry32)
    timeline.ts         t → { cycle, imageIndex, progress }; Durchläufe → Dauer
    formats.ts          Formatdefinitionen + Ausgabegröße (gerade Pixelzahl)
    analyze.ts          Vordergrund-Maske + Balkenraster/-auswahl, gecacht
    motions/            buildUp.ts, impulse.ts, wave.ts, fade.ts, glitch.ts, reveal.ts, index.ts
    render.ts           renderFrame(ctx, scene, t) und renderStill(ctx, scene)
  export/
    video.worker.ts     OffscreenCanvas + Mediabunny → MP4
    video.ts            Worker-Steuerung: start, progress, cancel, result
    image.ts            PNG-Export
    save.ts             Download bzw. Web Share
  ui/
    tools.ts            Werkzeug-Definitionen (einzige Quelle für Sidebar und Mobile-Leiste)
    layout.ts           Aufbau der App-Shell
    preview.ts          Vorschau-Canvas, Play-Loop, Drag & Drop
    toolbar.ts          Mobile-Werkzeugleiste + aktives Panel
    sidebar.ts          Desktop-Sidebar
    dropdown.ts         Dropdown-Komponente (Popover-API), genutzt für Format und Motion
    gallery.ts          Clip-Leiste: auswählen, entfernen, umsortieren, hinzufügen
    colorWheel.ts       Farbrad (Logik aus dem Bestand übernommen)
    exportDialog.ts     Export-Panel (<dialog>)
    toast.ts            nicht blockierende Hinweise
  styles/
    tokens.css          Farben, Abstände, Radien, Schrift als Custom Properties
    layout.css          App-Shell, Breakpoint, dvh/safe-area
    components.css      Buttons, Slider, Dropdown, Leiste, Dialog, Toast
tests/                  Vitest (Engine)
.github/workflows/deploy.yml
.gitignore              node_modules, dist, .DS_Store, .superpowers/
```

Nach der Migration werden gelöscht: `script.js`, `styles.css`, `lib/` (h264-mp4-encoder, hme.js, hme.wasm), `.claude/serve.py`. `.claude/launch.json` wird auf `npm run dev` umgestellt.

**Einmalige manuelle Aktion (Nutzer):** Im GitHub-Repo unter Settings → Pages die Quelle auf „GitHub Actions“ stellen.

## 3. Render-Engine & Zeitmodell

### Zeitmodell (`timeline.ts`)

- `cycleDuration = 6 / speed` (Sekunden)
- `totalCycles = loops × imageCount`
- `duration = totalCycles × cycleDuration`
- Für Zeit *t*: `cycle = floor(t / cycleDuration)`, `imageIndex = cycle mod imageCount`, `progress = (t mod cycleDuration) / cycleDuration`

Die Reihenfolge der Bilder ist die Reihenfolge in der Clip-Leiste. Vorschau und Video beginnen immer mit dem ersten Clip. Wer mit einem anderen Bild starten will, sortiert die Clips um. Die Vorschau loopt über `duration`.

Ist die Vorschau gestoppt, zeigt sie `renderStill` des ausgewählten Clips. Läuft sie, markiert die Clip-Leiste den gerade gezeigten Clip.

### Zufall (`rng.ts`)

Die Szene hält einen `seed`. Er wird beim App-Start zufällig gesetzt und ändert sich nur über den Shuffle-Button (⤮) in der Transport-Zeile. Alle bisherigen `Math.random()`-Stellen leiten sich künftig aus Seed-Kombinationen ab:

- Balken-Shuffle: `seed + imageIndex`
- Wave-Richtung, Impulse-Zentren, Glitch-Reihenfolge: `seed + cycle`
- Glitch-Flackern: `seed + cycle + frameIndex` mit `frameIndex = floor(t × 30)`

Die Vorschau rastert Zufallswerte damit auf dasselbe 30-fps-Raster wie der Export. Der Seed wird nicht gespeichert.

### Formate (`formats.ts`)

| id | Symbol | Label | Ausgabe |
|---|---|---|---|
| `9:16` (Default) | ▯ | 9:16 | 1080 × 1920 |
| `4:5` | ▯ | 4:5 | 1080 × 1350 |
| `16:9` | ▭ | 16:9 | 1920 × 1080 |
| `original` | □ | ORIGINAL | Bildgröße des **ersten** Clips, längste Kante höchstens 2000 px, beide Maße auf gerade Zahl abgerundet |

Feste Formate schneiden das Bild mittig zu (cover), wie bisher. Bei „Original“ wird jedes weitere Bild in den Rahmen des ersten Clips eingepasst (contain). Ohne Bild zeigt der Original-Eintrag „—“ statt Pixelmaß.

### Analyse (`analyze.ts`)

Die Algorithmen `buildForegroundMask`, `barIsTarget` und `selectStrokeBars` werden inhaltlich 1:1 übernommen, nur typisiert und in reine Funktionen zerlegt. Eingaben sind Pixeldaten statt DOM-Canvas.

Gecacht wird in Stufen, damit Regler flüssig bleiben:
1. Zugeschnittene Pixeldaten pro (Bild, Format)
2. Vordergrund-Maske pro (Bild, Format, Sensitivity)
3. Balkenauswahl pro (Maske, Size, Stretch, Threshold, removeFront)

Für IMG MASK wird zusätzlich das Farbraster des nächsten Bildes gecacht (1 px pro Balken).

### Animationen (`motions/`)

Jede Animation exportiert:

```ts
interface Motion {
  id: 'buildUp' | 'impulse' | 'wave' | 'fade' | 'glitch' | 'reveal';
  label: string;   // z.B. 'BUILD UP'
  icon: string;    // z.B. '↑'
  draw(ctx: Ctx2D, f: FrameInput): void;
}
// FrameInput: bars (bereits mit Seed gemischt), progress, cycle, frameIndex, rng,
//             color, image, nextImage, imgMask, width, height
```

Übernommen werden BUILD UP (↑), IMPULSE (◎), WAVE (∿), FADE (◑), GLITCH (▦) und REVEAL (◌), jeweils mit IMG-MASK-Variante. Das visuelle Verhalten bleibt gleich, abgesehen vom deterministischen Zufall. RANDOM entfällt, weil es im aktuellen UI nicht mehr angeboten wird.

### Rendern (`render.ts`)

- `renderFrame(ctx, scene, t)` ist die einzige Zeichenroutine für animierte Frames. `renderStill(ctx, scene)` zeichnet das statische Balkenbild (entspricht dem heutigen `pixelateImage`).
- Gezeichnet wird immer in Ausgabe-Koordinaten. Die Vorschau setzt vorher `ctx.setTransform(scale, …)` mit `scale = Vorschaugröße × devicePixelRatio ÷ Ausgabegröße`.
- `Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D`

Bilder werden per `createImageBitmap(file, { imageOrientation: 'from-image' })` geladen. Erlaubte Typen wie bisher: PNG, JPG, WebP, Mehrfachauswahl möglich.

## 4. Export

### Export-Panel (`exportDialog.ts`, `<dialog>`)

EXPORT öffnet ein Panel (mobil oben rechts, am Desktop unten in der Sidebar):

- Umschalter **VIDEO (MP4) | IMAGE (PNG)**
- Info-Zeile, z.B. `1080 × 1920 · 2 loops · 12.0 s · 360 frames`
- Button **EXPORT**. Während des Renderns: Fortschrittsbalken mit Prozent und **CANCEL**.
- Danach:
  - Wenn `navigator.canShare({ files })` möglich ist (typisch mobil): Button **SAVE / SHARE** öffnet das native Teilen-Menü, auf iOS inklusive „Video sichern“.
  - Sonst direkter Download.
- Dateiname: `strata-<format>-<YYYYMMDD-HHmm>.<ext>`, z.B. `strata-9x16-20260928-1432.mp4`

Während eines Video-Exports sind alle Werkzeuge gesperrt, und die Vorschau pausiert.

### Video-Worker (`video.worker.ts`)

1. Eingang: ImageBitmaps (per Structured Clone), Settings, Seed und die gecachten Analyse-Ergebnisse (Balken pro Bild, IMG-MASK-Raster).
2. `OffscreenCanvas(w, h)` mit 2D-Kontext.
3. Codec: `getFirstEncodableVideoCodec(['avc', 'hevc'], { width, height })`
4. Ausgabe: `new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() })`
5. Quelle: `new CanvasSource(canvas, { codec, quality: QUALITY_VERY_HIGH })`
6. Schleife: für `f = 0 … ceil(duration × 30) − 1` → `renderFrame(ctx, scene, f / 30)`, dann `await source.add(f / 30, 1 / 30)`
7. Etwa alle 10 Frames: `postMessage({ type: 'progress', value })`
8. Bei Abbruch: `output.cancel()`. Bei Erfolg wird der `ArrayBuffer` per Transfer zurückgegeben.

Framerate: fest 30 fps.

### PNG (`image.ts`)

Läuft die Vorschau gerade, wird der aktuell sichtbare Frame gerendert, sonst `renderStill`. Beides geht auf ein Canvas in Ausgabegröße, dann folgt `toBlob('image/png')`.

### Capability-Check

Beim Start prüft `canEncodeVideo('avc' | 'hevc', { width: 1080, height: 1920 })`, ob Video-Export möglich ist. Wenn nicht, ist VIDEO im Export-Panel deaktiviert, mit dem Hinweis: „Your browser can't create videos. Please use a current version of Chrome, Safari or Firefox.“

## 5. UI

### Stil

Der bisherige Look bleibt und wird aufgeräumt: dunkler Grund, Weiß als Akzent, Großbuchstaben-Labels, Arial/Helvetica. Alle Werte liegen als Custom Properties in `tokens.css`. Modernes CSS kommt zum Einsatz: Nesting, `:has()`, `dvh`, `env(safe-area-inset-*)`, `scroll-snap`.

### Werkzeuge (`tools.ts`)

Eine Liste definiert alle Werkzeuge. Daraus entstehen Sidebar (Desktop) und Leiste mit Panel (Mobil).

| Werkzeug | Icon | Steuerung | Bereich / Default |
|---|---|---|---|
| Size | ▣ | Slider | 25–100 · 80 |
| Stretch | ↔ | Slider | 0–100 · 0 |
| Threshold | ◐ | Slider | 0–100 · 35 |
| Remove | ✂ | Umschalter BACK/FRONT + Slider Sensitivity | BACK · 10–100 · 50 |
| Color | ● | Hex-Feld + Farbrad-Popover | #FFFFFF |
| Img Mask | ◧ | An/Aus (nur sichtbar ab 2 Bildern) | Aus |
| Motion | ∿ | Dropdown | BUILD UP |
| Speed | » | Slider, Wert sichtbar („2.0×“) | 0.5–10, Schritt 0.5 · 1.0 |
| Loops | ⟳ | Stepper, Wert sichtbar („2×“) | 1–10 · 2 |
| Format | ▯ | Label „FORMAT“ über Dropdown | 9:16 |
| Reset | ↺ | Button: setzt alle Einstellungen außer den Bildern auf Default | – |

Size, Stretch, Threshold und Sensitivity zeigen keine Zahlenwerte (wie im aktuellen Stand).

### Dropdown (`dropdown.ts`)

Button plus Liste über die Popover-API, mit ARIA-Listbox-Semantik und Tastaturbedienung (Pfeiltasten, Enter, Esc). Der Button zeigt nur die aktuelle Auswahl, bei Format z.B. `▯ 9:16  1080 × 1920`. Das Label steht darüber. Die Liste zeigt pro Eintrag ✓ (falls ausgewählt), Symbol, Label und Pixelmaß, rechtsbündig. Sie öffnet sich mobil nach oben, am Desktop nach unten. Positioniert wird per JS, ohne CSS Anchor Positioning.

### Mobile (Breite ≤ 768 px)

Die Höhe ist `100dvh`, es gibt kein vertikales Scrollen der Seite. Von oben nach unten:

1. **Top-Bar:** STRATA links, EXPORT rechts (deaktiviert ohne Bild).
2. **Vorschau:** füllt den restlichen Platz, das Format wird eingepasst.
3. **Transport-Zeile:** Play/Pause, Name der aktiven Animation (Tippen öffnet das Werkzeug Motion), Shuffle (⤮), rechts „2× · 12.0 s“.
4. **Clip-Leiste:** Thumbnails. Tippen wählt aus, das × am ausgewählten Clip entfernt ihn, Long-Press + Ziehen sortiert um, „+“ fügt hinzu.
5. **Panel:** die Steuerung des aktiven Werkzeugs.
6. **Werkzeugleiste:** horizontal scrollbar (`scroll-snap`), Icon + Label, aktives Werkzeug hervorgehoben. `padding-bottom: env(safe-area-inset-bottom)`.

**Leerer Zustand:** In der Vorschau steht nur „+ UPLOAD IMAGE“ mit „PNG · JPG · WEBP“, Transport- und Clip-Leiste fehlen, die Werkzeuge sind ausgegraut. Der Leerzustand wird aus dem Store gerendert und beim ersten Bild **aus dem DOM entfernt**. Es gibt keine CSS-Pseudo-Elemente mit Text mehr, damit ist das Durchblitzen behoben.

### Desktop (Breite > 768 px)

- **Sidebar links (ca. 280 px)** mit den Gruppen ADJUST (Size, Stretch, Threshold), BACKGROUND (Remove, Sensitivity), COLOR (Color, Img Mask), MOTION (Motion, Speed, Loops), FORMAT und am unteren Ende RESET und EXPORT.
- **Rechts:** Vorschau, darunter Transport-Zeile und Clip-Leiste (ersetzt die bisherige Galerie oben rechts).
- Drag & Drop von Dateien auf die Vorschau fügt Bilder hinzu.

## 6. Fehlerbehandlung

- `alert()` wird überall durch `toast.ts` ersetzt: ungültiger Dateityp, Bild nicht ladbar, Export-Fehler, Browser ohne Video-Export.
- Settings werden aus `localStorage['strata:v2']` geladen und feldweise validiert. Unbekannte oder ungültige Werte fallen auf den Default zurück, alte Schlüssel werden ignoriert. Zugriffe auf `localStorage` stehen in try/catch.
- Worker-Fehler kommen als `{ type: 'error', message }` zurück und erscheinen im Export-Panel.
- Schlägt das Laden eines Bildes fehl, wird es nicht in die Clip-Leiste aufgenommen.

## 7. Tests & Verifikation

**Vitest (Engine):**
- `timeline`: Dauer, Zyklus, Bildindex und Fortschritt für mehrere Kombinationen aus Bildern, Durchläufen und Speed.
- `rng`: Gleicher Seed ergibt die gleiche Folge, verschiedene Seeds ergeben verschiedene Folgen.
- `formats`: Maße wie in der Tabelle, bei Original gerade Zahlen und längste Kante ≤ 2000.
- `analyze`: Ein synthetisches Bild (dunkles Rechteck auf hellem Grund) liefert bei BACK Balken nur im Rechteck, bei FRONT nur außerhalb. Threshold 0 bzw. 90 entfernt 0 % bzw. 90 % der Kandidaten.
- `motions`: Mit einem aufzeichnenden Fake-Kontext ergeben gleicher Seed und gleiches *t* identische Zeichenbefehle. Das wird für jede Animation geprüft, mit und ohne IMG MASK.

**Im Browser (Browser-Pane):**
- Upload, alle Werkzeuge, Clip-Leiste
- Mobile-Ansicht bei 375 × 812
- Video-Export: Datei öffnet sich, Länge stimmt mit der Anzeige überein
- PNG-Export

**Safari:** falls Xcode vorhanden ist, im iOS-Simulator.

**Performance:** Exportzeit alt vs. neu mit identischer Einstellung, siehe Erfolgskriterien.

## 8. Migration

1. Aktuellen Stand sichern (erledigt: Commit `c0813cc`).
2. Branch `rewrite/vite-ts` anlegen und Vite + TS + Vitest aufsetzen, `.gitignore` ergänzen.
3. Engine portieren, inklusive Tests.
4. UI (Desktop + Mobile).
5. Export-Worker + Export-Panel.
6. GitHub-Pages-Workflow. Alte Dateien entfernen, sobald die neue Version alles kann.
