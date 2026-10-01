# Video-Modus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strata bekommt einen zweiten Modus „Video“: Videoclips hochladen, Schnitte (Clip-Grenzen und eigene Marker) mit den vorhandenen Stroke-Motions verkleiden, Intro/Outro, Export als MP4 mit Originalton.

**Architecture:** Ein reines Zeitmodell (`videoTimeline.ts`) rechnet jede Ausgabezeit in Shot, Quellzeit und den bekannten Motion-`progress` um, sodass Motions, MOVE und PACE unverändert weiterlaufen. Die Vorschau spielt die Clips in versteckten `<video>`-Elementen und zeichnet sie samt Strokes ins Canvas; der Export dekodiert framegenau mit Mediabunny im bestehenden Worker und mischt den Ton als PCM.

**Tech Stack:** Vite 8, TypeScript 7 (strict), Vitest 5, Mediabunny 1.60 (Input/CanvasSink/AudioSampleSink, Output/CanvasSource/AudioSampleSource), kein UI-Framework.

**Spec:** `docs/superpowers/specs/2026-10-01-video-mode-design.md`

## Global Constraints

- Keine neuen Abhängigkeiten; Mediabunny `^1.60.0` ist schon da.
- TypeScript strict, `noUnusedLocals`/`noUnusedParameters` – `npm run build` (inkl. `tsc --noEmit`) muss nach jedem Task grün sein.
- Foto-Modus verhält sich unverändert; alle bestehenden Tests bleiben grün (Ausgangsstand: 215 Tests).
- Ausgabe-Framerate 30 fps (`FPS` aus `src/engine/timeline.ts`), Formate aus `src/engine/formats.ts`, Standardformat 9:16.
- DAUER (`dauer`): Bereich 0,2–1,5 s, Schritt 0,1 s, Standard 0,6 s. Ein Übergang = 2 · D, Intro und Outro je D.
- Standards Video: `intro: true`, `outro: true`, `audio: true`; Standardmodus `photo`.
- MP4-Export im Video-Modus nur bis 180 s Ausgabelänge.
- Oberflächentexte auf Englisch in Versalien wie die bestehende App: `PHOTO` / `VIDEO`, `DURATION`, `INTRO`, `OUTRO`, `SOUND`, `+ MARKER`, `+ CLIP`, `+ UPLOAD VIDEO`, `MP4 · MOV · WEBM`. Die deutschen Begriffe der Spec (DAUER, TON …) sind Konzeptnamen; im Code heißt das Feld `dauer`.
- HSBI-CD: Balken bleiben im Raster, keine neuen Moves.
- Commits im bestehenden Stil (`feat(video): …`, `refactor(engine): …`), jede Commit-Message endet mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **iPhone-Hochkantclip mit Rotations-Metadaten** → muss in Vorschau und Export aufrecht und identisch erscheinen (Task 9 nutzt die Display-Größe, Task 15 prüft mit einer per ffmpeg rotierten Datei Vorschau-Pixel gegen Export-Pixel).
2. **Sehr kurzer Clip zwischen langen (kürzer als 2 · D)** → DAUER wird gedeckelt, Phasen überlappen nie, `progress` bleibt in [0, 1] (Test in Task 4 und Task 5).
3. **Clips ohne Tonspur gemischt mit Clips mit Ton / SOUND an, aber kein Clip hat Ton** → Export klappt, Stille bzw. keine Tonspur (Test in Task 7, Browser-Check in Task 15).
4. **Clip entfernen, während seine Analyse-Frames noch geladen werden oder die Vorschau läuft** → kein Absturz, keine veraltete Szene (Generationszähler in Task 9, Player-Aufräumen in Task 10, Browser-Check in Task 15).
5. **Marker auf einen anderen Marker, an den Clip-Rand oder zu dicht an einen Schnitt ziehen** → rastet auf den nächsten gültigen Frame oder bleibt stehen; nie zwei Marker auf einem Frame (Tests in Task 4 und Task 8).

---

## Datei-Übersicht

| Datei | Art | Verantwortung |
|---|---|---|
| `src/engine/types.ts` | ändern | `Mode`, `DrawSource`, neue Settings-Felder |
| `src/state/settings.ts` | ändern | Standards, Range `dauer`, Parsing |
| `src/engine/draw.ts`, `src/engine/raster.ts`, `src/engine/motions/types.ts` | ändern | `DrawSource` statt `ImageBitmap`, `sourceSize()` |
| `src/engine/strokes.ts` | neu | aus `render.ts`: `BarLook`, `barOrder`, `paintBase`, `movedStrokes` + Grid-Helfer |
| `src/engine/render.ts` | ändern | nutzt `strokes.ts`, Verhalten gleich |
| `src/engine/videoTimeline.ts` | neu | Shots, Layout, DAUER-Grenze, Marker-Validierung, Achse, `videoPositionAt` |
| `src/engine/renderVideo.ts` | neu | `VideoProjectScene`, `renderVideoFrame`, `videoPosition`, `lookFrames` |
| `src/engine/analysisCache.ts` | ändern | `needsPixels`, `look`, `prune` |
| `src/export/audioMix.ts` | neu | reine Ton-Mix-Funktionen |
| `src/export/projectEncoder.ts` | neu | Video-Projekt-Export im Worker |
| `src/export/protocol.ts`, `src/export/video.ts`, `src/export/video.worker.ts` | ändern | neuer Nachrichtentyp, `exportVideoProject`, Hinweis „ohne Ton“ |
| `src/state/store.ts` | ändern | `videoClips`, `markers`, `playhead`, `selectedMarker`, Helfer |
| `src/util/time.ts` | neu | `formatClock` |
| `src/video/accept.ts` | neu | `isAcceptedVideo`, `VIDEO_ACCEPT` |
| `src/video/markers.ts` | neu | Marker hinzufügen/verschieben/löschen (rein) |
| `src/video/media.ts` | neu | Mediabunny-Zugriff im Hauptthread: prüfen, Frames, Filmstreifen |
| `src/video/clipImport.ts` | neu | Clips hinzufügen/entfernen/umsortieren |
| `src/video/scene.ts` | neu | `buildVideoScene`, Signal `videoScene` |
| `src/video/player.ts` | neu | Vorschau-Controller mit `<video>`-Elementen |
| `src/ui/modeSwitch.ts`, `src/ui/timeline.ts` | neu | Schalter, Zeitleiste |
| `src/ui/controls.ts`, `src/ui/tools.ts`, `src/ui/toolbar.ts`, `src/ui/sidebar.ts`, `src/ui/clips.ts`, `src/ui/preview.ts`, `src/ui/transport.ts`, `src/ui/exportDialog.ts`, `src/main.ts`, `index.html`, `src/styles/components.css` | ändern | modusabhängige Oberfläche |
| `src/dev/testVideos.ts`, `.gitignore` | neu/ändern | Dev-Helfer für Browser-Tests mit ffmpeg-Fixtures |

---

### Task 1: Settings – Modus und Video-Felder

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/state/settings.ts`
- Modify: `tests/engine/helpers.ts` (`TEST_SETTINGS`)
- Test: `tests/state/settings.test.ts`

**Interfaces:**
- Produces: `MODES`, `type Mode = 'photo' | 'video'`, `type DrawSource`, `Settings.mode/dauer/intro/outro/audio`, `RangeKey` inkl. `'dauer'`, `RANGES.dauer`.

- [ ] **Step 1: Write the failing test** – an `tests/state/settings.test.ts` anhängen:

```ts
describe('video settings', () => {
  it('defaults to photo mode with 0.6 s, intro, outro and sound on', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ mode: 'photo', dauer: 0.6, intro: true, outro: true, audio: true });
  });
  it('keeps valid video values and snaps DURATION to 0.1 s without float noise', () => {
    const parsed = parseSettings({ mode: 'video', dauer: 0.63, intro: false, outro: true, audio: false });
    expect(parsed).toMatchObject({ mode: 'video', dauer: 0.6, intro: false, outro: true, audio: false });
    expect(parseSettings({ dauer: 0.7 }).dauer).toBe(0.7);
  });
  it('replaces unknown modes and out-of-range durations', () => {
    expect(parseSettings({ mode: 'audio', dauer: 3 })).toMatchObject({ mode: 'photo', dauer: 0.6 });
  });
  it('fills the new fields when stored settings predate them', () => {
    expect(parseSettings({ size: 40 })).toMatchObject({ size: 40, mode: 'photo', intro: true, outro: true, audio: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/state/settings.test.ts`
Expected: FAIL (`mode` undefined in `DEFAULT_SETTINGS`).

- [ ] **Step 3: Extend the types** – in `src/engine/types.ts` nach `MoveId` einfügen:

```ts
export const MODES = ['photo', 'video'] as const;
export type Mode = (typeof MODES)[number];

/** Anything the renderer can draw: a photo, a playing <video>, a decoded video frame or a canvas. */
export type DrawSource = ImageBitmap | HTMLVideoElement | VideoFrame | HTMLCanvasElement | OffscreenCanvas;
```

und `Settings` um diese Felder ergänzen (nach `move`):

```ts
  mode: Mode;
  /** Video: length of one stroke phase (building up or falling away), in seconds. */
  dauer: number;
  /** Video: the first shot starts covered and the strokes fall away. */
  intro: boolean;
  /** Video: the strokes build up and cover the last frame. */
  outro: boolean;
  /** Video: keep the clips' sound. */
  audio: boolean;
```

- [ ] **Step 4: Extend settings** – `src/state/settings.ts`:

Import ändern zu `import { FORMAT_IDS, MODES, MOTION_IDS, MOVE_IDS, type Settings } from '../engine/types';`

`DEFAULT_SETTINGS` um `mode: 'photo', dauer: 0.6, intro: true, outro: true, audio: true,` ergänzen.

```ts
export type RangeKey = 'size' | 'stretch' | 'threshold' | 'sensitivity' | 'speed' | 'loops' | 'dauer';
```

`RANGES` um `dauer: { min: 0.2, max: 1.5, step: 0.1 },` ergänzen.

In `parseSettings` den Schritt ohne Float-Rauschen runden und die neuen Felder lesen:

```ts
  const ranged = (key: RangeKey): number => {
    const v = r[key];
    const { min, max, step } = RANGES[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) return d[key];
    // toFixed: 7 × 0.1 is 0.7000000000000001
    return Number((Math.round(v / step) * step).toFixed(4));
  };
  const bool = (key: 'removeFront' | 'imgMask' | 'intro' | 'outro' | 'audio'): boolean =>
    (typeof r[key] === 'boolean' ? (r[key] as boolean) : d[key]);
```

und im Rückgabeobjekt nach `move` ergänzen:

```ts
    mode: oneOf(r.mode, MODES, d.mode),
    dauer: ranged('dauer'),
    intro: bool('intro'),
    outro: bool('outro'),
    audio: bool('audio'),
```

- [ ] **Step 5: Update the shared test settings** – in `tests/engine/helpers.ts` `TEST_SETTINGS` ergänzen (D = 0,5 s macht die Testrechnungen glatt: ein Übergang = 1 s):

```ts
export const TEST_SETTINGS: Settings = {
  size: 80, stretch: 0, threshold: 35, removeFront: false, sensitivity: 50, color: '#FFFFFF',
  imgMask: false, motion: 'buildUp', speed: 1, loops: 1, format: '9:16', move: 'off',
  mode: 'photo', dauer: 0.5, intro: false, outro: false, audio: true,
};
```

- [ ] **Step 6: Run all tests and the type check**

Run: `npm test && npx tsc --noEmit`
Expected: alle Tests PASS (215 + 4), keine Typfehler.

- [ ] **Step 7: Commit**

```bash
git add src/engine/types.ts src/state/settings.ts tests/engine/helpers.ts tests/state/settings.test.ts
git commit -m "feat(settings): mode and video settings (duration, intro, outro, sound)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Zeichnen aus beliebigen Bildquellen (`DrawSource`)

**Files:**
- Modify: `src/engine/draw.ts`
- Modify: `src/engine/raster.ts`
- Modify: `src/engine/motions/types.ts`
- Test: `tests/engine/draw.test.ts`

**Interfaces:**
- Consumes: `DrawSource`, `Size` aus `src/engine/types.ts` (Task 1).
- Produces: `sourceSize(src: DrawSource): Size`; `drawFitted`, `clipDraw`, `drawInBar`, `rasterize` nehmen `DrawSource`; `FrameInput.image` / `nextImage: DrawSource`.

- [ ] **Step 1: Write the failing test** – an `tests/engine/draw.test.ts` anhängen (Import `sourceSize` ergänzen, `import type { DrawSource } from '../../src/engine/types';`):

```ts
describe('sourceSize', () => {
  it('reads a video element by its intrinsic size and a video frame by its display size', () => {
    expect(sourceSize({ videoWidth: 1920, videoHeight: 1080, width: 0, height: 0 } as unknown as DrawSource)).toEqual({ width: 1920, height: 1080 });
    expect(sourceSize({ displayWidth: 1080, displayHeight: 1920, codedWidth: 1920 } as unknown as DrawSource)).toEqual({ width: 1080, height: 1920 });
    expect(sourceSize(fakeImage('a', 200, 100))).toEqual({ width: 200, height: 100 });
  });
  it('drawFitted crops a video by its intrinsic size, not its element size', () => {
    const video = { id: 'v', videoWidth: 200, videoHeight: 100, width: 0, height: 0 } as unknown as DrawSource;
    expect(record((ctx) => drawFitted(ctx, video, 100, 100, 'cover'))).toEqual([
      'drawImage v 50.00 0.00 100.00 100.00 0.00 0.00 100.00 100.00 1.000',
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/draw.test.ts`
Expected: FAIL (`sourceSize` is not exported).

- [ ] **Step 3: Implement** – `src/engine/draw.ts`: Import auf `import type { Bar, Ctx2D, DrawSource, Fit, Size } from './types';` ändern, `sourceSize` einfügen und `drawFitted` darauf umstellen:

```ts
/** Pixel size of a source; a <video> element's own width/height are its layout box, not the video. */
export function sourceSize(src: DrawSource): Size {
  if ('videoWidth' in src) return { width: src.videoWidth, height: src.videoHeight };
  if ('displayWidth' in src) return { width: src.displayWidth, height: src.displayHeight };
  return { width: src.width, height: src.height };
}

export function drawFitted(ctx: Ctx2D, img: DrawSource, width: number, height: number, fit: Fit): void {
  const { width: iw, height: ih } = sourceSize(img);
  if (fit === 'contain') {
    const scale = Math.min(width / iw, height / ih);
    const w = iw * scale;
    const h = ih * scale;
    ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
    return;
  }
  const imgAspect = iw / ih;
  const targetAspect = width / height;
  let sw = iw, sh = ih, sx = 0, sy = 0;
  if (imgAspect > targetAspect) {
    sw = ih * targetAspect;
    sx = (iw - sw) / 2;
  } else {
    sh = iw / targetAspect;
    sy = (ih - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
}
```

In `clipDraw` und `drawInBar` den Parametertyp `img: ImageBitmap` durch `img: DrawSource` ersetzen.

`src/engine/raster.ts`: `import type { DrawSource, Fit, Size } from './types';` und Signatur `export function rasterize(img: DrawSource, size: Size, fit: Fit): PixelData`.

`src/engine/motions/types.ts`: Import `import type { Bar, Ctx2D, DrawSource, Fit, MotionId } from '../types';`, Felder `image: DrawSource;` und `nextImage: DrawSource;`.

- [ ] **Step 4: Run all tests and the type check**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, keine Typfehler.

- [ ] **Step 5: Commit**

```bash
git add src/engine/draw.ts src/engine/raster.ts src/engine/motions/types.ts tests/engine/draw.test.ts
git commit -m "refactor(engine): draw from any image source, video elements by their intrinsic size

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Geteilte Stroke-Bausteine in `strokes.ts`

**Files:**
- Create: `src/engine/strokes.ts`
- Modify: `src/engine/render.ts`
- Test: `tests/engine/strokes.test.ts`

**Interfaces:**
- Consumes: `DrawSource`, `MoveId`, `Size` (Task 1), `drawFitted` (Task 2).
- Produces:
  - `interface BarLook { strokeBars: Bar[]; gridBars: Bar[] }`
  - `barOrder(look: BarLook, whole: boolean, seed: number, salt: number): { key: string; bars: Bar[]; lead: number }`
  - `paintBase(ctx: Ctx2D, width: number, height: number, fit: Fit, image: DrawSource): void`
  - `movedStrokes(ctx: Ctx2D, frame: Size, move: MoveId, motion: Motion, progress: number, imgMask: boolean, grid: Bar[]): Ctx2D`
  - `render.ts`: `interface ImageLayer extends BarLook { bitmap: ImageBitmap }` (sonst unverändert)

- [ ] **Step 1: Write the failing test** – `tests/engine/strokes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { barOrder } from '../../src/engine/strokes';
import { barKey, testBars } from './helpers';

const look = { strokeBars: testBars().filter((_, i) => i % 2 === 0), gridBars: testBars() };

describe('barOrder', () => {
  it('puts the look first and, with whole, the rest of the grid after it', () => {
    const o = barOrder(look, true, 1, 0);
    expect(o.lead).toBe(50);
    expect(o.bars).toHaveLength(100);
    const lookKeys = new Set(look.strokeBars.map(barKey));
    expect(o.bars.slice(0, 50).every((b) => lookKeys.has(barKey(b)))).toBe(true);
    expect(barOrder(look, false, 1, 0).bars).toHaveLength(50);
  });
  it('is stable per seed and salt and differs between salts', () => {
    const a = barOrder(look, true, 1, 0).bars.map(barKey);
    expect(barOrder(look, true, 1, 0).bars.map(barKey)).toEqual(a);
    expect(barOrder(look, true, 1, 1).bars.map(barKey)).not.toEqual(a);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/strokes.test.ts`
Expected: FAIL (module `src/engine/strokes` not found).

- [ ] **Step 3: Create `src/engine/strokes.ts`** – Inhalt aus `render.ts` herausgelöst, mit verallgemeinerten Signaturen:

```ts
import { drawFitted } from './draw';
import type { Motion } from './motions';
import { paceLevel } from './motions/pace';
import { CASCADE_STAGGER, COMB_SHIFT, DEPTH_MIN, SLIDE_SHIFT, ZIPPER_SHIFT, ease } from './move';
import { hashSeed, mulberry32, shuffled } from './rng';
import type { Bar, Ctx2D, DrawSource, Fit, MoveId, Size } from './types';

/** The bars of one analysed picture: its look and every cell of the grid. */
export interface BarLook {
  /** Bars that carry a stroke (after REMOVE and THRESHOLD). */
  strokeBars: Bar[];
  /** Every cell of the grid – with several clips the strokes cover all of them. */
  gridBars: Bar[];
}

const ORDER_SALT = 0xba5;
const REST_SALT = 0x7e5;

export interface BarOrder {
  key: string;
  bars: Bar[];
  lead: number;
}
const orderCache = new WeakMap<BarLook, BarOrder>();

/**
 * Bar order for one look, identical every time it is asked for so loops repeat exactly: the look
 * (the stroke bars) first and, with `whole`, the rest of the grid after it. `salt` tells apart
 * several uses of the same seed (the clip index in photo mode, the stroke phase in video mode).
 */
export function barOrder(look: BarLook, whole: boolean, seed: number, salt: number): BarOrder {
  const key = `${seed}:${salt}:${whole}`;
  const hit = orderCache.get(look);
  if (hit?.key === key) return hit;
  const first = shuffled(look.strokeBars, mulberry32(hashSeed(seed, salt, ORDER_SALT)));
  let bars = first;
  if (whole) {
    const inLook = new Set(look.strokeBars.map((b) => `${b.x},${b.y}`));
    const rest = look.gridBars.filter((b) => !inLook.has(`${b.x},${b.y}`));
    bars = [...first, ...shuffled(rest, mulberry32(hashSeed(seed, salt, REST_SALT)))];
  }
  const order = { key, bars, lead: first.length };
  orderCache.set(look, order);
  return order;
}

export function paintBase(ctx: Ctx2D, width: number, height: number, fit: Fit, image: DrawSource): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  drawFitted(ctx, image, width, height, fit);
}
```

Danach **unverändert aus `render.ts` verschieben** (inkl. Doc-Kommentare): `movedStrokes`, `shiftCells`, `type Rect`, `interface GridEdges`, `edgesCache`, `gridEdges`, `edge`, `placeRects`. In `movedStrokes` nur Signatur und die zwei Zeilen am Anfang ändern:

```ts
export function movedStrokes(ctx: Ctx2D, frame: Size, move: MoveId, motion: Motion, progress: number, imgMask: boolean, grid: Bar[]): Ctx2D {
  const { width: w, height: h } = frame;
```

(die Zeile `const move = scene.settings.move;` entfällt, `move` ist jetzt Parameter).

- [ ] **Step 4: Slim `src/engine/render.ts` down** – Kopf und die geänderten Stellen:

```ts
import { clipDraw, fillBars } from './draw';
import { motionById } from './motions';
import { barOrder, movedStrokes, paintBase, type BarLook } from './strokes';
import { positionAt, totalDuration } from './timeline';
import type { Ctx2D, Fit, Settings } from './types';

export interface ImageLayer extends BarLook {
  bitmap: ImageBitmap;
}
```

`Scene`, `imgMaskOn`, `imgMaskActive`, `sceneDuration` bleiben. Lokale `barOrder`, `paintBase`, `movedStrokes` und Grid-Helfer sowie die nicht mehr benutzten Imports (`drawFitted`, `paceLevel`, `move`-Konstanten, `rng`, `Bar`, `Motion`) löschen. In `renderFrame`:

```ts
  const order = barOrder(clip, chain, scene.seed, index);

  paintBase(ctx, scene.width, scene.height, scene.fit, clip.bitmap);
  const strokes = s.move === 'off' ? ctx : movedStrokes(ctx, scene, s.move, motion, pos.progress, imgMask, clip.gridBars);
```

In `renderStill`: `paintBase(ctx, scene.width, scene.height, scene.fit, clip.bitmap);`

- [ ] **Step 5: Run all tests and the type check**

Run: `npm test && npx tsc --noEmit`
Expected: PASS (render-, move- und motions-Tests unverändert grün), keine Typfehler.

- [ ] **Step 6: Commit**

```bash
git add src/engine/strokes.ts src/engine/render.ts tests/engine/strokes.test.ts
git commit -m "refactor(engine): share bar order, base paint and MOVE between photo and video

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Zeitmodell I – Shots, Layout, DAUER-Grenze, Marker-Validierung, Achse

**Files:**
- Create: `src/engine/videoTimeline.ts`
- Test: `tests/engine/videoTimeline.test.ts`

**Interfaces:**
- Consumes: `FPS` aus `src/engine/timeline.ts`.
- Produces (alle exportiert):
  - `interface TimelineClip { id: string; duration: number }`
  - `interface Marker { id: string; clipId: string; time: number }`
  - `interface VideoTimelineInput { clips; markers; dauer; imgMask; intro; outro }`
  - `interface ShotSpan { index; clipId; sourceStart; sourceEnd }`, `interface Shot extends ShotSpan { start; end; lane: 0 | 1 }`
  - `interface Layout { shots: Shot[]; duration; dauer; imgMask; intro; outro }`
  - `snapToFrame(t)`, `shotSpans(input)`, `demand(i, n, flags)`, `dauerLimit(input): { max: number; axisAt: number | null }`, `layout(input): Layout`
  - `validMarkerTime(input, clipId, time): number | null`
  - `clipOffsets(clips): Map<string, number>`, `axisLength(clips)`, `clipAt(clips, x): { clipId; time } | null`, `outputTimeOf(lay, clipId, time): number`

- [ ] **Step 1: Write the failing tests** – `tests/engine/videoTimeline.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  axisLength, clipAt, dauerLimit, layout, outputTimeOf, shotSpans, validMarkerTime, type VideoTimelineInput,
} from '../../src/engine/videoTimeline';

const clip = (id: string, duration: number) => ({ id, duration });
const mk = (clipId: string, time: number, id = `${clipId}@${time}`) => ({ id, clipId, time });
export const input = (over: Partial<VideoTimelineInput> = {}): VideoTimelineInput => ({
  clips: [clip('a', 3), clip('b', 2)], markers: [], dauer: 0.5, imgMask: false, intro: false, outro: false, ...over,
});

describe('shotSpans', () => {
  it('splits clips at their markers, in play order', () => {
    const spans = shotSpans(input({ clips: [clip('a', 6), clip('b', 2)], markers: [mk('a', 4), mk('a', 2)] }));
    expect(spans.map((s) => [s.clipId, s.sourceStart, s.sourceEnd])).toEqual([
      ['a', 0, 2], ['a', 2, 4], ['a', 4, 6], ['b', 0, 2],
    ]);
  });
  it('ignores markers on the clip edges or outside it', () => {
    expect(shotSpans(input({ clips: [clip('a', 6)], markers: [mk('a', 0), mk('a', 6), mk('a', 7)] }))).toHaveLength(1);
  });
});

describe('layout', () => {
  it('puts colour shots back to back', () => {
    const lay = layout(input());
    expect(lay.shots.map((s) => [s.start, s.end])).toEqual([[0, 3], [3, 5]]);
    expect(lay.duration).toBe(5);
    expect(lay.imgMask).toBe(false);
  });
  it('overlaps shots by 2 · D with IMG MASK', () => {
    const lay = layout(input({ imgMask: true }));
    expect(lay.shots.map((s) => [s.start, s.end])).toEqual([[0, 3], [2, 4]]);
    expect(lay.duration).toBe(4);
  });
  it('ignores IMG MASK without a cut', () => {
    const lay = layout(input({ clips: [clip('a', 3)], imgMask: true }));
    expect(lay.imgMask).toBe(false);
    expect(lay.duration).toBe(3);
  });
  it('snaps cuts to the 30 fps grid', () => {
    const lay = layout(input({ clips: [clip('a', 1.01), clip('b', 1)] }));
    expect(lay.shots[1].start).toBe(1);
    expect(lay.duration).toBe(2);
  });
  it('caps D so a short clip keeps its stroke phases apart', () => {
    expect(layout(input({ clips: [clip('a', 3), clip('b', 0.6), clip('c', 3)] })).dauer).toBeCloseTo(0.3, 9);
  });
  it('flips the lane only where IMG MASK shows two stretches of one clip at once', () => {
    const over = { clips: [clip('a', 6), clip('b', 2)], markers: [mk('a', 2), mk('a', 4)] };
    expect(layout(input({ ...over, imgMask: true })).shots.map((s) => s.lane)).toEqual([0, 1, 0, 0]);
    expect(layout(input(over)).shots.map((s) => s.lane)).toEqual([0, 0, 0, 0]);
  });
});

describe('dauerLimit', () => {
  it('names where the shortest shot starts on the clip axis', () => {
    expect(dauerLimit(input({ clips: [clip('a', 3), clip('b', 0.6)] }))).toEqual({ max: 0.6, axisAt: 3 });
  });
  it('counts intro and outro', () => {
    expect(dauerLimit(input({ clips: [clip('a', 1)], intro: true, outro: true }))).toEqual({ max: 0.5, axisAt: 0 });
  });
  it('is unlimited when nothing needs room', () => {
    expect(dauerLimit(input({ clips: [clip('a', 1)] }))).toEqual({ max: Infinity, axisAt: null });
  });
});

describe('validMarkerTime', () => {
  const one = (over: Partial<VideoTimelineInput> = {}) => input({ clips: [clip('a', 6)], ...over });
  it('snaps to the frame grid', () => {
    expect(validMarkerTime(one(), 'a', 2.013)).toBe(2);
  });
  it('moves away from a cut that is too close', () => {
    // 2.5 would leave a 0.5 s shot between two cuts; it needs 2 · D = 1 s.
    expect(validMarkerTime(one({ markers: [mk('a', 2)] }), 'a', 2.5)).toBe(3);
  });
  it('never returns the time of an existing marker', () => {
    expect(validMarkerTime(one({ markers: [mk('a', 3)] }), 'a', 3)).not.toBe(3);
  });
  it('gives up on a clip with no room and on unknown clips', () => {
    expect(validMarkerTime(input({ clips: [clip('a', 0.9)] }), 'a', 0.45)).toBeNull();
    expect(validMarkerTime(one(), 'zz', 1)).toBeNull();
  });
});

describe('clip axis', () => {
  it('lays clips back to back by source length and maps both ways', () => {
    const clips = [clip('a', 3), clip('b', 2)];
    expect(axisLength(clips)).toBe(5);
    expect(clipAt(clips, 4)).toEqual({ clipId: 'b', time: 1 });
    expect(clipAt(clips, 99)).toEqual({ clipId: 'b', time: 2 });
    expect(clipAt([], 1)).toBeNull();
  });
  it('turns a clip time into output time, also across IMG MASK overlaps', () => {
    expect(outputTimeOf(layout(input()), 'b', 1)).toBe(4);
    expect(outputTimeOf(layout(input({ imgMask: true })), 'b', 1)).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/videoTimeline.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/engine/videoTimeline.ts`** (Teil I):

```ts
import { FPS } from './timeline';

export interface TimelineClip {
  id: string;
  /** Source length in seconds. */
  duration: number;
}

export interface Marker {
  id: string;
  clipId: string;
  /** Source time inside the clip, on the 30 fps grid. */
  time: number;
}

export interface VideoTimelineInput {
  clips: readonly TimelineClip[];
  markers: readonly Marker[];
  /** D: length of one stroke phase in seconds. */
  dauer: number;
  imgMask: boolean;
  intro: boolean;
  outro: boolean;
}

/** A stretch of one clip between two cuts. */
export interface ShotSpan {
  index: number;
  clipId: string;
  sourceStart: number;
  sourceEnd: number;
}

export interface Shot extends ShotSpan {
  /** Output time the shot starts at, on the 30 fps grid. */
  start: number;
  /** Output time it ends at; with IMG MASK the next shot already starts 2 · D earlier. */
  end: number;
  /**
   * Which of a clip's two preview players shows the shot. It only flips where an IMG MASK overlap
   * shows two stretches of the same clip at once, so a cut inside a clip just keeps playing.
   */
  lane: 0 | 1;
}

export interface Layout {
  shots: Shot[];
  duration: number;
  /** D in use: the setting, capped so no two stroke phases overlap. */
  dauer: number;
  /** IMG MASK in use (it needs at least one cut). */
  imgMask: boolean;
  intro: boolean;
  outro: boolean;
}

const EPS = 1e-9;

export const snapToFrame = (t: number): number => Math.round(t * FPS) / FPS;

/** The shots in play order: every clip split at its markers. */
export function shotSpans(input: Pick<VideoTimelineInput, 'clips' | 'markers'>): ShotSpan[] {
  const spans: ShotSpan[] = [];
  for (const clip of input.clips) {
    const cuts = [...new Set(input.markers
      .filter((m) => m.clipId === clip.id && m.time > 0 && m.time < clip.duration)
      .map((m) => m.time))].sort((a, b) => a - b);
    let from = 0;
    for (const to of [...cuts, clip.duration]) {
      spans.push({ index: spans.length, clipId: clip.id, sourceStart: from, sourceEnd: to });
      from = to;
    }
  }
  return spans;
}

/**
 * How many D shot `i` of `n` must hold: half a colour transition (D) or a whole IMG MASK overlap
 * (2 · D) at each cut, D for the intro and the outro.
 */
export function demand(i: number, n: number, flags: Pick<VideoTimelineInput, 'imgMask' | 'intro' | 'outro'>): number {
  const join = flags.imgMask && n >= 2 ? 2 : 1;
  const head = i === 0 ? (flags.intro ? 1 : 0) : join;
  const tail = i === n - 1 ? (flags.outro ? 1 : 0) : join;
  return head + tail;
}

/** Where each clip starts on the clip axis (clips back to back by source length). */
export function clipOffsets(clips: readonly TimelineClip[]): Map<string, number> {
  const out = new Map<string, number>();
  let x = 0;
  for (const c of clips) {
    out.set(c.id, x);
    x += c.duration;
  }
  return out;
}

export function axisLength(clips: readonly TimelineClip[]): number {
  return clips.reduce((sum, c) => sum + c.duration, 0);
}

/** The clip and clip time at axis position `x` (clamped to the axis). */
export function clipAt(clips: readonly TimelineClip[], x: number): { clipId: string; time: number } | null {
  if (clips.length === 0) return null;
  let rest = Math.max(0, x);
  for (const c of clips) {
    if (rest < c.duration) return { clipId: c.id, time: rest };
    rest -= c.duration;
  }
  const last = clips[clips.length - 1];
  return { clipId: last.id, time: last.duration };
}

export interface DauerLimit {
  /** Largest D at which no two stroke phases overlap (Infinity if nothing limits it). */
  max: number;
  /** Where the limiting shot starts on the clip axis, or null. */
  axisAt: number | null;
}

export function dauerLimit(input: VideoTimelineInput): DauerLimit {
  const spans = shotSpans(input);
  const offsets = clipOffsets(input.clips);
  let max = Infinity;
  let axisAt: number | null = null;
  spans.forEach((s, i) => {
    const k = demand(i, spans.length, input);
    if (k === 0) return;
    const m = (s.sourceEnd - s.sourceStart) / k;
    if (m < max) {
      max = m;
      axisAt = (offsets.get(s.clipId) ?? 0) + s.sourceStart;
    }
  });
  return { max, axisAt };
}

export function layout(input: VideoTimelineInput): Layout {
  const spans = shotSpans(input);
  const n = spans.length;
  const imgMask = input.imgMask && n >= 2;
  const dauer = Math.min(input.dauer, dauerLimit(input).max);
  const overlap = imgMask ? 2 * dauer : 0;
  const shots: Shot[] = [];
  let cursor = 0;
  spans.forEach((s, i) => {
    const length = s.sourceEnd - s.sourceStart;
    const prev = shots[i - 1];
    const sameClip = prev?.clipId === s.clipId;
    const lane: 0 | 1 = !prev || !sameClip ? 0 : imgMask ? (prev.lane === 0 ? 1 : 0) : prev.lane;
    shots.push({ ...s, start: snapToFrame(cursor), end: snapToFrame(cursor + length), lane });
    cursor += length - (i < n - 1 ? overlap : 0);
  });
  return { shots, duration: n ? shots[n - 1].end : 0, dauer, imgMask, intro: input.intro, outro: input.outro };
}

/** Output time showing clip time `time` of `clipId` (the first shot of the clip that holds it). */
export function outputTimeOf(lay: Layout, clipId: string, time: number): number {
  const shots = lay.shots.filter((s) => s.clipId === clipId);
  const shot = shots.find((s) => time < s.sourceEnd) ?? shots[shots.length - 1];
  if (!shot) return 0;
  const t = shot.start + (Math.max(shot.sourceStart, time) - shot.sourceStart);
  return Math.min(Math.max(0, t), Math.max(0, lay.duration - 1 / FPS));
}

/** Whether a marker at `t` in `clipId` leaves both shots beside it long enough. */
function markerFits(input: VideoTimelineInput, clipId: string, t: number): boolean {
  const spans = shotSpans({ clips: input.clips, markers: [...input.markers, { id: '', clipId, time: t }] });
  return spans.every((s, i) =>
    s.clipId !== clipId
    || (Math.abs(s.sourceStart - t) > 1e-6 && Math.abs(s.sourceEnd - t) > 1e-6)
    || s.sourceEnd - s.sourceStart >= demand(i, spans.length, input) * input.dauer - EPS);
}

/** Nearest frame-grid time in `clipId` where a new marker fits, or null if the clip has no room. */
export function validMarkerTime(input: VideoTimelineInput, clipId: string, time: number): number | null {
  const clip = input.clips.find((c) => c.id === clipId);
  if (!clip) return null;
  const last = Math.ceil(clip.duration * FPS) - 1;
  const at = Math.round(time * FPS);
  for (let d = 0; d <= last; d++) {
    for (const f of d === 0 ? [at] : [at - d, at + d]) {
      if (f < 1 || f > last) continue;
      const t = f / FPS;
      if (input.markers.some((m) => m.clipId === clipId && Math.abs(m.time - t) < 1e-6)) continue;
      if (markerFits(input, clipId, t)) return t;
    }
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/videoTimeline.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/videoTimeline.ts tests/engine/videoTimeline.test.ts
git commit -m "feat(video): timeline model – shots, layout, duration limit and marker snapping

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Zeitmodell II – `videoPositionAt`

**Files:**
- Modify: `src/engine/videoTimeline.ts`
- Test: `tests/engine/videoTimeline.test.ts`

**Interfaces:**
- Consumes: `Layout`, `Shot` (Task 4).
- Produces:
  - `type Phase = 'none' | 'intro' | 'transition' | 'outro'`
  - `interface ShotRef { shotIndex: number; clipId: string; sourceTime: number; lane: 0 | 1 }`
  - `interface VideoFramePosition { shot: ShotRef; next: ShotRef | null; phase: Phase; transitionIndex: number; side: 'before' | 'after'; progress: number; cycle: number; frameIndex: number }`
  - `videoPositionAt(t: number, lay: Layout, covered: 'middle' | 'ends'): VideoFramePosition` (wirft bei 0 Shots)

- [ ] **Step 1: Write the failing tests** – an `tests/engine/videoTimeline.test.ts` anhängen (Import um `videoPositionAt` ergänzen):

```ts
describe('videoPositionAt – colour strokes', () => {
  const at = (t: number, over: Partial<VideoTimelineInput> = {}, covered: 'middle' | 'ends' = 'middle') =>
    videoPositionAt(t, layout(input(over)), covered);

  it('plays the pure video away from cuts', () => {
    expect(at(1)).toMatchObject({ phase: 'none', next: null, shot: { clipId: 'a', sourceTime: 1 } });
    expect(at(2.4).phase).toBe('none');
  });
  it('builds up before the cut, covers on it and falls away after it', () => {
    expect(at(2.75)).toMatchObject({ phase: 'transition', transitionIndex: 0, side: 'before', progress: 0.25, shot: { clipId: 'a' } });
    expect(at(3)).toMatchObject({ side: 'after', progress: 0.5, shot: { clipId: 'b', sourceTime: 0 } });
    expect(at(3.25)).toMatchObject({ side: 'after', progress: 0.75, shot: { clipId: 'b' } });
  });
  it('puts full cover exactly on the cut frame and the last frame of shot a right before it', () => {
    expect(at(90 / 30).progress).toBe(0.5);
    const before = at(89 / 30);
    expect(before.shot.clipId).toBe('a');
    expect(before.shot.sourceTime).toBeLessThan(3);
  });
  it('never shows the next shot inside a clip before the marker', () => {
    const p = at(2 - 1e-4, { clips: [clip('a', 6)], markers: [mk('a', 2)] });
    expect(p.shot.shotIndex).toBe(0);
    expect(p.shot.sourceTime).toBeLessThanOrEqual(2 - 1e-3);
  });
  it('maps a motion that starts covered so the cut sits at 0 / 1', () => {
    expect(at(2.75, {}, 'ends').progress).toBe(0.75);
    expect(at(3, {}, 'ends').progress).toBe(0);
    expect(at(3.25, {}, 'ends').progress).toBe(0.25);
  });
  it('keeps progress inside [0, 1] for every frame of a capped layout', () => {
    const lay = layout(input({ clips: [clip('a', 3), clip('b', 0.6), clip('c', 3)], intro: true, outro: true }));
    for (let f = 0; f < Math.round(lay.duration * 30); f++) {
      const p = videoPositionAt(f / 30, lay, 'middle');
      expect(p.progress).toBeGreaterThanOrEqual(0);
      expect(p.progress).toBeLessThanOrEqual(1);
    }
  });
});

describe('videoPositionAt – IMG MASK', () => {
  it('shows the next shot in the bars over the 2 · D overlap', () => {
    const lay = layout(input({ imgMask: true }));
    expect(videoPositionAt(2.5, lay, 'middle')).toMatchObject({
      phase: 'transition', transitionIndex: 0, side: 'before', progress: 0.5,
      shot: { clipId: 'a', sourceTime: 2.5 }, next: { clipId: 'b', sourceTime: 0.5 },
    });
    expect(videoPositionAt(3, lay, 'middle')).toMatchObject({ phase: 'none', next: null, shot: { clipId: 'b', sourceTime: 1 } });
  });
});

describe('videoPositionAt – intro and outro', () => {
  const lay = layout(input({ clips: [clip('a', 4)], intro: true, outro: true }));
  const last = 4 - 1 / 30;
  it('starts covered and falls away over D', () => {
    expect(videoPositionAt(0, lay, 'middle')).toMatchObject({ phase: 'intro', side: 'after', progress: 0.5, cycle: 0 });
    expect(videoPositionAt(0.25, lay, 'middle').progress).toBe(0.75);
    expect(videoPositionAt(0, lay, 'ends').progress).toBe(0);
  });
  it('builds up over D and covers the last frame', () => {
    expect(videoPositionAt(last, lay, 'middle')).toMatchObject({ phase: 'outro', side: 'before', progress: 0.5, cycle: 1 });
    expect(videoPositionAt(last - 0.25, lay, 'middle').progress).toBeCloseTo(0.25, 9);
    expect(videoPositionAt(2, lay, 'middle').phase).toBe('none');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/videoTimeline.test.ts`
Expected: FAIL (`videoPositionAt` is not exported).

- [ ] **Step 3: Implement** – an `src/engine/videoTimeline.ts` anhängen:

```ts
export type Phase = 'none' | 'intro' | 'transition' | 'outro';

export interface ShotRef {
  shotIndex: number;
  clipId: string;
  sourceTime: number;
  lane: 0 | 1;
}

export interface VideoFramePosition {
  /** Fills the frame. */
  shot: ShotRef;
  /** Shown inside the bars during an IMG MASK overlap. */
  next: ShotRef | null;
  phase: Phase;
  /** Transition i sits between shot i and shot i + 1; −1 outside transitions. */
  transitionIndex: number;
  /** Which look the bars follow: the one before the cut or the one after it. */
  side: 'before' | 'after';
  /** 0..1 in the motions' cycle. */
  progress: number;
  /** Seeds the stroke pattern: 0 = intro, i + 1 = transition i, shots.length = outro. */
  cycle: number;
  frameIndex: number;
}

/** Just before a cut the shot shows its own last frame, never the next shot's first. */
const BEFORE_CUT = 1e-3;

function ref(shot: Shot, t: number): ShotRef {
  const time = shot.sourceStart + Math.max(0, t - shot.start);
  return {
    shotIndex: shot.index,
    clipId: shot.clipId,
    lane: shot.lane,
    sourceTime: Math.max(shot.sourceStart, Math.min(time, shot.sourceEnd - BEFORE_CUT)),
  };
}

/** Cycle progress for a stroke phase at u ∈ [−½, ½] around full cover (u = 0). */
function cycleProgress(u: number, covered: 'middle' | 'ends'): number {
  if (covered === 'middle') return 0.5 + u;
  return u < 0 ? 1 + u : u;
}

/**
 * What output time t shows: the shot (and with IMG MASK the next one), and – inside a transition,
 * the intro or the outro – the progress the motions expect, with full cover on the cut.
 */
export function videoPositionAt(t: number, lay: Layout, covered: 'middle' | 'ends'): VideoFramePosition {
  const { shots, duration, dauer } = lay;
  if (shots.length === 0) throw new Error('videoPositionAt needs at least one shot');
  const w = 2 * dauer;
  const tt = Math.min(Math.max(0, t), Math.max(0, duration - 1e-6));
  const frameIndex = Math.floor(tt * FPS + 1e-6);
  let i = 0;
  while (i + 1 < shots.length && shots[i + 1].start <= tt + EPS) i++;

  if (lay.imgMask && i > 0 && tt < shots[i].start + w) {
    return {
      shot: ref(shots[i - 1], tt), next: ref(shots[i], tt), phase: 'transition', transitionIndex: i - 1,
      side: 'before', progress: (tt - shots[i].start) / w, cycle: i, frameIndex,
    };
  }
  const shot = ref(shots[i], tt);
  const at = (phase: Phase, u: number, side: 'before' | 'after', transitionIndex: number, cycle: number): VideoFramePosition =>
    ({ shot, next: null, phase, transitionIndex, side, progress: cycleProgress(u, covered), cycle, frameIndex });

  if (!lay.imgMask) {
    if (i > 0 && tt < shots[i].start + dauer) return at('transition', (tt - shots[i].start) / w, 'after', i - 1, i);
    if (i + 1 < shots.length && tt >= shots[i + 1].start - dauer) {
      return at('transition', (tt - shots[i + 1].start) / w, 'before', i, i + 1);
    }
  }
  if (lay.intro && tt < dauer) return at('intro', tt / w, 'after', -1, 0);
  const last = duration - 1 / FPS;
  if (lay.outro && tt >= last - dauer) return at('outro', Math.min(0, (tt - last) / w), 'before', -1, shots.length);
  return { shot, next: null, phase: 'none', transitionIndex: -1, side: 'before', progress: 0, cycle: 0, frameIndex };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/videoTimeline.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/videoTimeline.ts tests/engine/videoTimeline.test.ts
git commit -m "feat(video): map output time to shot, source time and stroke progress

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `renderVideoFrame` und Analyse-Frames pro Phase

**Files:**
- Create: `src/engine/renderVideo.ts`
- Test: `tests/engine/renderVideo.test.ts`

**Interfaces:**
- Consumes: `BarLook`, `barOrder`, `paintBase`, `movedStrokes` (Task 3); `Layout`, `VideoFramePosition`, `videoPositionAt` (Task 4/5); `DrawSource` (Task 1).
- Produces:
  - `interface VideoLooks { intro: BarLook | null; outro: BarLook | null; transitions: { before: BarLook; after: BarLook }[] }`
  - `interface VideoProjectScene { width; height; fit: Fit; settings: Settings; seed: number; layout: Layout; looks: VideoLooks }`
  - `interface VideoFrames { shot: DrawSource; next: DrawSource | null }`
  - `videoPosition(scene, t): VideoFramePosition`
  - `renderVideoFrame(ctx, scene, pos, frames): void`
  - `interface FrameRef { clipId: string; time: number }`, `lookFrames(lay): { intro: FrameRef | null; outro: FrameRef | null; transitions: { before: FrameRef; after: FrameRef }[] }`

- [ ] **Step 1: Write the failing tests** – `tests/engine/renderVideo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { lookFrames, renderVideoFrame, videoPosition, type VideoFrames, type VideoProjectScene } from '../../src/engine/renderVideo';
import type { Settings } from '../../src/engine/types';
import { layout, type VideoTimelineInput } from '../../src/engine/videoTimeline';
import { TEST_SETTINGS, count, fakeImage, record, testBars } from './helpers';

const even = { strokeBars: testBars().filter((_, i) => i % 2 === 0), gridBars: testBars() };
const odd = { strokeBars: testBars().filter((_, i) => i % 2 === 1), gridBars: testBars() };
const keys = (bars: { x: number; y: number }[]) => bars.map((b) => `${b.x},${b.y}`).sort();
const rects = (calls: string[]) => calls.filter((c) => c.startsWith('rect ')).map((c) => c.split(' ').slice(1, 3).join(',')).sort();

function scene(over: Partial<VideoTimelineInput> = {}, s: Partial<Settings> = {}): VideoProjectScene {
  const input: VideoTimelineInput = {
    clips: [{ id: 'a', duration: 3 }, { id: 'b', duration: 2 }], markers: [], dauer: 0.5,
    imgMask: false, intro: false, outro: false, ...over,
  };
  return {
    width: 100, height: 300, fit: 'cover', seed: 7, settings: { ...TEST_SETTINGS, ...s },
    layout: layout(input), looks: { intro: even, outro: odd, transitions: [{ before: even, after: odd }] },
  };
}
const plain: VideoFrames = { shot: fakeImage('a'), next: null };
const draw = (sc: VideoProjectScene, t: number, frames = plain) => record((ctx) => renderVideoFrame(ctx, sc, videoPosition(sc, t), frames));

describe('renderVideoFrame', () => {
  it('draws only the video away from a cut', () => {
    const calls = draw(scene(), 1);
    expect(calls).toHaveLength(3);
    expect(calls[2]).toMatch(/^drawImage a /);
  });
  it('covers the whole frame on the cut', () => {
    expect(count(draw(scene(), 3), 'rect ')).toBe(100);
  });
  it('builds up from the look before the cut and falls away into the look after it', () => {
    expect(rects(draw(scene(), 2.75))).toEqual(keys(even.strokeBars));
    expect(rects(draw(scene(), 3.25))).toEqual(keys(odd.strokeBars));
  });
  it('IMG MASK draws the next shot inside the bars', () => {
    const calls = draw(scene({ imgMask: true }), 2.5, { shot: fakeImage('a'), next: fakeImage('b') });
    expect(count(calls, 'drawImage b')).toBe(1);
    expect(count(calls, 'clip')).toBe(1);
  });
  it('starts covered with an intro and ends covered with an outro', () => {
    const sc = scene({ intro: true, outro: true });
    expect(count(draw(sc, 0), 'rect ')).toBe(100);
    expect(count(draw(sc, sc.layout.duration - 1 / 30), 'rect ')).toBe(100);
  });
  it('is deterministic per seed', () => {
    expect(draw(scene(), 2.8)).toEqual(draw(scene(), 2.8));
  });
});

describe('lookFrames', () => {
  it('reads each look right at its cut: the last frame before it and the first after it', () => {
    const f = lookFrames(layout({ clips: [{ id: 'a', duration: 3 }, { id: 'b', duration: 2 }], markers: [], dauer: 0.5, imgMask: false, intro: true, outro: false }));
    expect(f.intro).toEqual({ clipId: 'a', time: 0 });
    expect(f.outro).toBeNull();
    expect(f.transitions).toHaveLength(1);
    expect(f.transitions[0].before.clipId).toBe('a');
    expect(f.transitions[0].before.time).toBeCloseTo(2.999, 9);
    expect(f.transitions[0].after).toEqual({ clipId: 'b', time: 0 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/renderVideo.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/engine/renderVideo.ts`**

```ts
import { motionById } from './motions';
import { hashSeed } from './rng';
import { barOrder, movedStrokes, paintBase, type BarLook } from './strokes';
import type { Ctx2D, DrawSource, Fit, Settings } from './types';
import { videoPositionAt, type Layout, type VideoFramePosition } from './videoTimeline';

export interface VideoLooks {
  intro: BarLook | null;
  outro: BarLook | null;
  /** Per transition i (shot i → i + 1): the look of the last frame before and the first frame after the cut. */
  transitions: { before: BarLook; after: BarLook }[];
}

export interface VideoProjectScene {
  width: number;
  height: number;
  fit: Fit;
  settings: Settings;
  seed: number;
  layout: Layout;
  looks: VideoLooks;
}

/** The pictures for one output frame: the shot, and during an IMG MASK overlap the next one. */
export interface VideoFrames {
  shot: DrawSource;
  next: DrawSource | null;
}

const PHASE_SALT = 0x51d;

export function videoPosition(scene: VideoProjectScene, t: number): VideoFramePosition {
  return videoPositionAt(t, scene.layout, motionById(scene.settings.motion).covered);
}

function lookFor(scene: VideoProjectScene, pos: VideoFramePosition): BarLook | null {
  switch (pos.phase) {
    case 'intro': return scene.looks.intro;
    case 'outro': return scene.looks.outro;
    case 'transition': return scene.looks.transitions[pos.transitionIndex]?.[pos.side] ?? null;
    default: return null;
  }
}

/**
 * Draws output frame `pos`: the shot, and in a stroke phase the motion on top. The strokes always
 * cover the whole grid (the look first), so the cut, the first and the last frame are fully hidden.
 */
export function renderVideoFrame(ctx: Ctx2D, scene: VideoProjectScene, pos: VideoFramePosition, frames: VideoFrames): void {
  const { width, height, fit, settings: s } = scene;
  paintBase(ctx, width, height, fit, frames.shot);
  const look = lookFor(scene, pos);
  if (!look) return;
  const motion = motionById(s.motion);
  const imgMask = pos.next !== null && frames.next !== null;
  const order = barOrder(look, true, scene.seed, hashSeed(pos.cycle, PHASE_SALT));
  const strokes = s.move === 'off' ? ctx : movedStrokes(ctx, scene, s.move, motion, pos.progress, imgMask, look.gridBars);
  motion.draw(strokes, {
    width,
    height,
    fit,
    bars: order.bars,
    lead: order.lead,
    progress: pos.progress,
    cycle: pos.cycle,
    frameIndex: pos.frameIndex,
    seed: scene.seed,
    color: s.color,
    image: frames.shot,
    nextImage: frames.next ?? frames.shot,
    imgMask,
  });
}

export interface FrameRef {
  clipId: string;
  time: number;
}

/** Just before a cut: the shot's own last frame. */
const BEFORE_CUT = 1e-3;

/** The clip frames whose looks a layout needs, read right at each cut. */
export function lookFrames(lay: Layout): { intro: FrameRef | null; outro: FrameRef | null; transitions: { before: FrameRef; after: FrameRef }[] } {
  const { shots } = lay;
  const start = (i: number): FrameRef => ({ clipId: shots[i].clipId, time: shots[i].sourceStart });
  const end = (i: number): FrameRef => ({ clipId: shots[i].clipId, time: Math.max(shots[i].sourceStart, shots[i].sourceEnd - BEFORE_CUT) });
  return {
    intro: lay.intro && shots.length ? start(0) : null,
    outro: lay.outro && shots.length ? end(shots.length - 1) : null,
    transitions: shots.slice(1).map((_, i) => ({ before: end(i), after: start(i + 1) })),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/renderVideo.test.ts && npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/renderVideo.ts tests/engine/renderVideo.test.ts
git commit -m "feat(video): render a video frame with stroke phases over the cuts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Ton-Mix (reine Funktionen)

**Files:**
- Create: `src/export/audioMix.ts`
- Test: `tests/export/audioMix.test.ts`

**Interfaces:**
- Consumes: `Layout` (Task 4).
- Produces: `MIX_RATE = 48000`, `type Stereo = [Float32Array, Float32Array]`, `createMix(duration, rate?)`, `toStereo(planes)`, `resample(plane, from, to)`, `shotGain(lay, i, t)`, `addInto(mix, chunk, at, gain, rate?)`, `planarSlice(mix, from, to)`.

- [ ] **Step 1: Write the failing tests** – `tests/export/audioMix.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { layout } from '../../src/engine/videoTimeline';
import { addInto, createMix, planarSlice, resample, shotGain, toStereo } from '../../src/export/audioMix';

const f32 = (...v: number[]) => Float32Array.from(v);
const lay = (imgMask: boolean) => layout({
  clips: [{ id: 'a', duration: 3 }, { id: 'b', duration: 2 }], markers: [], dauer: 0.5, imgMask, intro: false, outro: false,
});

describe('toStereo', () => {
  it('doubles mono, keeps stereo and drops extra channels', () => {
    const m = f32(1, 2);
    expect(toStereo([m])).toEqual([m, m]);
    const l = f32(1), r = f32(2), c = f32(3);
    expect(toStereo([l, r, c])).toEqual([l, r]);
  });
});

describe('resample', () => {
  it('leaves matching rates alone and interpolates linearly', () => {
    const p = f32(0, 1);
    expect(resample(p, 48_000, 48_000)).toBe(p);
    expect([...resample(p, 24_000, 48_000)]).toEqual([0, 0.5, 1, 1]);
  });
});

describe('shotGain', () => {
  it('cuts hard at a colour cut', () => {
    expect(shotGain(lay(false), 0, 2.99)).toBe(1);
    expect(shotGain(lay(false), 0, 3)).toBe(0);
    expect(shotGain(lay(false), 1, 3)).toBe(1);
  });
  it('crossfades linearly across an IMG MASK overlap', () => {
    const l = lay(true); // shot a [0, 3), shot b [2, 4)
    expect(shotGain(l, 0, 2.25)).toBeCloseTo(0.75, 9);
    expect(shotGain(l, 1, 2.25)).toBeCloseTo(0.25, 9);
    expect(shotGain(l, 0, 1)).toBe(1);
    expect(shotGain(l, 1, 3.5)).toBe(1);
  });
});

describe('addInto / planarSlice', () => {
  it('adds a chunk at its output time, scaled, and leaves silence elsewhere', () => {
    const mix = createMix(1, 4); // 4 frames at 4 Hz
    addInto(mix, [f32(1, 1), f32(2, 2)], 0.5, () => 0.5, 4);
    addInto(mix, [f32(1), f32(1)], 0.75, () => 1, 4);
    expect([...mix[0]]).toEqual([0, 0, 0.5, 1.5]);
    expect([...mix[1]]).toEqual([0, 0, 1, 2]);
  });
  it('drops samples outside the mix', () => {
    const mix = createMix(0.5, 4);
    addInto(mix, [f32(1, 1, 1), f32(1, 1, 1)], -0.25, () => 1, 4);
    expect([...mix[0]]).toEqual([1, 1]);
  });
  it('slices the mix into one planar buffer, left then right', () => {
    const mix: [Float32Array, Float32Array] = [f32(1, 2, 3), f32(4, 5, 6)];
    expect([...planarSlice(mix, 1, 3)]).toEqual([2, 3, 5, 6]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/export/audioMix.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/export/audioMix.ts`**

```ts
import type { Layout } from '../engine/videoTimeline';

export const MIX_RATE = 48_000;

/** Left and right channel, planar. */
export type Stereo = [Float32Array, Float32Array];

export function createMix(duration: number, rate = MIX_RATE): Stereo {
  const frames = Math.max(0, Math.ceil(duration * rate));
  return [new Float32Array(frames), new Float32Array(frames)];
}

export function toStereo(planes: readonly Float32Array[]): Stereo {
  if (planes.length === 0) throw new Error('toStereo needs at least one channel');
  return [planes[0], planes[1] ?? planes[0]];
}

/** Linear-interpolation resampling – plenty for the sound under a social video. */
export function resample(plane: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return plane;
  const out = new Float32Array(Math.round((plane.length * to) / from));
  const step = from / to;
  const last = plane.length - 1;
  for (let j = 0; j < out.length; j++) {
    const pos = j * step;
    const i = Math.min(Math.floor(pos), last);
    out[j] = plane[i] + (plane[Math.min(i + 1, last)] - plane[i]) * (pos - i);
  }
  return out;
}

/** Volume of shot `i` at output time t: 0 outside it; with IMG MASK it fades in and out across the overlaps. */
export function shotGain(lay: Layout, i: number, t: number): number {
  const shot = lay.shots[i];
  if (!shot || t < shot.start || t >= shot.end) return 0;
  if (!lay.imgMask) return 1;
  const w = 2 * lay.dauer;
  const next = lay.shots[i + 1];
  let gain = 1;
  if (i > 0 && t < shot.start + w) gain = Math.min(gain, (t - shot.start) / w);
  if (next && t >= next.start) gain = Math.min(gain, 1 - (t - next.start) / w);
  return Math.max(0, gain);
}

/** Adds `chunk` into the mix from output time `at` on, scaled by `gain(t)`. */
export function addInto(mix: Stereo, chunk: Stereo, at: number, gain: (t: number) => number, rate = MIX_RATE): void {
  const offset = Math.round(at * rate);
  for (let j = 0; j < chunk[0].length; j++) {
    const k = offset + j;
    if (k < 0 || k >= mix[0].length) continue;
    const g = gain(k / rate);
    if (g === 0) continue;
    mix[0][k] += chunk[0][j] * g;
    mix[1][k] += chunk[1][j] * g;
  }
}

/** Frames [from, to) of the mix as one f32-planar buffer: the left plane, then the right. */
export function planarSlice(mix: Stereo, from: number, to: number): Float32Array {
  const left = mix[0].subarray(from, to);
  const right = mix[1].subarray(from, to);
  const out = new Float32Array(left.length * 2);
  out.set(left, 0);
  out.set(right, left.length);
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/export/audioMix.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/export/audioMix.ts tests/export/audioMix.test.ts
git commit -m "feat(export): pure audio mix with IMG MASK crossfades

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Zustand, Marker-Operationen, Dateityp-Prüfung, Uhrzeit-Format

**Files:**
- Modify: `src/state/store.ts`
- Create: `src/video/markers.ts`, `src/video/accept.ts`, `src/util/time.ts`
- Test: `tests/video/markers.test.ts`, `tests/video/accept.test.ts`, `tests/util/time.test.ts`

**Interfaces:**
- Consumes: `Marker`, `VideoTimelineInput`, `validMarkerTime`, `shotSpans` (Task 4); `Settings`, `Size` (Task 1).
- Produces:
  - store: `interface VideoClipEntry { id; name; file: File; url: string; duration; width; height; hasAudio: boolean; stripUrl: string }`, Signals `videoClips`, `markers`, `playhead`, `selectedMarker`; `ToolId` + `'dauer' | 'introOutro' | 'audio'`; `timelineInput(s?)`, `cutCount()`, `hasContent()`, `firstSourceSize()`; `colorLocked()` modusabhängig.
  - `src/video/markers.ts`: `newMarkerId()`, `addMarker(input, clipId, time, id?)`, `moveMarker(input, id, time)`, `removeMarker(markers, id)`, `forgetClipMarkers(markers, clipId)`.
  - `src/video/accept.ts`: `isAcceptedVideo(file)`, `VIDEO_ACCEPT`.
  - `src/util/time.ts`: `formatClock(seconds): string` (`m:ss`).

- [ ] **Step 1: Write the failing tests**

`tests/video/markers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { VideoTimelineInput } from '../../src/engine/videoTimeline';
import { addMarker, forgetClipMarkers, moveMarker, removeMarker } from '../../src/video/markers';

const base = (markers: VideoTimelineInput['markers'] = []): VideoTimelineInput => ({
  clips: [{ id: 'a', duration: 6 }, { id: 'b', duration: 2 }], markers, dauer: 0.5, imgMask: false, intro: false, outro: false,
});

describe('markers', () => {
  it('adds a marker on the nearest valid frame', () => {
    expect(addMarker(base(), 'a', 2.013, 'm1')).toEqual([{ id: 'm1', clipId: 'a', time: 2 }]);
  });
  it('refuses a marker in a clip with no room', () => {
    expect(addMarker({ ...base(), clips: [{ id: 'a', duration: 0.9 }] }, 'a', 0.45, 'm1')).toBeNull();
  });
  it('moves a marker but never onto another one or too close to it', () => {
    const start = base([{ id: 'm1', clipId: 'a', time: 2 }, { id: 'm2', clipId: 'a', time: 4 }]);
    const moved = moveMarker(start, 'm1', 4);
    const m1 = moved.find((m) => m.id === 'm1');
    expect(m1?.time).not.toBe(4);
    expect(Math.abs((m1?.time ?? 0) - 4)).toBeGreaterThanOrEqual(1 - 1e-9);
  });
  it('keeps the markers when the id is unknown', () => {
    const start = base([{ id: 'm1', clipId: 'a', time: 2 }]);
    expect(moveMarker(start, 'zz', 3)).toBe(start.markers);
  });
  it('removes one marker or every marker of a clip', () => {
    const list = [{ id: 'm1', clipId: 'a', time: 2 }, { id: 'm2', clipId: 'b', time: 1 }];
    expect(removeMarker(list, 'm1')).toEqual([list[1]]);
    expect(forgetClipMarkers(list, 'b')).toEqual([list[0]]);
  });
});
```

`tests/video/accept.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isAcceptedVideo } from '../../src/video/accept';

describe('isAcceptedVideo', () => {
  it('accepts MP4, MOV and WEBM by type or, without a type, by extension', () => {
    expect(isAcceptedVideo({ type: 'video/mp4', name: 'a.mp4' })).toBe(true);
    expect(isAcceptedVideo({ type: 'video/quicktime', name: 'IMG_0001.MOV' })).toBe(true);
    expect(isAcceptedVideo({ type: 'video/webm', name: 'a.webm' })).toBe(true);
    expect(isAcceptedVideo({ type: '', name: 'clip.MOV' })).toBe(true);
  });
  it('rejects images and other video containers', () => {
    expect(isAcceptedVideo({ type: 'image/png', name: 'a.png' })).toBe(false);
    expect(isAcceptedVideo({ type: 'video/x-msvideo', name: 'a.avi' })).toBe(false);
    expect(isAcceptedVideo({ type: '', name: 'a.avi' })).toBe(false);
  });
});
```

`tests/util/time.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatClock } from '../../src/util/time';

describe('formatClock', () => {
  it('shows minutes and two-digit seconds, rounded down', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(7.9)).toBe('0:07');
    expect(formatClock(83)).toBe('1:23');
    expect(formatClock(-1)).toBe('0:00');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/video tests/util/time.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the pure modules**

`src/util/time.ts`:

```ts
/** m:ss, rounded down – for the transport and the timeline. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
```

`src/video/accept.ts`:

```ts
const ACCEPTED = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];

/** For the file picker in video mode. */
export const VIDEO_ACCEPT = ACCEPTED.join(',');

/** Some drag sources report no MIME type; fall back to the file extension. */
export function isAcceptedVideo(file: { type: string; name: string }): boolean {
  return file.type ? ACCEPTED.includes(file.type) : /\.(mp4|m4v|mov|webm)$/i.test(file.name);
}
```

`src/video/markers.ts`:

```ts
import { validMarkerTime, type Marker, type VideoTimelineInput } from '../engine/videoTimeline';

let nextId = 0;
export const newMarkerId = (): string => `mk${++nextId}`;

/** The markers plus one at (clipId, time), moved to the nearest valid frame – or null if the clip has no room. */
export function addMarker(input: VideoTimelineInput, clipId: string, time: number, id = newMarkerId()): Marker[] | null {
  const t = validMarkerTime(input, clipId, time);
  return t === null ? null : [...input.markers, { id, clipId, time: t }];
}

/** The markers with `id` moved inside its own clip to the nearest valid frame; unchanged if there is none. */
export function moveMarker(input: VideoTimelineInput, id: string, time: number): readonly Marker[] {
  const marker = input.markers.find((m) => m.id === id);
  if (!marker) return input.markers;
  const rest = input.markers.filter((m) => m.id !== id);
  const t = validMarkerTime({ ...input, markers: rest }, marker.clipId, time);
  return t === null ? input.markers : [...rest, { ...marker, time: t }];
}

export const removeMarker = (markers: readonly Marker[], id: string): Marker[] => markers.filter((m) => m.id !== id);

export const forgetClipMarkers = (markers: readonly Marker[], clipId: string): Marker[] =>
  markers.filter((m) => m.clipId !== clipId);
```

- [ ] **Step 4: Extend the store** – `src/state/store.ts` komplett:

```ts
import { imgMaskOn } from '../engine/render';
import { randomSeed } from '../engine/rng';
import type { Settings, Size } from '../engine/types';
import { shotSpans, type Marker, type VideoTimelineInput } from '../engine/videoTimeline';
import { loadSettings, saveSettings } from './settings';
import { signal } from './signal';

export interface ImageEntry {
  id: string;
  name: string;
  bitmap: ImageBitmap;
  thumbUrl: string;
}

export interface VideoClipEntry {
  id: string;
  name: string;
  file: File;
  /** Object URL the preview's <video> elements play. */
  url: string;
  /** Source length in seconds. */
  duration: number;
  /** Display size, rotation already applied. */
  width: number;
  height: number;
  hasAudio: boolean;
  /** Object URL of a strip of small frames for the timeline. */
  stripUrl: string;
}

export type ToolId =
  | 'size' | 'stretch' | 'threshold' | 'remove' | 'color' | 'imgMask'
  | 'motion' | 'move' | 'speed' | 'loops' | 'format'
  | 'dauer' | 'introOutro' | 'audio';

export const settings = signal<Settings>(loadSettings());
export const images = signal<readonly ImageEntry[]>([]);
/** Clip picked in the clip strip (shown while paused). */
export const selected = signal(0);
export const playing = signal(false);
/** Clip currently on screen while playing. */
export const shownClip = signal(0);
export const seed = signal(randomSeed());
export const activeTool = signal<ToolId>('size');
export const exporting = signal(false);

export const videoClips = signal<readonly VideoClipEntry[]>([]);
export const markers = signal<readonly Marker[]>([]);
/** Output time under the playhead in video mode, in seconds. */
export const playhead = signal(0);
export const selectedMarker = signal<string | null>(null);

export function timelineInput(s: Settings = settings.get()): VideoTimelineInput {
  return {
    clips: videoClips.get().map((c) => ({ id: c.id, duration: c.duration })),
    markers: markers.get(),
    dauer: s.dauer,
    imgMask: s.imgMask,
    intro: s.intro,
    outro: s.outro,
  };
}

/** Cuts in video mode: clip boundaries plus markers. */
export function cutCount(): number {
  return Math.max(0, shotSpans(timelineInput()).length - 1);
}

/** Whether the active mode has anything to show. */
export function hasContent(): boolean {
  return settings.get().mode === 'photo' ? images.get().length > 0 : videoClips.get().length > 0;
}

/** Size of the first clip of the active mode – ORIGINAL takes it over. */
export function firstSourceSize(): Size | null {
  if (settings.get().mode === 'photo') return images.get()[0]?.bitmap ?? null;
  const clip = videoClips.get()[0];
  return clip ? { width: clip.width, height: clip.height } : null;
}

/**
 * IMG MASK reveals the next clip instead of drawing strokes, so the stroke colour has no say –
 * unless a video intro or outro still draws colour strokes.
 */
export function colorLocked(): boolean {
  const s = settings.get();
  if (s.mode === 'photo') return imgMaskOn(s, images.get().length);
  return s.imgMask && cutCount() >= 1 && !s.intro && !s.outro;
}

export function patchSettings(patch: Partial<Settings>): void {
  settings.update((s) => ({ ...s, ...patch }));
}

settings.subscribe((s) => saveSettings(s));
```

- [ ] **Step 5: Run all tests and the type check**

Run: `npm test && npx tsc --noEmit`
Expected: PASS. (Falls `tsc` über `ToolId` in `tools.ts` nichts meldet, ist das korrekt – die neuen Werkzeuge kommen in Task 11.)

- [ ] **Step 6: Commit**

```bash
git add src/state/store.ts src/video/markers.ts src/video/accept.ts src/util/time.ts tests/video tests/util/time.test.ts
git commit -m "feat(video): store for clips, markers and playhead; marker operations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Clips öffnen, Analyse-Frames, Video-Szene

**Files:**
- Modify: `src/engine/analysisCache.ts`
- Create: `src/video/media.ts`, `src/video/clipImport.ts`, `src/video/scene.ts`

**Interfaces:**
- Consumes: Task 1–8.
- Produces:
  - `AnalysisCache.needsPixels(id, size, fit): boolean`, `.look(id, source: DrawSource | null, size, fit, s): BarLook`, `.prune(keep: (id: string) => boolean): void`; `.layer()` unverändert nach außen.
  - `media.ts`: `class ClipError extends Error`, `openClip(id, file): Promise<{ duration; width; height; hasAudio }>`, `frameAt(id, time, size, fit): Promise<HTMLCanvasElement | OffscreenCanvas>`, `filmstrip(id, duration): Promise<string>`, `closeClip(id): void`.
  - `clipImport.ts`: `addVideoFiles(files)`, `removeVideoClip(index)`, `moveVideoClip(from, to)`.
  - `scene.ts`: `videoScene: Signal<VideoProjectScene | null>`, `buildVideoScene(): Promise<VideoProjectScene | null>`, `watchVideoScene(): void`.

Diese Module brauchen Browser-APIs (WebCodecs, OffscreenCanvas); sie werden per Typecheck abgesichert und in Task 15 im Browser geprüft.

- [ ] **Step 1: Teach `AnalysisCache` looks without a bitmap** – `src/engine/analysisCache.ts` komplett:

```ts
import { barGrid, buildForegroundMask, gridBars, maskSize, selectStrokeBars, type ForegroundMask, type PixelData } from './analyze';
import { rasterize } from './raster';
import type { ImageLayer } from './render';
import type { BarLook } from './strokes';
import type { DrawSource, Fit, Settings, Size } from './types';

interface Entry {
  pixelsKey: string;
  full: PixelData;
  small: PixelData;
  maskKey?: string;
  mask?: ForegroundMask;
  barsKey?: string;
  look?: BarLook;
  layer?: ImageLayer;
}

const pixelsKeyOf = (size: Size, fit: Fit) => `${size.width}x${size.height}:${fit}`;

/**
 * Staged cache per picture: pixels (format) → mask (sensitivity) → bars (size, stretch,
 * threshold, side). A slider only recomputes the stages after it.
 */
export class AnalysisCache {
  private entries = new Map<string, Entry>();

  /** Whether `look` needs the picture again (new picture, or new output size or fit). */
  needsPixels(id: string, size: Size, fit: Fit): boolean {
    return this.entries.get(id)?.pixelsKey !== pixelsKeyOf(size, fit);
  }

  /** Stroke and grid bars of picture `id`; `source` may be null while `needsPixels` is false. */
  look(id: string, source: DrawSource | null, size: Size, fit: Fit, s: Settings): BarLook {
    const pixelsKey = pixelsKeyOf(size, fit);
    let e = this.entries.get(id);
    if (!e || e.pixelsKey !== pixelsKey) {
      if (!source) throw new Error(`No picture for ${id}`);
      e = { pixelsKey, full: rasterize(source, size, fit), small: rasterize(source, maskSize(size.width, size.height), fit) };
      this.entries.set(id, e);
    }
    const maskKey = String(s.sensitivity);
    if (!e.mask || e.maskKey !== maskKey) {
      e.mask = buildForegroundMask(e.small, s.sensitivity);
      e.maskKey = maskKey;
      e.barsKey = undefined;
    }
    const barsKey = `${s.size}:${s.stretch}:${s.threshold}:${s.removeFront}`;
    if (!e.look || e.barsKey !== barsKey) {
      const grid = barGrid(size.width, size.height, s.size, s.stretch);
      e.look = {
        gridBars: gridBars(size.width, size.height, grid),
        strokeBars: selectStrokeBars(e.full, e.mask, grid, s.threshold, s.removeFront),
      };
      e.barsKey = barsKey;
    }
    return e.look;
  }

  layer(id: string, bitmap: ImageBitmap, size: Size, fit: Fit, s: Settings): ImageLayer {
    const look = this.look(id, bitmap, size, fit, s);
    const e = this.entries.get(id);
    if (!e) throw new Error(`No entry for ${id}`);
    // Same object while nothing changed: render caches (bar order, grid edges) key on it.
    if (!e.layer || e.layer.strokeBars !== look.strokeBars || e.layer.bitmap !== bitmap) e.layer = { bitmap, ...look };
    return e.layer;
  }

  forget(id: string): void {
    this.entries.delete(id);
  }

  /** Drops every entry `keep` says no to. */
  prune(keep: (id: string) => boolean): void {
    for (const id of [...this.entries.keys()]) if (!keep(id)) this.entries.delete(id);
  }
}
```

- [ ] **Step 2: Create `src/video/media.ts`**

```ts
import { ALL_FORMATS, BlobSource, CanvasSink, Input, type InputVideoTrack } from 'mediabunny';
import type { Fit, Size } from '../engine/types';

interface ClipMedia {
  input: Input;
  video: InputVideoTrack;
  /** Frame grabbers by output size and fit. */
  sinks: Map<string, CanvasSink>;
}
const media = new Map<string, ClipMedia>();

/** A clip that can't be used; the message completes "<file name> …". */
export class ClipError extends Error {}

export interface ClipProbe {
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

/** Opens a clip, checks it can be played and keeps it open for frame grabs. */
export async function openClip(id: string, file: File): Promise<ClipProbe> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const video = await input.getPrimaryVideoTrack();
    if (!video) throw new ClipError('has no video track');
    if (!(await video.canDecode())) throw new ClipError("uses a video codec this browser can't decode");
    const duration = await input.computeDuration();
    if (!(duration > 0)) throw new ClipError('is empty');
    const audio = await input.getPrimaryAudioTrack();
    const hasAudio = !!audio && (await audio.canDecode());
    media.set(id, { input, video, sinks: new Map() });
    // Display size: rotation from the file (portrait iPhone clips) already applied.
    return { duration, width: await video.getDisplayWidth(), height: await video.getDisplayHeight(), hasAudio };
  } catch (err) {
    input.dispose();
    throw err;
  }
}

/** The frame showing at clip time `time`, scaled and cropped like the output frame. */
export async function frameAt(id: string, time: number, size: Size, fit: Fit): Promise<HTMLCanvasElement | OffscreenCanvas> {
  const m = media.get(id);
  if (!m) throw new Error(`Clip ${id} is not open`);
  const key = `${size.width}x${size.height}:${fit}`;
  let sink = m.sinks.get(key);
  if (!sink) {
    sink = new CanvasSink(m.video, { width: size.width, height: size.height, fit });
    m.sinks.set(key, sink);
  }
  // Before the first frame (some files start slightly after 0) take the first frame.
  const wrapped = (await sink.getCanvas(time)) ?? (await sink.getCanvas(await m.video.getFirstTimestamp()));
  if (!wrapped) throw new Error(`No frame at ${time.toFixed(2)} s`);
  return wrapped.canvas;
}

const STRIP_HEIGHT = 96;
const STRIP_MAX_FRAMES = 40;

/** One small frame per second of the clip side by side, as an object URL for the timeline. */
export async function filmstrip(id: string, duration: number): Promise<string> {
  const m = media.get(id);
  if (!m) throw new Error(`Clip ${id} is not open`);
  const ratio = (await m.video.getDisplayWidth()) / (await m.video.getDisplayHeight());
  const w = Math.max(1, Math.round(STRIP_HEIGHT * ratio));
  const count = Math.min(STRIP_MAX_FRAMES, Math.max(1, Math.ceil(duration)));
  const strip = new OffscreenCanvas(w * count, STRIP_HEIGHT);
  const ctx = strip.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available.');
  const sink = new CanvasSink(m.video, { width: w, height: STRIP_HEIGHT, fit: 'cover' });
  const times = Array.from({ length: count }, (_, i) => ((i + 0.5) * duration) / count);
  let i = 0;
  for await (const frame of sink.canvasesAtTimestamps(times)) {
    if (frame) ctx.drawImage(frame.canvas, i * w, 0);
    i++;
  }
  return URL.createObjectURL(await strip.convertToBlob({ type: 'image/jpeg', quality: 0.7 }));
}

export function closeClip(id: string): void {
  const m = media.get(id);
  media.delete(id);
  m?.input.dispose();
}
```

- [ ] **Step 3: Create `src/video/clipImport.ts`**

```ts
import { markers, playhead, playing, selectedMarker, videoClips, type VideoClipEntry } from '../state/store';
import { toast } from '../ui/toast';
import { moveItem } from '../util/array';
import { isAcceptedVideo } from './accept';
import { forgetClipMarkers } from './markers';
import { ClipError, closeClip, filmstrip, openClip } from './media';

let nextId = 0;

export async function addVideoFiles(files: Iterable<File>): Promise<void> {
  const added: VideoClipEntry[] = [];
  for (const file of files) {
    if (!isAcceptedVideo(file)) {
      toast(`${file.name}: please use MP4, MOV or WEBM`, 'error');
      continue;
    }
    const id = `vid${++nextId}`;
    try {
      const probe = await openClip(id, file);
      const stripUrl = await filmstrip(id, probe.duration);
      added.push({ id, name: file.name, file, url: URL.createObjectURL(file), stripUrl, ...probe });
    } catch (err) {
      closeClip(id);
      toast(`${file.name} ${err instanceof ClipError ? err.message : 'could not be loaded'}`, 'error');
    }
  }
  if (added.length) videoClips.update((list) => [...list, ...added]);
}

export function removeVideoClip(index: number): void {
  const list = videoClips.get();
  const entry = list[index];
  if (!entry) return;
  playing.set(false);
  const next = list.filter((_, i) => i !== index);
  markers.set(forgetClipMarkers(markers.get(), entry.id));
  selectedMarker.set(null);
  videoClips.set(next);
  if (next.length === 0) playhead.set(0);
  // Release resources only after the store no longer references the clip.
  closeClip(entry.id);
  URL.revokeObjectURL(entry.url);
  URL.revokeObjectURL(entry.stripUrl);
}

export function moveVideoClip(from: number, to: number): void {
  const list = videoClips.get();
  if (!list[from]) return;
  videoClips.set(moveItem(list, from, to));
}
```

(`moveItem` existiert in `src/util/array.ts` mit Signatur `moveItem<T>(list: readonly T[], from: number, to: number): T[]` – vor Benutzung kurz mit `sed -n 1,7p src/util/array.ts` prüfen.)

- [ ] **Step 4: Create `src/video/scene.ts`**

```ts
import { AnalysisCache } from '../engine/analysisCache';
import { fitFor, outputSize } from '../engine/formats';
import { lookFrames, type FrameRef, type VideoLooks, type VideoProjectScene } from '../engine/renderVideo';
import type { BarLook } from '../engine/strokes';
import { layout } from '../engine/videoTimeline';
import { effect, signal } from '../state/signal';
import { markers, seed, settings, timelineInput, videoClips } from '../state/store';
import { toast } from '../ui/toast';
import { frameAt } from './media';

const cache = new AnalysisCache();
const keyOf = (f: FrameRef) => `${f.clipId}@${Math.round(f.time * 1e4)}`;

/** The current video scene; rebuilt (async) whenever clips, markers or settings change. */
export const videoScene = signal<VideoProjectScene | null>(null);

export async function buildVideoScene(): Promise<VideoProjectScene | null> {
  const clips = videoClips.get();
  if (clips.length === 0) return null;
  const s = settings.get();
  const size = outputSize(s.format, { width: clips[0].width, height: clips[0].height });
  if (!size) return null;
  const fit = fitFor(s.format);
  const lay = layout(timelineInput(s));
  const frames = lookFrames(lay);
  const used = new Set<string>();
  const look = async (f: FrameRef): Promise<BarLook> => {
    const key = keyOf(f);
    used.add(key);
    const source = cache.needsPixels(key, size, fit) ? await frameAt(f.clipId, f.time, size, fit) : null;
    return cache.look(key, source, size, fit, s);
  };
  const looks: VideoLooks = {
    intro: frames.intro && (await look(frames.intro)),
    outro: frames.outro && (await look(frames.outro)),
    transitions: [],
  };
  for (const t of frames.transitions) looks.transitions.push({ before: await look(t.before), after: await look(t.after) });
  cache.prune((id) => used.has(id));
  return { width: size.width, height: size.height, fit, settings: s, seed: seed.get(), layout: lay, looks };
}

/** Keeps `videoScene` current in video mode; a build that got overtaken is thrown away. */
export function watchVideoScene(): void {
  let generation = 0;
  effect([settings, videoClips, markers, seed], () => {
    if (settings.get().mode !== 'video') return;
    const gen = ++generation;
    buildVideoScene().then(
      (scene) => {
        if (gen === generation) videoScene.set(scene);
      },
      (err: unknown) => {
        if (gen === generation) toast(`Video frames could not be read: ${err instanceof Error ? err.message : String(err)}`, 'error');
      },
    );
  });
}
```

- [ ] **Step 5: Run all tests, type check and build**

Run: `npm test && npm run build`
Expected: PASS; Build ohne Fehler.

- [ ] **Step 6: Commit**

```bash
git add src/engine/analysisCache.ts src/video/media.ts src/video/clipImport.ts src/video/scene.ts
git commit -m "feat(video): open clips with Mediabunny and analyse the frames at each cut

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Vorschau-Player mit `<video>`-Elementen

**Files:**
- Create: `src/video/player.ts`

**Interfaces:**
- Consumes: `Layout`, `VideoFramePosition` (Task 4/5), `VideoFrames` (Task 6), `videoClips` (Task 8), `toast`.
- Produces: `class VideoPlayer { constructor(host: HTMLElement); sync(lay, pos, t, playing, audio): void; frames(pos): VideoFrames | null; busy(): boolean; pause(): void; allowSound(): void }`.

Browser-only; Prüfung in Task 15.

- [ ] **Step 1: Create `src/video/player.ts`**

```ts
import type { VideoFrames } from '../engine/renderVideo';
import type { Layout, VideoFramePosition } from '../engine/videoTimeline';
import { videoClips } from '../state/store';
import { toast } from '../ui/toast';

/** Seek once a playing video drifts this far from the timeline (s). */
const DRIFT = 0.1;
/** Line up the next clip this long before it shows (s). */
const PRELOAD = 1.5;
/** A paused video counts as in place within half a frame. */
const STILL_TOLERANCE = 0.5 / 30;

interface Want {
  time: number;
  gain: number;
  play: boolean;
}

/**
 * Plays the clips for the preview: up to two hidden <video> elements per clip (one per lane), kept
 * in step with the timeline clock. They also carry the sound, crossfaded across IMG MASK overlaps.
 */
export class VideoPlayer {
  private els = new Map<string, HTMLVideoElement>();
  private soundBlocked = false;

  constructor(private host: HTMLElement) {}

  /** Call from the play gesture: the browser may allow sound again. */
  allowSound(): void {
    this.soundBlocked = false;
  }

  sync(lay: Layout, pos: VideoFramePosition, t: number, playing: boolean, audio: boolean): void {
    this.dropRemovedClips();
    const want = new Map<HTMLVideoElement, Want>();
    const put = (clipId: string, lane: 0 | 1, w: Want) => {
      const el = this.el(clipId, lane);
      if (el && !want.has(el)) want.set(el, w);
    };
    put(pos.shot.clipId, pos.shot.lane, { time: pos.shot.sourceTime, gain: pos.next ? 1 - pos.progress : 1, play: playing });
    if (pos.next) put(pos.next.clipId, pos.next.lane, { time: pos.next.sourceTime, gain: pos.progress, play: playing });
    const up = lay.shots[pos.shot.shotIndex + (pos.next ? 2 : 1)];
    if (up && up.start - t < PRELOAD) put(up.clipId, up.lane, { time: up.sourceStart, gain: 0, play: false });

    const sound = audio && !this.soundBlocked;
    for (const el of this.els.values()) {
      const w = want.get(el);
      if (!w) {
        if (!el.paused) el.pause();
        continue;
      }
      el.muted = !sound || w.gain <= 0;
      el.volume = Math.min(1, Math.max(0, w.gain));
      const tolerance = w.play ? DRIFT : STILL_TOLERANCE;
      if (!el.seeking && Math.abs(el.currentTime - w.time) > tolerance) el.currentTime = w.time;
      if (w.play && el.paused) this.start(el);
      else if (!w.play && !el.paused) el.pause();
    }
  }

  /** The elements for `pos`, or null while one of them has no picture yet. */
  frames(pos: VideoFramePosition): VideoFrames | null {
    const shot = this.els.get(`${pos.shot.clipId}:${pos.shot.lane}`);
    const next = pos.next ? this.els.get(`${pos.next.clipId}:${pos.next.lane}`) : undefined;
    if (!shot || shot.readyState < 2) return null;
    if (pos.next && (!next || next.readyState < 2)) return null;
    return { shot, next: next ?? null };
  }

  /** Still moving to a new spot: draw again shortly. */
  busy(): boolean {
    for (const el of this.els.values()) if (el.seeking) return true;
    return false;
  }

  pause(): void {
    for (const el of this.els.values()) el.pause();
  }

  private el(clipId: string, lane: 0 | 1): HTMLVideoElement | null {
    const key = `${clipId}:${lane}`;
    let el = this.els.get(key);
    if (!el) {
      const clip = videoClips.get().find((c) => c.id === clipId);
      if (!clip) return null;
      el = document.createElement('video');
      el.src = clip.url;
      el.preload = 'auto';
      el.playsInline = true;
      el.muted = true;
      el.dataset.clip = clipId;
      this.host.append(el);
      this.els.set(key, el);
    }
    return el;
  }

  private start(el: HTMLVideoElement): void {
    el.play().catch(() => {
      // Autoplay rules (iOS) can refuse sound: carry on muted rather than freeze.
      if (el.muted) return;
      this.soundBlocked = true;
      el.muted = true;
      void el.play().catch(() => undefined);
      toast('The browser blocked the sound – the preview plays muted', 'info');
    });
  }

  private dropRemovedClips(): void {
    const ids = new Set(videoClips.get().map((c) => c.id));
    for (const [key, el] of this.els) {
      if (ids.has(el.dataset.clip ?? '')) continue;
      el.pause();
      el.removeAttribute('src');
      el.load();
      el.remove();
      this.els.delete(key);
    }
  }
}
```

- [ ] **Step 2: Type check and build**

Run: `npm run build`
Expected: ohne Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/video/player.ts
git commit -m "feat(video): preview player that keeps hidden video elements on the timeline clock

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Modus-Schalter, Werkzeuge, Verdrahtung

**Files:**
- Create: `src/ui/modeSwitch.ts`
- Modify: `src/ui/controls.ts`, `src/ui/tools.ts`, `src/ui/toolbar.ts`, `src/ui/sidebar.ts`, `src/ui/clips.ts`, `src/main.ts`, `index.html`, `src/styles/components.css`

**Interfaces:**
- Consumes: Task 1, 8, 9.
- Produces: `modeSwitch(): HTMLElement`; `dauerControl`, `introOutroControl`, `audioControl`; `ToolDef.modes?: readonly Mode[]`; `toolShown(tool): boolean`; `#modeTop`, `#timeline`, `#videoHost` in `index.html`; `mountPreview(root, pickFiles, addFiles, videoHost)` (Signatur, Umsetzung in Task 13).

- [ ] **Step 1: Mode switch** – `src/ui/modeSwitch.ts`:

```ts
import type { Mode } from '../engine/types';
import { effect } from '../state/signal';
import { patchSettings, playing, settings } from '../state/store';
import { h } from './dom';

/** PHOTO | VIDEO, Apple style. Switching keeps both projects; it only stops playback. */
export function modeSwitch(): HTMLElement {
  const option = (mode: Mode, text: string) => {
    const btn = h('button', {
      class: 'mode__btn',
      type: 'button',
      onclick: () => {
        if (settings.get().mode === mode) return;
        playing.set(false);
        patchSettings({ mode });
      },
    }, text);
    effect([settings], () => btn.setAttribute('aria-pressed', String(settings.get().mode === mode)));
    return btn;
  };
  return h('div', { class: 'mode', role: 'group', 'aria-label': 'Mode' }, option('photo', 'PHOTO'), option('video', 'VIDEO'));
}
```

- [ ] **Step 2: Controls** – in `src/ui/controls.ts`:

Imports ergänzen: `import { dauerLimit } from '../engine/videoTimeline';`, `import { colorLocked, firstSourceSize, images, markers, patchSettings, settings, timelineInput, videoClips } from '../state/store';` (ersetzt den alten Store-Import), `import { formatClock } from '../util/time';`, sowie `Settings` ist schon importiert.

`imgMaskControl` ersetzen und neue Controls ergänzen:

```ts
type SwitchKey = 'imgMask' | 'intro' | 'outro' | 'audio';

function switchField(text: string, key: SwitchKey): HTMLElement {
  const toggle = h('button', {
    class: 'switch',
    type: 'button',
    role: 'switch',
    'aria-label': text.toLowerCase(),
    onclick: () => {
      const patch: Partial<Settings> = {};
      patch[key] = !settings.get()[key];
      patchSettings(patch);
    },
  });
  effect([settings], () => toggle.setAttribute('aria-checked', String(settings.get()[key])));
  return h('div', { class: 'field field--inline' }, label(text), toggle);
}

export const imgMaskControl = (): HTMLElement => switchField('IMG MASK', 'imgMask');
export const introOutroControl = (): HTMLElement => h('div', { class: 'field' }, switchField('INTRO', 'intro'), switchField('OUTRO', 'outro'));
export const audioControl = (): HTMLElement => switchField('SOUND', 'audio');

/** DURATION: one stroke phase in seconds, the same for every cut; says when a short shot caps it. */
export function dauerControl(): HTMLElement {
  const field = sliderControl({ label: 'DURATION', key: 'dauer', readout: (v) => `${v.toFixed(1)} s` });
  const hint = h('p', { class: 'field__hint' });
  effect([settings, videoClips, markers], () => {
    const limit = dauerLimit(timelineInput());
    const capped = settings.get().dauer > limit.max;
    hint.hidden = !capped;
    if (capped) hint.textContent = `MAX ${limit.max.toFixed(2)} S · SHORT SHOT AT ${formatClock(limit.axisAt ?? 0)}`;
  });
  field.append(hint);
  return field;
}
```

In `formatControl` die erste Quelle modusabhängig lesen:

```ts
    options: () => {
      const first = firstSourceSize();
      return FORMATS.map((f) => ({ value: f.id, icon: f.icon, label: f.label, detail: pixelLabel(outputSize(f.id, first)) }));
    },
    value: () => settings.get().format,
    onSelect: (format) => patchSettings({ format }),
    deps: [settings, images, videoClips],
```

In `colorControl` die Effekt-Abhängigkeiten auf `[settings, images, videoClips, markers]` erweitern.

- [ ] **Step 3: Tools per mode** – `src/ui/tools.ts` komplett:

```ts
import { MODES, type Mode } from '../engine/types';
import { colorLocked, cutCount, images, settings, type ToolId } from '../state/store';
import {
  audioControl, colorControl, dauerControl, formatControl, imgMaskControl, introOutroControl, loopsControl, motionControl,
  moveControl, removeControl, sliderControl,
} from './controls';

export type GroupId = 'adjust' | 'background' | 'color' | 'motion' | 'format';

export interface ToolDef {
  id: ToolId;
  /** Short label under the icon in the mobile toolbar. */
  label: string;
  icon: string;
  group: GroupId;
  build: () => HTMLElement;
  /** Modes the tool belongs to (default: both). */
  modes?: readonly Mode[];
  visible?: () => boolean;
  /** Greyed out in the toolbar while this returns true (the control locks itself). */
  locked?: () => boolean;
}

const PHOTO: readonly Mode[] = ['photo'];
const VIDEO: readonly Mode[] = ['video'];

/** Single source for the desktop sidebar and the mobile toolbar, in toolbar order. */
export const TOOLS: readonly ToolDef[] = [
  { id: 'size', label: 'Size', icon: '▣', group: 'adjust', build: () => sliderControl({ label: 'SIZE', key: 'size' }) },
  { id: 'stretch', label: 'Stretch', icon: '↔', group: 'adjust', build: () => sliderControl({ label: 'STRETCH', key: 'stretch' }) },
  { id: 'threshold', label: 'Thresh.', icon: '◐', group: 'adjust', build: () => sliderControl({ label: 'THRESHOLD', key: 'threshold' }) },
  { id: 'remove', label: 'Remove', icon: '✂', group: 'background', build: removeControl },
  { id: 'color', label: 'Color', icon: '●', group: 'color', build: colorControl, locked: colorLocked },
  {
    id: 'imgMask', label: 'Img Mask', icon: '◧', group: 'color', build: imgMaskControl,
    visible: () => (settings.get().mode === 'photo' ? images.get().length >= 2 : cutCount() >= 1),
  },
  { id: 'introOutro', label: 'Intro', icon: '⬒', group: 'motion', build: introOutroControl, modes: VIDEO },
  { id: 'motion', label: 'Motion', icon: '∿', group: 'motion', build: motionControl },
  { id: 'move', label: 'Move', icon: '⧉', group: 'motion', build: moveControl },
  { id: 'speed', label: 'Speed', icon: '»', group: 'motion', modes: PHOTO, build: () => sliderControl({ label: 'SPEED', key: 'speed', readout: (v) => `${v.toFixed(1)}×` }) },
  { id: 'dauer', label: 'Duration', icon: '»', group: 'motion', build: dauerControl, modes: VIDEO },
  { id: 'loops', label: 'Loops', icon: '⟳', group: 'motion', build: loopsControl, modes: PHOTO },
  { id: 'audio', label: 'Sound', icon: '♪', group: 'motion', build: audioControl, modes: VIDEO },
  { id: 'format', label: 'Format', icon: '▯', group: 'format', build: formatControl },
];

export function toolShown(tool: ToolDef): boolean {
  return (tool.modes ?? MODES).includes(settings.get().mode) && (tool.visible?.() ?? true);
}
```

- [ ] **Step 4: Toolbar and sidebar follow the mode**

`src/ui/toolbar.ts`: Import `import { activeTool, images, markers, settings, videoClips } from '../state/store';` und `import { TOOLS, toolShown } from './tools';`; im Effekt:

```ts
    effect([activeTool, images, settings, videoClips, markers], () => {
      const visible = toolShown(tool);
```

(Rest unverändert.)

`src/ui/sidebar.ts` komplett:

```ts
import { effect } from '../state/signal';
import { exporting, hasContent, images, markers, settings, videoClips } from '../state/store';
import { h } from './dom';
import { modeSwitch } from './modeSwitch';
import { TOOLS, toolShown, type GroupId } from './tools';

/** Desktop: every control at once, in groups split by hairlines; EXPORT sits at the bottom. */
export function mountSidebar(root: HTMLElement, openExport: () => void): void {
  root.append(h('div', { class: 'sidebar__head' }, h('div', { class: 'sidebar__logo' }, 'STRATA'), modeSwitch()));
  const groups = new Map<GroupId, HTMLElement>();
  for (const tool of TOOLS) {
    let group = groups.get(tool.group);
    if (!group) {
      group = h('section', { class: `group group--${tool.group}` });
      groups.set(tool.group, group);
      root.append(group);
    }
    const el = tool.build();
    el.dataset.tool = tool.id;
    group.append(el);
    effect([settings, images, videoClips, markers], () => { el.hidden = !toolShown(tool); });
  }
  const exportBtn = h('button', { class: 'btn btn--solid sidebar__export', type: 'button', onclick: openExport }, 'EXPORT');
  root.append(exportBtn);
  effect([images, videoClips, settings, exporting], () => {
    exportBtn.disabled = !hasContent() || exporting.get();
  });
}
```

`src/ui/clips.ts`: Import um `settings` ergänzen; in `render()` `root.hidden = list.length === 0 || settings.get().mode !== 'photo';` und `effect([images, selected, playing, settings], render);`.

- [ ] **Step 5: HTML** – `index.html`: Topbar und Stage ergänzen, Video-Host vor `</body>`:

```html
    <header class="topbar">
      <span class="logo">STRATA</span>
      <div class="topbar__end">
        <div id="modeTop"></div>
        <button id="exportBtnTop" class="btn btn--solid btn--pill" type="button" disabled>EXPORT</button>
      </div>
    </header>
```

```html
    <main class="stage">
      <div class="preview" id="preview"><canvas id="previewCanvas" hidden></canvas></div>
      <div class="transport" id="transport" hidden></div>
      <div class="clips" id="clips" hidden></div>
      <div class="timeline" id="timeline" hidden></div>
    </main>
```

```html
  <div class="video-host" id="videoHost" aria-hidden="true"></div>
```

- [ ] **Step 6: Wire `src/main.ts`** – geänderte und neue Teile:

```ts
import { exportVideo } from './export/video';
import { effect } from './state/signal';
import { exporting, hasContent, images, patchSettings, settings, videoClips } from './state/store';
import { mountClips } from './ui/clips';
import { mountExportDialog } from './ui/exportDialog';
import { addImageFiles } from './ui/images';
import { modeSwitch } from './ui/modeSwitch';
import { mountPreview } from './ui/preview';
import { buildScene } from './ui/scene';
import { mountSidebar } from './ui/sidebar';
import { mountTimeline } from './ui/timeline';
import { mountToolbar } from './ui/toolbar';
import { mountTransport } from './ui/transport';
import { VIDEO_ACCEPT } from './video/accept';
import { addVideoFiles } from './video/clipImport';
import { watchVideoScene } from './video/scene';

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';

// … byId wie bisher …

const fileInput = byId<HTMLInputElement>('fileInput');
const pickFiles = (): void => fileInput.click();
const addFiles = (files: File[]): void => {
  void (settings.get().mode === 'photo' ? addImageFiles(files) : addVideoFiles(files));
};
fileInput.addEventListener('change', () => {
  if (fileInput.files?.length) addFiles([...fileInput.files]);
  fileInput.value = '';
});
effect([settings], () => {
  fileInput.accept = settings.get().mode === 'photo' ? IMAGE_ACCEPT : VIDEO_ACCEPT;
});
// Dropping a file outside the preview must not navigate away from the app.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

watchVideoScene();
const preview = mountPreview(byId('preview'), pickFiles, addFiles, byId('videoHost'));
const exportDialog = mountExportDialog(byId<HTMLDialogElement>('exportDialog'), preview);
mountSidebar(byId('sidebar'), exportDialog.open);
mountToolbar(byId('toolbar'), byId('panel'));
mountTransport(byId('transport'));
mountClips(byId('clips'), pickFiles);
mountTimeline(byId('timeline'), pickFiles);
byId('modeTop').append(modeSwitch());

const topExport = byId<HTMLButtonElement>('exportBtnTop');
topExport.addEventListener('click', exportDialog.open);

// Tools are greyed out without content; everything but the mode switch's target is locked while a video renders.
const tools = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('#sidebar > .group'), byId('panel'), byId('toolbar')];
const timeline = ['transport', 'clips', 'timeline'].map((id) => byId(id));
effect([images, videoClips, settings, exporting], () => {
  const empty = !hasContent();
  const busy = exporting.get();
  document.body.classList.toggle('is-empty', empty);
  topExport.disabled = empty || busy;
  for (const el of tools()) el.inert = empty || busy;
  for (const el of timeline) el.inert = busy;
  for (const el of document.querySelectorAll<HTMLElement>('.mode')) el.inert = busy;
});
```

Den DEV-Block um `addVideoFiles` erweitern: `Object.assign(window, { __strata: { addImageFiles, addVideoFiles, buildScene, exportVideo, loadTestImage, patchSettings } });`

Damit Task 11 allein baut, in diesem Task zwei Platzhalter-freie Minimalstände anlegen, die Task 12/13 ersetzen:
- `src/ui/timeline.ts`: `export function mountTimeline(root: HTMLElement, _pickFiles: () => void): void { root.hidden = true; }`
- `src/ui/preview.ts`: Signatur auf `mountPreview(root: HTMLElement, pickFiles: () => void, addFiles: (files: File[]) => void, _videoHost: HTMLElement): PreviewApi` ändern und im `drop`-Handler `addFiles([...e.dataTransfer.files])` statt `addImageFiles(...)` aufrufen (Import von `addImageFiles` entfernen).
- `src/ui/exportDialog.ts`: in `open()` `if (!hasContent() || dialog.open) return;` (Import `hasContent` statt `images` dort, wo nur `open()` es nutzt).

- [ ] **Step 7: CSS** – `src/styles/components.css`:

`.sidebar__logo`-Zeile (Zeile ~240) ersetzen durch:

```css
.sidebar__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-bottom: calc(10px + var(--air) * .5); }
.sidebar__logo { font-weight: 700; letter-spacing: .14em; font-size: 13px; }
```

nach `.logo { … }` (Zeile ~391) ergänzen:

```css
.topbar__end { display: flex; align-items: center; gap: 8px; }

/* ---------- mode switch ---------- */
.mode { display: inline-flex; padding: 2px; border-radius: var(--radius-pill); background: var(--surface-2); }
.mode__btn {
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .06em;
  color: var(--text-2);
  background: none;
  border: 0;
  border-radius: var(--radius-pill);
  padding: 6px 12px;
  min-height: 30px;
  cursor: pointer;
}
.mode__btn[aria-pressed="true"] { background: var(--text); color: #000; }
.mode__btn:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
.field__hint { font-size: var(--label); letter-spacing: .06em; color: var(--warn); }

/* Hidden players for the video preview: in the DOM (iOS decodes them), never seen. */
.video-host { position: fixed; left: 0; top: 0; width: 1px; height: 1px; overflow: hidden; opacity: 0; pointer-events: none; }
```

- [ ] **Step 8: Build and check the photo mode still works**

Run: `npm test && npm run build`
Expected: PASS. Dann `preview_start` mit `{ name: "strata" }`, im Browser-Pane `window.__strata.loadTestImage()` per `javascript_tool` ausführen, `read_page` prüfen: Foto-Modus unverändert (SPEED, LOOPS sichtbar; DURATION, INTRO, SOUND nicht). PHOTO/VIDEO-Schalter klicken → im Video-Modus: SPEED/LOOPS weg, DURATION/INTRO/SOUND da, leerer Zustand (Inhalt folgt in Task 13). `read_console_messages` ohne Fehler.

- [ ] **Step 9: Commit**

```bash
git add src/ui/modeSwitch.ts src/ui/controls.ts src/ui/tools.ts src/ui/toolbar.ts src/ui/sidebar.ts src/ui/clips.ts src/ui/timeline.ts src/ui/preview.ts src/ui/exportDialog.ts src/main.ts index.html src/styles/components.css
git commit -m "feat(ui): PHOTO | VIDEO switch and video tools (duration, intro/outro, sound)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Zeitleiste

**Files:**
- Modify: `src/ui/timeline.ts` (Minimalstand aus Task 11 ersetzen)
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: `axisLength`, `clipAt`, `clipOffsets`, `layout`, `outputTimeOf`, `videoPositionAt`, `validMarkerTime` (Task 4/5); `addMarker`, `moveMarker`, `removeMarker` (Task 8); `removeVideoClip`, `moveVideoClip` (Task 9); Store-Signale.
- Produces: `mountTimeline(root: HTMLElement, pickFiles: () => void): void`.

- [ ] **Step 1: Implement `src/ui/timeline.ts`**

```ts
import { motionById } from '../engine/motions';
import {
  axisLength, clipAt, clipOffsets, layout, outputTimeOf, validMarkerTime, videoPositionAt, type Marker,
} from '../engine/videoTimeline';
import { effect } from '../state/signal';
import { markers, playhead, playing, selectedMarker, settings, timelineInput, videoClips } from '../state/store';
import { formatClock } from '../util/time';
import { removeVideoClip, moveVideoClip } from '../video/clipImport';
import { addMarker, moveMarker, removeMarker } from '../video/markers';
import { h } from './dom';
import { toast } from './toast';

const LONG_PRESS_MS = 300;
const FRAME = 1 / 30;

/**
 * Video timeline: clips back to back by length, cuts as filled diamonds, markers as open ones
 * (drag to move, tap to select, × or Delete to remove), the playhead to scrub, intro / outro shaded.
 * A long press on a clip drags it to a new place.
 */
export function mountTimeline(root: HTMLElement, pickFiles: () => void): void {
  const track = h('div', { class: 'tl__track' });
  const head = h('div', { class: 'tl__head', 'aria-hidden': 'true' });
  const addMarkerBtn = h('button', { class: 'btn btn--ghost btn--pill tl__btn', type: 'button', onclick: () => addAtPlayhead() }, '+ MARKER');
  const addClipBtn = h('button', { class: 'btn btn--ghost btn--pill tl__btn', type: 'button', onclick: pickFiles }, '+ CLIP');
  root.append(track, h('div', { class: 'tl__bar' }, addMarkerBtn, addClipBtn));

  let selectedClip: string | null = null;
  let dragging = false;

  const lay = () => layout(timelineInput());
  const covered = () => motionById(settings.get().motion).covered;
  const axisFrom = (clientX: number) => {
    const r = track.getBoundingClientRect();
    return (Math.min(1, Math.max(0, (clientX - r.left) / r.width))) * axisLength(videoClips.get());
  };
  const pct = (x: number) => `${(x / Math.max(1e-9, axisLength(videoClips.get()))) * 100}%`;
  const seekAxis = (x: number) => {
    const c = clipAt(videoClips.get(), x);
    if (c) playhead.set(outputTimeOf(lay(), c.clipId, c.time));
  };

  const placeHead = () => {
    const l = lay();
    if (l.shots.length === 0) return;
    const pos = videoPositionAt(playhead.get(), l, covered());
    head.style.left = pct((clipOffsets(videoClips.get()).get(pos.shot.clipId) ?? 0) + pos.shot.sourceTime);
  };

  function addAtPlayhead(): void {
    const l = lay();
    if (l.shots.length === 0) return;
    const pos = videoPositionAt(playhead.get(), l, covered());
    const next = addMarker(timelineInput(), pos.shot.clipId, pos.shot.sourceTime);
    if (!next) {
      toast('No room for a marker here – the shots beside it would be too short', 'error');
      return;
    }
    playing.set(false);
    markers.set(next);
    selectedMarker.set(next[next.length - 1].id);
  }

  const dropIndex = (clientX: number, dragged: HTMLElement) => {
    let index = 0;
    track.querySelectorAll<HTMLElement>('.tl__clip').forEach((el) => {
      if (el === dragged) return;
      const r = el.getBoundingClientRect();
      if (clientX > r.left + r.width / 2) index++;
    });
    return index;
  };

  // Track: tap = select clip + seek, drag = scrub, long press on a clip = reorder.
  track.addEventListener('pointerdown', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('.tl__marker, .tl__remove')) return;
    track.setPointerCapture(e.pointerId);
    playing.set(false);
    const clipEl = target.closest<HTMLElement>('.tl__clip');
    const startX = e.clientX;
    let mode: 'press' | 'scrub' | 'reorder' = 'press';
    const timer = window.setTimeout(() => {
      if (mode !== 'press' || !clipEl) return;
      mode = 'reorder';
      dragging = true;
      clipEl.classList.add('is-dragging');
      navigator.vibrate?.(10);
    }, LONG_PRESS_MS);
    const move = (ev: PointerEvent) => {
      if (mode === 'press' && Math.abs(ev.clientX - startX) > 4) {
        mode = 'scrub';
        clearTimeout(timer);
      }
      if (mode === 'scrub') seekAxis(axisFrom(ev.clientX));
      else if (mode === 'reorder' && clipEl) clipEl.style.translate = `${ev.clientX - startX}px 0`;
    };
    const up = (ev: PointerEvent) => {
      clearTimeout(timer);
      track.removeEventListener('pointermove', move);
      track.removeEventListener('pointerup', up);
      track.removeEventListener('pointercancel', up);
      if (mode === 'reorder' && clipEl) {
        dragging = false;
        clipEl.style.translate = '';
        clipEl.classList.remove('is-dragging');
        if (ev.type === 'pointerup') moveVideoClip(Number(clipEl.dataset.index), dropIndex(ev.clientX, clipEl));
        render();
        return;
      }
      if (ev.type === 'pointercancel') return;
      seekAxis(axisFrom(ev.clientX));
      if (mode === 'press') {
        selectedClip = clipEl?.dataset.id ?? null;
        selectedMarker.set(null);
        render();
      }
    };
    track.addEventListener('pointermove', move);
    track.addEventListener('pointerup', up);
    track.addEventListener('pointercancel', up);
  });

  const markerEl = (m: Marker, left: string, isSelected: boolean) => {
    const el = h('button', {
      class: `tl__marker${isSelected ? ' is-selected' : ''}`,
      type: 'button',
      style: `left: ${left}`,
      'aria-label': `Marker at ${formatClock(m.time)} in ${videoClips.get().find((c) => c.id === m.clipId)?.name ?? 'clip'}`,
    });
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      playing.set(false);
      const clip = videoClips.get().find((c) => c.id === m.clipId);
      if (!clip) return;
      const base = clipOffsets(videoClips.get()).get(m.clipId) ?? 0;
      const rest = { ...timelineInput(), markers: markers.get().filter((x) => x.id !== m.id) };
      const startX = e.clientX;
      let time: number | null = null;
      const move = (ev: PointerEvent) => {
        if (time === null && Math.abs(ev.clientX - startX) <= 4) return;
        dragging = true;
        // Only the dot moves while dragging; the scene is rebuilt once, on release.
        const valid = validMarkerTime(rest, m.clipId, Math.min(clip.duration, Math.max(0, axisFrom(ev.clientX) - base)));
        if (valid === null) return;
        time = valid;
        el.style.left = pct(base + valid);
      };
      const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        dragging = false;
        if (time !== null) markers.set(moveMarker(timelineInput(), m.id, time));
        else selectedMarker.set(selectedMarker.get() === m.id ? null : m.id);
        render();
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        markers.set(removeMarker(markers.get(), m.id));
        selectedMarker.set(null);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        markers.set(moveMarker(timelineInput(), m.id, m.time + (e.key === 'ArrowLeft' ? -FRAME : FRAME)));
      }
    });
    return el;
  };

  const render = () => {
    if (dragging) return;
    const clips = videoClips.get();
    root.hidden = settings.get().mode !== 'video' || clips.length === 0;
    if (root.hidden) return;
    const offsets = clipOffsets(clips);
    const l = lay();
    const sel = selectedMarker.get();
    const list = markers.get();
    const selected = list.find((m) => m.id === sel);
    track.replaceChildren(
      ...clips.map((c, i) => h('div', {
        class: `tl__clip${c.id === selectedClip ? ' is-selected' : ''}`,
        'data-index': i,
        'data-id': c.id,
        style: `flex-grow: ${c.duration}`,
      },
      h('img', { src: c.stripUrl, alt: '', draggable: 'false' }),
      c.id === selectedClip
        ? h('button', {
          class: 'tl__remove',
          type: 'button',
          'aria-label': `Remove ${c.name}`,
          onclick: () => {
            selectedClip = null;
            removeVideoClip(i);
          },
        }, '×')
        : null)),
      ...clips.slice(1).map((c) => h('span', { class: 'tl__cut', style: `left: ${pct(offsets.get(c.id) ?? 0)}` })),
      l.intro ? h('span', { class: 'tl__edge', style: `left: 0; width: ${pct(l.dauer)}` }) : null,
      l.outro ? h('span', { class: 'tl__edge', style: `right: 0; width: ${pct(l.dauer)}` }) : null,
      ...list.map((m) => markerEl(m, pct((offsets.get(m.clipId) ?? 0) + m.time), m.id === sel)),
      selected
        ? h('button', {
          class: 'tl__remove tl__remove--marker',
          type: 'button',
          style: `left: ${pct((offsets.get(selected.clipId) ?? 0) + selected.time)}`,
          'aria-label': 'Remove marker',
          onclick: () => {
            markers.set(removeMarker(markers.get(), selected.id));
            selectedMarker.set(null);
          },
        }, '×')
        : null,
      head,
    );
    placeHead();
  };

  effect([settings, videoClips, markers, selectedMarker], render);
  playhead.subscribe(placeHead);
}
```

- [ ] **Step 2: CSS** – an `src/styles/components.css` vor dem `@media (width <= 768px)`-Block anhängen:

```css
/* ---------- video timeline ---------- */
.timeline { padding: 16px 14px 8px; border-top: 1px solid var(--line); -webkit-user-select: none; user-select: none; }
.tl__track { position: relative; display: flex; gap: 2px; height: 44px; touch-action: none; cursor: pointer; }
.tl__clip {
  position: relative;
  flex-basis: 0;
  min-width: 6px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--surface-2);

  & img { width: 100%; height: 100%; object-fit: fill; display: block; pointer-events: none; }
  &.is-selected { outline: 2px solid var(--text); outline-offset: 1px; overflow: visible; }
  &.is-dragging { z-index: 2; opacity: .8; }
}
.tl__cut, .tl__marker {
  position: absolute;
  top: -7px;
  width: 10px;
  height: 10px;
  translate: -50% 0;
  rotate: 45deg;
  border: 1.5px solid var(--text);
}
.tl__cut { background: var(--text); pointer-events: none; }
.tl__marker {
  padding: 0;
  background: var(--bg);
  cursor: grab;
  z-index: 1;

  &::before { content: ''; position: absolute; inset: -9px; }
  &.is-selected { box-shadow: 0 0 0 2px var(--bg), 0 0 0 3.5px var(--text); }
  &:focus-visible { outline: 2px solid var(--text); outline-offset: 3px; }
}
.tl__edge { position: absolute; top: 0; bottom: 0; background: rgb(255 255 255 / .28); pointer-events: none; }
.tl__head { position: absolute; top: -10px; bottom: -4px; width: 2px; translate: -1px 0; background: var(--text); pointer-events: none; z-index: 3; }
.tl__remove {
  position: absolute;
  top: -10px;
  right: -10px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 0;
  background: var(--text);
  color: #000;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  z-index: 4;
}
.tl__remove--marker { top: -34px; right: auto; translate: -50% 0; }
.tl__bar { display: flex; justify-content: center; gap: 8px; margin-top: 10px; }
.tl__btn { min-height: 30px; padding: 6px 12px; }
```

- [ ] **Step 3: Build**

Run: `npm test && npm run build`
Expected: PASS. (Sichtprüfung der Zeitleiste folgt in Task 15, wenn die Vorschau Videos zeigt.)

- [ ] **Step 4: Commit**

```bash
git add src/ui/timeline.ts src/styles/components.css
git commit -m "feat(ui): video timeline with playhead, cut and marker diamonds

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Vorschau und Transport im Video-Modus

**Files:**
- Modify: `src/ui/preview.ts`, `src/ui/transport.ts`

**Interfaces:**
- Consumes: `VideoPlayer` (Task 10), `videoScene` (Task 9), `renderVideoFrame`, `videoPosition` (Task 6), Store.
- Produces: `PreviewApi.videoStill(): Promise<Blob | null>` (zusätzlich zu `currentTime()`).

- [ ] **Step 1: Replace `src/ui/preview.ts`**

```ts
import { renderFrame, renderStill, sceneDuration, type Scene } from '../engine/render';
import { renderVideoFrame, videoPosition } from '../engine/renderVideo';
import type { Size } from '../engine/types';
import { effect } from '../state/signal';
import { hasContent, images, playhead, playing, seed, selected, settings, shownClip, videoClips } from '../state/store';
import { VideoPlayer } from '../video/player';
import { videoScene } from '../video/scene';
import { h } from './dom';
import { buildScene } from './scene';

export interface PreviewApi {
  /** Photo mode: animation time currently on screen, or null while paused. */
  currentTime(): number | null;
  /** Video mode: the frame under the playhead at output size, as PNG. */
  videoStill(): Promise<Blob | null>;
}

const PAD = 16;

export function mountPreview(root: HTMLElement, pickFiles: () => void, addFiles: (files: File[]) => void, videoHost: HTMLElement): PreviewApi {
  const canvas = root.querySelector('canvas');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) throw new Error('#preview needs a <canvas>');

  const player = new VideoPlayer(videoHost);
  let photo: Scene | null = null;
  let size: Size | null = null;
  let dirty = true;
  let raf = 0;
  let startedAt = 0;
  let playFrom = 0;
  let lastT: number | null = null;
  let empty: HTMLElement | null = null;
  let emptyMode = '';

  const isVideo = () => settings.get().mode === 'video';

  const fitCanvas = () => {
    if (!size) return;
    const box = root.getBoundingClientRect();
    const scale = Math.min((box.width - PAD * 2) / size.width, (box.height - PAD * 2) / size.height);
    const cssW = Math.max(1, Math.floor(size.width * scale));
    const cssH = Math.max(1, Math.floor(size.height * scale));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const w = Math.round(cssW * dpr);
    const hgt = Math.round(cssH * dpr);
    if (canvas.width !== w || canvas.height !== hgt) {
      canvas.width = w;
      canvas.height = hgt;
    }
  };

  /** Returns whether to draw again next frame. */
  const drawPhoto = (now: number): boolean => {
    if (!photo) return false;
    if (playing.get()) {
      const t = ((now - startedAt) / 1000) % sceneDuration(photo);
      lastT = t;
      shownClip.set(renderFrame(ctx, photo, t));
      return true;
    }
    lastT = null;
    renderStill(ctx, photo, selected.get());
    return false;
  };

  const drawVideo = (now: number): boolean => {
    const scene = videoScene.get();
    if (!scene || scene.layout.shots.length === 0) {
      player.pause();
      return false;
    }
    let t = Math.min(playhead.get(), scene.layout.duration);
    if (playing.get()) {
      t = (playFrom + (now - startedAt) / 1000) % scene.layout.duration;
      playhead.set(t);
    }
    const pos = videoPosition(scene, t);
    player.sync(scene.layout, pos, t, playing.get(), scene.settings.audio);
    const frames = player.frames(pos);
    if (frames) renderVideoFrame(ctx, scene, pos, frames);
    return playing.get() || player.busy() || !frames;
  };

  const draw = (now: number) => {
    raf = 0;
    if (dirty) {
      photo = isVideo() ? null : buildScene();
      size = isVideo() ? videoScene.get() : photo;
      dirty = false;
      fitCanvas();
    }
    if (!size) {
      lastT = null;
      return;
    }
    // Render in output coordinates, scaled down to the preview size.
    const k = canvas.width / size.width;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const again = isVideo() ? drawVideo(now) : drawPhoto(now);
    if (again && !raf) raf = requestAnimationFrame(draw);
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(draw);
  };
  const invalidate = () => {
    dirty = true;
    if (!isVideo()) player.pause();
    schedule();
  };

  effect([settings, images, seed, videoScene], invalidate);
  selected.subscribe(schedule);
  playhead.subscribe(schedule);
  playing.subscribe((on) => {
    if (on) {
      startedAt = performance.now();
      const duration = videoScene.get()?.layout.duration ?? 0;
      playFrom = playhead.get() >= duration - 1 / 30 ? 0 : playhead.get();
      player.allowSound();
    } else {
      player.pause();
    }
    schedule();
  });
  new ResizeObserver(invalidate).observe(root);

  // Empty state lives in the DOM only while there is nothing to show – nothing can shine through later.
  effect([images, videoClips, settings], () => {
    const has = hasContent();
    const mode = settings.get().mode;
    canvas.hidden = !has;
    if (has || emptyMode !== mode) {
      empty?.remove();
      empty = null;
    }
    if (!has && !empty) {
      emptyMode = mode;
      const video = mode === 'video';
      empty = h('div', { class: 'empty' },
        h('button', { class: 'btn btn--pill', type: 'button', onclick: pickFiles }, video ? '+ UPLOAD VIDEO' : '+ UPLOAD IMAGE'),
        h('span', { class: 'empty__hint' }, video ? 'MP4 · MOV · WEBM' : 'PNG · JPG · WEBP'));
      root.append(empty);
    }
  });

  root.addEventListener('dragover', (e) => {
    e.preventDefault();
    root.classList.add('dragover');
  });
  root.addEventListener('dragleave', () => root.classList.remove('dragover'));
  root.addEventListener('drop', (e) => {
    e.preventDefault();
    root.classList.remove('dragover');
    if (e.dataTransfer?.files.length) addFiles([...e.dataTransfer.files]);
  });

  return {
    currentTime: () => lastT,
    async videoStill() {
      const scene = videoScene.get();
      if (!scene) return null;
      const pos = videoPosition(scene, playhead.get());
      const frames = player.frames(pos);
      if (!frames) return null;
      const out = new OffscreenCanvas(scene.width, scene.height);
      const octx = out.getContext('2d');
      if (!octx) return null;
      renderVideoFrame(octx, scene, pos, frames);
      return out.convertToBlob({ type: 'image/png' });
    },
  };
}
```

Hinweis zum Drop im falschen Modus: `addVideoFiles`/`addImageFiles` lehnen fremde Typen bereits mit Toast ab („please use MP4, MOV or WEBM“ bzw. „PNG, JPG or WEBP“) – das erfüllt Spec 3.2.

- [ ] **Step 2: Transport** – `src/ui/transport.ts`: Imports ergänzen (`hasContent`, `markers`, `playhead`, `timelineInput`, `videoClips` aus dem Store, `layout` aus `../engine/videoTimeline`, `formatClock` aus `../util/time`) und den zweiten Effekt ersetzen:

```ts
  const showInfo = () => {
    const s = settings.get();
    if (s.mode === 'video') {
      info.textContent = `${formatClock(playhead.get())} / ${formatClock(layout(timelineInput(s)).duration)}`;
      return;
    }
    const count = images.get().length;
    info.textContent = `${s.loops}× · ${totalDuration({ imageCount: count, loops: s.loops, speed: s.speed }).toFixed(1)} s`;
  };
  effect([settings, images, videoClips, markers], () => {
    const m = motionById(settings.get().motion);
    root.hidden = !hasContent();
    motion.textContent = `${m.icon} ${m.label}`;
    showInfo();
  });
  playhead.subscribe(showInfo);
```

- [ ] **Step 3: Build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/ui/preview.ts src/ui/transport.ts
git commit -m "feat(ui): play video clips with stroke transitions in the preview

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Export – MP4 mit Ton, PNG vom Abspielkopf, Längenlimit

**Files:**
- Modify: `src/export/protocol.ts`, `src/export/video.ts`, `src/export/video.worker.ts`, `src/ui/exportDialog.ts`
- Create: `src/export/projectEncoder.ts`
- Test: `tests/export/video.test.ts`

**Interfaces:**
- Consumes: `VideoProjectScene`, `renderVideoFrame`, `videoPosition` (Task 6); `audioMix` (Task 7); `videoScene` (Task 9); `PreviewApi.videoStill` (Task 13).
- Produces: `interface ClipFile { id; name; file: File; hasAudio: boolean }`; `ToWorker` + `{ type: 'startProject'; scene; clips; fps }`; `FromWorker.done.note?: string`; `exportVideoProject(scene, clips, onProgress): VideoJob`; `VideoJob.note(): string | null`; `VIDEO_MAX_SECONDS = 180`.

- [ ] **Step 1: Write the failing test** – an `tests/export/video.test.ts` im `describe('exportVideo')` anhängen (Import um `exportVideoProject` erweitern, `import type { VideoProjectScene } from '../../src/engine/renderVideo';`):

```ts
  it('starts a project export and passes on the note of a silent result', async () => {
    const job = exportVideoProject({} as VideoProjectScene, [], () => {});
    const w = FakeWorker.instances[0];
    expect(w.posted[0]).toMatchObject({ type: 'startProject', clips: [], fps: 30 });
    w.emit({ type: 'done', buffer: new ArrayBuffer(4), mimeType: 'video/mp4', note: 'Exported without sound' });
    await expect(job.result).resolves.toBeInstanceOf(Blob);
    expect(job.note()).toBe('Exported without sound');
  });
```

(Die bestehenden Tests verwenden `vi.stubGlobal('Worker', FakeWorker)` o. ä. im `beforeEach` – der neue Test nutzt dieselbe Einrichtung.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/export/video.test.ts`
Expected: FAIL (`exportVideoProject` is not exported).

- [ ] **Step 3: Protocol** – `src/export/protocol.ts` komplett:

```ts
import type { Scene } from '../engine/render';
import type { VideoProjectScene } from '../engine/renderVideo';

export interface ClipFile {
  id: string;
  name: string;
  file: File;
  hasAudio: boolean;
}

export type ToWorker =
  | { type: 'start'; scene: Scene; fps: number }
  | { type: 'startProject'; scene: VideoProjectScene; clips: ClipFile[]; fps: number }
  | { type: 'cancel' };

export type FromWorker =
  | { type: 'progress'; value: number }
  | { type: 'done'; buffer: ArrayBuffer; mimeType: string; note?: string }
  | { type: 'cancelled' }
  | { type: 'error'; message: string };
```

- [ ] **Step 4: `src/export/video.ts`** – gemeinsamen Ablauf herausziehen:

```ts
import type { Scene } from '../engine/render';
import type { VideoProjectScene } from '../engine/renderVideo';
import { FPS } from '../engine/timeline';
import type { ClipFile, FromWorker, ToWorker } from './protocol';

/** Longest video-mode export: the MP4 is built in memory. */
export const VIDEO_MAX_SECONDS = 180;

export class ExportCancelled extends Error {
  constructor() {
    super('Export cancelled');
  }
}

export interface VideoJob {
  result: Promise<Blob>;
  cancel(): void;
  /** Once done: why the video differs from what was asked for (e.g. no sound), or null. */
  note(): string | null;
}

export function exportVideo(scene: Scene, onProgress: (value: number) => void): VideoJob {
  return run({ type: 'start', scene, fps: FPS }, onProgress);
}

export function exportVideoProject(scene: VideoProjectScene, clips: ClipFile[], onProgress: (value: number) => void): VideoJob {
  return run({ type: 'startProject', scene, clips, fps: FPS }, onProgress);
}

function run(start: ToWorker, onProgress: (value: number) => void): VideoJob {
  const started = performance.now();
  const worker = new Worker(new URL('./video.worker.ts', import.meta.url), { type: 'module' });
  let resolve!: (blob: Blob) => void;
  let reject!: (err: Error) => void;
  const result = new Promise<Blob>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  let settled = false;
  let note: string | null = null;
  const settle = (fn: () => void) => {
    if (settled) return;
    settled = true;
    worker.terminate();
    fn();
  };

  worker.addEventListener('message', (e: MessageEvent<FromWorker>) => {
    if (settled) return; // late messages after cancel/terminate must not revive the dialog
    const m = e.data;
    if (m.type === 'progress') onProgress(m.value);
    else if (m.type === 'done') {
      console.info(`[strata] video export took ${Math.round(performance.now() - started)} ms`);
      note = m.note ?? null;
      settle(() => resolve(new Blob([m.buffer], { type: m.mimeType })));
    } else if (m.type === 'cancelled') settle(() => reject(new ExportCancelled()));
    else settle(() => reject(new Error(m.message)));
  });
  worker.addEventListener('error', (e) => settle(() => reject(new Error(e.message || 'The video worker crashed.'))));
  worker.postMessage(start);

  return {
    result,
    cancel() {
      worker.postMessage({ type: 'cancel' } satisfies ToWorker);
      // If the worker is stuck inside the encoder, don't wait for it.
      setTimeout(() => settle(() => reject(new ExportCancelled())), 1000);
    },
    note: () => note,
  };
}
```

- [ ] **Step 5: Run the export tests**

Run: `npx vitest run tests/export/video.test.ts`
Expected: PASS (alte und neuer Test).

- [ ] **Step 6: Project encoder** – `src/export/projectEncoder.ts`:

```ts
import {
  ALL_FORMATS, AudioSample, AudioSampleSink, AudioSampleSource, BlobSource, BufferTarget, CanvasSink, CanvasSource, Input,
  Mp4OutputFormat, Output, QUALITY_HIGH, QUALITY_VERY_HIGH, getFirstEncodableAudioCodec, getFirstEncodableVideoCodec,
  type WrappedCanvas,
} from 'mediabunny';
import { renderVideoFrame, videoPosition, type VideoProjectScene } from '../engine/renderVideo';
import { frameCount } from '../engine/timeline';
import type { VideoFramePosition } from '../engine/videoTimeline';
import { MIX_RATE, addInto, createMix, planarSlice, resample, shotGain, toStereo, type Stereo } from './audioMix';
import type { ClipFile, FromWorker } from './protocol';

export interface EncodeHooks {
  post(msg: FromWorker, transfer?: Transferable[]): void;
  isCancelled(): boolean;
  setOutput(output: Output | null): void;
}

export class EncodeCancelled extends Error {}

/** Progress share of decoding and mixing the sound. */
const AUDIO_SHARE = 0.1;
const NO_SOUND_NOTE = "Exported without sound – this browser can't encode audio.";

/** Video mode export: decode every clip frame-exact, draw the stroke phases, mix the sound. */
export async function encodeProject(scene: VideoProjectScene, clips: ClipFile[], fps: number, hooks: EncodeHooks): Promise<void> {
  const { width, height } = scene;
  const lay = scene.layout;
  const codec = await getFirstEncodableVideoCodec(['avc', 'hevc'], { width, height });
  if (!codec) throw new Error("This browser can't encode H.264 or HEVC video.");
  const names = new Map(clips.map((c) => [c.id, c.name]));
  const inputs = new Map(clips.map((c) => [c.id, new Input({ source: new BlobSource(c.file), formats: ALL_FORMATS })]));
  const streams = new Map<string, AsyncGenerator<WrappedCanvas | null, void, unknown>>();
  try {
    const wantSound = scene.settings.audio && clips.some((c) => c.hasAudio);
    const audioCodec = wantSound ? await getFirstEncodableAudioCodec(['aac', 'opus'], { numberOfChannels: 2, sampleRate: MIX_RATE }) : null;
    const note = wantSound && !audioCodec ? NO_SOUND_NOTE : undefined;

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available.');
    const out = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
    hooks.setOutput(out);
    const videoSource = new CanvasSource(canvas, { codec, quality: QUALITY_VERY_HIGH });
    out.addVideoTrack(videoSource, { frameRate: fps });
    const audioSource = audioCodec ? new AudioSampleSource({ codec: audioCodec, quality: QUALITY_HIGH }) : null;
    if (audioSource) out.addAudioTrack(audioSource);
    await out.start();

    const mix = audioSource ? await mixSound(scene, clips, inputs, hooks) : null;
    let audioFrame = 0;
    /** Encodes the mix up to output time `until`, in one-second blocks, so sound and picture stay interleaved. */
    const feedSound = async (until: number) => {
      if (!audioSource || !mix) return;
      const end = Math.min(mix[0].length, Math.ceil(until * MIX_RATE));
      while (audioFrame < end) {
        const to = Math.min(end, audioFrame + MIX_RATE);
        const sample = new AudioSample({
          data: planarSlice(mix, audioFrame, to), format: 'f32-planar', numberOfChannels: 2, sampleRate: MIX_RATE, timestamp: audioFrame / MIX_RATE,
        });
        await audioSource.add(sample);
        sample.close();
        audioFrame = to;
      }
    };

    const total = frameCount(lay.duration, fps);
    const positions: VideoFramePosition[] = Array.from({ length: total }, (_, f) => videoPosition(scene, f / fps));
    // One decoder per clip and role, each fed its timestamps in rising order (decodes every packet once).
    const times = new Map<string, number[]>();
    const push = (key: string, t: number) => {
      const list = times.get(key) ?? [];
      list.push(t);
      times.set(key, list);
    };
    for (const p of positions) {
      push(`${p.shot.clipId}:shot`, p.shot.sourceTime);
      if (p.next) push(`${p.next.clipId}:next`, p.next.sourceTime);
    }
    for (const [key, list] of times) {
      const clipId = key.slice(0, key.lastIndexOf(':'));
      const track = await inputs.get(clipId)?.getPrimaryVideoTrack();
      if (!track) throw new Error(`${names.get(clipId) ?? clipId} has no video track`);
      streams.set(key, new CanvasSink(track, { width, height, fit: scene.fit, poolSize: 2 }).canvasesAtTimestamps(list));
    }
    const last = new Map<string, HTMLCanvasElement | OffscreenCanvas>();
    const blank = new OffscreenCanvas(width, height);
    const nextCanvas = async (key: string) => {
      const stream = streams.get(key);
      if (!stream) throw new Error(`No decoder for ${key}`);
      let r: IteratorResult<WrappedCanvas | null, void>;
      try {
        r = await stream.next();
      } catch (err) {
        const clipId = key.slice(0, key.lastIndexOf(':'));
        throw new Error(`${names.get(clipId) ?? clipId} could not be decoded: ${err instanceof Error ? err.message : String(err)}`);
      }
      // Before a clip's first frame there is none yet: keep the previous picture (or black).
      const canvasOut = r.done || !r.value ? (last.get(key) ?? blank) : r.value.canvas;
      last.set(key, canvasOut);
      return canvasOut;
    };

    const base = audioSource ? AUDIO_SHARE : 0;
    for (let f = 0; f < total; f++) {
      if (hooks.isCancelled()) throw new EncodeCancelled();
      const p = positions[f];
      const shot = await nextCanvas(`${p.shot.clipId}:shot`);
      const next = p.next ? await nextCanvas(`${p.next.clipId}:next`) : null;
      renderVideoFrame(ctx, scene, p, { shot, next });
      await feedSound((f + 1) / fps + 1);
      await videoSource.add(f / fps, 1 / fps); // awaiting respects encoder backpressure
      if (f % 10 === 0) hooks.post({ type: 'progress', value: base + (1 - base) * (f / total) });
    }
    await feedSound(Infinity);
    await out.finalize();
    hooks.setOutput(null);
    const buffer = out.target.buffer;
    if (!buffer) throw new Error('The encoder returned no data.');
    hooks.post({ type: 'progress', value: 1 });
    hooks.post({ type: 'done', buffer, mimeType: 'video/mp4', note }, [buffer]);
  } finally {
    for (const s of streams.values()) void s.return(undefined);
    for (const input of inputs.values()) input.dispose();
  }
}

/** Decodes each shot's sound and lays it into one 48 kHz stereo mix at its output time. */
async function mixSound(scene: VideoProjectScene, clips: ClipFile[], inputs: Map<string, Input>, hooks: EncodeHooks): Promise<Stereo> {
  const lay = scene.layout;
  const mix = createMix(lay.duration);
  const withSound = new Set(clips.filter((c) => c.hasAudio).map((c) => c.id));
  for (const [i, shot] of lay.shots.entries()) {
    if (!withSound.has(shot.clipId)) continue;
    const track = await inputs.get(shot.clipId)?.getPrimaryAudioTrack();
    if (!track) continue;
    for await (const sample of new AudioSampleSink(track).samples(shot.sourceStart, shot.sourceEnd)) {
      if (hooks.isCancelled()) {
        sample.close();
        throw new EncodeCancelled();
      }
      const planes: Float32Array[] = [];
      for (let ch = 0; ch < sample.numberOfChannels; ch++) {
        const plane = new Float32Array(sample.numberOfFrames);
        sample.copyTo(plane, { planeIndex: ch, format: 'f32-planar' });
        planes.push(resample(plane, sample.sampleRate, MIX_RATE));
      }
      addInto(mix, toStereo(planes), shot.start + (sample.timestamp - shot.sourceStart), (t) => shotGain(lay, i, t));
      sample.close();
    }
    hooks.post({ type: 'progress', value: (AUDIO_SHARE * (i + 1)) / lay.shots.length });
  }
  return mix;
}
```

- [ ] **Step 7: Worker dispatch** – `src/export/video.worker.ts`, Nachrichten-Handler ersetzen (Import `import { encodeProject } from './projectEncoder';`):

```ts
self.addEventListener('message', (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  if (msg.type === 'cancel') {
    cancelled = true;
    void output?.cancel();
    return;
  }
  cancelled = false;
  const job = msg.type === 'start'
    ? encode(msg.scene, msg.fps)
    : encodeProject(msg.scene, msg.clips, msg.fps, {
      post,
      isCancelled: () => cancelled,
      setOutput: (o) => { output = o; },
    });
  job.catch((err: unknown) => {
    if (cancelled) post({ type: 'cancelled' });
    else post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  });
});
```

- [ ] **Step 8: Export dialog** – `src/ui/exportDialog.ts` anpassen:

Imports: `exportVideoProject`, `VIDEO_MAX_SECONDS` aus `../export/video`; `hasContent`, `playhead`, `videoClips` aus dem Store; `videoScene` aus `../video/scene`.

`Phase` `'done'` um `note: string | null` erweitern: `| { name: 'done'; file: File; shared: boolean; note: string | null }`.

Hilfsfunktionen im Dialog:

```ts
  const isVideoMode = () => settings.get().mode === 'video';
  const tooLong = () => isVideoMode() && (videoScene.get()?.layout.duration ?? 0) > VIDEO_MAX_SECONDS;
```

`info()` am Anfang:

```ts
  function info(): string {
    if (isVideoMode()) {
      const scene = videoScene.get();
      if (!scene) return '';
      const size = `${scene.width} × ${scene.height}`;
      if (kind === 'png') return `${size} · PNG · FRAME AT ${playhead.get().toFixed(1)} s`;
      const d = scene.layout.duration;
      return `${size} · ${d.toFixed(1)} s · ${frameCount(d, FPS)} frames${scene.settings.audio ? ' · SOUND' : ''}`;
    }
    // … bisheriger Foto-Zweig unverändert …
  }
```

Im `render()`: EXPORT-Knopf im `idle`-Fall `disabled: kind === 'video' && (videoSupported !== true || tooLong())`; unter `info()` zusätzlich `kind === 'video' && tooLong() ? h('p', { class: 'export__notice' }, 'Too long to export in the browser (max 3 min).') : ''`; im `done`-Fall vor den Knöpfen `phase.note ? h('p', { class: 'export__notice' }, phase.note) : null` einfügen (in beiden Zweigen `actions.append(...)`).

`deliver(file, note: string | null = null)` setzt `phase = { name: 'done', file, shared, note };`.

`start()` am Anfang um den Video-Zweig ergänzen:

```ts
  async function start(): Promise<void> {
    if (isVideoMode()) return startVideoMode();
    // … bisheriger Foto-Ablauf unverändert …
  }

  async function startVideoMode(): Promise<void> {
    const scene = videoScene.get();
    if (!scene) return;
    if (kind === 'png') {
      try {
        const blob = await preview.videoStill();
        if (!blob) throw new Error('The frame is not ready yet – try again in a moment.');
        deliver(new File([blob], exportFileName(scene.settings.format, 'png'), { type: 'image/png' }));
      } catch (err) {
        phase = { name: 'error', message: messageOf(err) };
        render();
      }
      return;
    }
    playing.set(false);
    exporting.set(true);
    phase = { name: 'running', progress: 0 };
    render();
    try {
      const clips = videoClips.get().map((c) => ({ id: c.id, name: c.name, file: c.file, hasAudio: c.hasAudio }));
      const current = exportVideoProject(scene, clips, setProgress);
      job = current;
      const blob = await current.result;
      deliver(new File([blob], exportFileName(scene.settings.format, 'mp4'), { type: 'video/mp4' }), current.note());
    } catch (err) {
      phase = err instanceof ExportCancelled ? { name: 'idle' } : { name: 'error', message: messageOf(err) };
      render();
    } finally {
      job = null;
      exporting.set(false);
    }
  }
```

`open()`: `if (!hasContent() || dialog.open) return;` (aus Task 11 schon so).

- [ ] **Step 9: Run tests and build**

Run: `npm test && npm run build`
Expected: PASS, Build ohne Fehler.

- [ ] **Step 10: Commit**

```bash
git add src/export src/ui/exportDialog.ts tests/export/video.test.ts
git commit -m "feat(export): MP4 with sound for video mode, PNG of the playhead frame, 3 min limit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Testvideos und Prüfung im Browser

**Files:**
- Create: `src/dev/testVideos.ts`
- Modify: `src/main.ts` (DEV-Block), `.gitignore`

**Interfaces:**
- Consumes: `addVideoFiles` (Task 9).
- Produces: `window.__strata.loadTestVideos(names: string[])` (nur DEV).

- [ ] **Step 1: Fixtures with ffmpeg** (nicht eingecheckt) – `.gitignore` um `dev-fixtures/` ergänzen, dann:

```bash
mkdir -p dev-fixtures
ffmpeg -y -f lavfi -i testsrc2=size=1080x1920:rate=30:duration=4 -f lavfi -i sine=frequency=440:duration=4 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest dev-fixtures/a.mp4
ffmpeg -y -f lavfi -i smptebars=size=1080x1920:rate=30:duration=3 -f lavfi -i sine=frequency=660:duration=3 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest dev-fixtures/b.mp4
ffmpeg -y -f lavfi -i color=c=0x78232d:size=1080x1920:rate=30:duration=3 -c:v libx264 -pix_fmt yuv420p dev-fixtures/silent.mp4
ffmpeg -y -f lavfi -i "color=c=red:size=1920x1080:rate=30:duration=3,drawbox=x=960:y=0:w=960:h=1080:color=blue:t=fill" -c:v libx264 -pix_fmt yuv420p dev-fixtures/landscape.mp4
ffmpeg -y -display_rotation 90 -i dev-fixtures/landscape.mp4 -c copy dev-fixtures/rotated.mov
ffmpeg -y -f lavfi -i testsrc2=size=1080x1920:rate=30:duration=0.5 -c:v libx264 -pix_fmt yuv420p dev-fixtures/short.mp4
```

Prüfen: `ffprobe -v error -show_entries stream_side_data=rotation -of csv=p=0 dev-fixtures/rotated.mov` gibt `-90` oder `90` aus.

- [ ] **Step 2: Dev loader** – `src/dev/testVideos.ts`:

```ts
import { addVideoFiles } from '../video/clipImport';

/** DEV only: loads clips from dev-fixtures/ (made with ffmpeg, see the video-mode plan). */
export async function loadTestVideos(names: string[]): Promise<void> {
  const files = await Promise.all(names.map(async (name) => {
    const res = await fetch(`/dev-fixtures/${name}`);
    if (!res.ok) throw new Error(`${name}: ${res.status}`);
    const blob = await res.blob();
    return new File([blob], name, { type: blob.type || (name.endsWith('.mov') ? 'video/quicktime' : 'video/mp4') });
  }));
  await addVideoFiles(files);
}
```

In `src/main.ts` im DEV-Block `loadTestVideos` importieren und in `__strata` aufnehmen.

- [ ] **Step 3: Start the preview and load clips**

`preview_start` mit `{ name: "strata" }`. Per `javascript_tool`:

```js
window.__strata.patchSettings({ mode: 'video', format: '9:16' });
await window.__strata.loadTestVideos(['a.mp4', 'b.mp4', 'silent.mp4']);
```

`read_console_messages` (nur Fehler) muss leer sein; `read_page` zeigt Zeitleiste mit drei Clips, zwei gefüllten Rauten, Transport „0:00 / 0:10“ (4 + 3 + 3 s).

- [ ] **Step 4: Check the transitions in the preview**

- `+ MARKER` klicken, nachdem per `javascript_tool` `window.__strata` … bzw. per Klick auf die Zeitleiste bei ca. 2 s gesprungen wurde → leere Raute erscheint; Screenshot.
- Abspielen (▶), nach ~3,9 s Screenshot: Strokes decken das Bild nahezu voll. Pause, Screenshot an einem Punkt ohne Phase: pures Video, keine Strokes.
- IMG MASK an → in einer Überlappung zeigen die Balken den nächsten Clip (Screenshot).
- DURATION auf 1,5 s → Hinweis „MAX … · SHORT SHOT AT …“ erscheint, sobald ein Shot zu kurz ist (`short.mp4` zusätzlich laden).

- [ ] **Step 5: Export and verify the MP4 in the page**

Export-Dialog öffnen, VIDEO (MP4) exportieren. Danach per `javascript_tool` die erzeugte Datei prüfen – dafür den Blob abfangen, indem vor dem Export `URL.createObjectURL` gewrappt wird:

```js
window.__lastBlob = null;
const orig = URL.createObjectURL;
URL.createObjectURL = (b) => { if (b instanceof Blob && b.type === 'video/mp4') window.__lastBlob = b; return orig(b); };
```

Nach dem Export:

```js
const { Input, BlobSource, ALL_FORMATS, CanvasSink } = await import('/node_modules/.vite/deps/mediabunny.js');
const input = new Input({ source: new BlobSource(window.__lastBlob), formats: ALL_FORMATS });
const v = await input.getPrimaryVideoTrack();
const a = await input.getPrimaryAudioTrack();
const duration = await input.computeDuration();
const sink = new CanvasSink(v, { width: 108, height: 192 });
const atCut = (await sink.getCanvas(4)).canvas; // Schnitt a → b bei 4,0 s
const px = atCut.getContext('2d').getImageData(54, 96, 1, 1).data;
({ duration, hasAudio: !!a, codec: v.codec, centerPixelAtCut: [...px] });
```

Expected: `duration` ≈ 10 (± 1 Frame), `hasAudio: true`, Mittelpixel am Schnitt ≈ Strokefarbe (Standard `#FFFFFF`, also ~255/255/255). Falls der Import-Pfad von Mediabunny im Dev-Server anders heißt, über `read_network_requests` (Filter `mediabunny`) den richtigen Pfad ablesen.

Gegenprobe ohne Ton: SOUND aus → exportieren → `hasAudio: false`. Nur `silent.mp4` laden, SOUND an → Export klappt, `hasAudio: false`.

- [ ] **Step 6: Review Focus checks in the browser**

1. **Rotation:** Projekt leeren, nur `rotated.mov` laden. Vorschau-Screenshot: Hochformat, rote und blaue Hälfte übereinander (nicht nebeneinander). Exportieren und mit dem Snippet aus Step 5 die Pixel oben (54, 20) und unten (54, 170) lesen; dieselben zwei Pixel aus dem Vorschau-Canvas (`document.getElementById('previewCanvas')`, auf dieselben relativen Positionen umgerechnet) lesen → gleiche Farbe oben und unten in beiden.
2. **Kurzer Clip:** `a.mp4`, `short.mp4`, `b.mp4` laden, abspielen und exportieren → keine Konsolenfehler, Export-Dauer ≈ 7,5 s.
3. **Ohne Ton gemischt:** siehe Step 5.
4. **Clip entfernen während der Wiedergabe:** abspielen, Clip auswählen, × → kein Fehler in der Konsole, Vorschau zeigt die übrigen Clips; sofort danach einen neuen Clip laden und während des Ladens einen anderen entfernen → kein Fehler, Zeitleiste konsistent.
5. **Marker ziehen:** einen Marker auf einen anderen ziehen → er rastet ≥ 2 · D daneben ein; an den Clip-Rand ziehen → bleibt ≥ D vom Rand.

- [ ] **Step 7: Mobile layout and photo mode**

`resize_window` mit `preset: "mobile"`, neu laden, Video-Modus mit Clips: Topbar zeigt STRATA, PHOTO|VIDEO, EXPORT; Vorschau, Transport, Zeitleiste, Panel und Toolbar sichtbar ohne vertikales Scrollen (`javascript_tool`: `document.scrollingElement.scrollHeight <= innerHeight`). Zurück in PHOTO: `loadTestImage()`, abspielen, PNG und MP4 exportieren wie vorher. Danach `resize_window` mit `preset: "desktop"`.

- [ ] **Step 8: Full test suite and build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/dev/testVideos.ts src/main.ts .gitignore
git commit -m "chore(dev): load ffmpeg test clips for checking video mode in the browser

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 10: Hand over to the user for Safari / iPhone**

Dem Nutzer die offenen manuellen Prüfungen nennen (nicht automatisierbar): Safari am Mac und iPhone – echtes Hochkant-HEVC vom iPhone importieren, abspielen (Ton nach ▶), Marker setzen, MP4 exportieren, „Video sichern“.
