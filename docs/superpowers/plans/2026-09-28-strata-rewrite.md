# Strata Rewrite – Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strata wird als Vite-+-TypeScript-App neu aufgebaut: eine deterministische Render-Engine, MP4-Export per Mediabunny in einem Web Worker und ein Mobile-Layout im CapCut-Stil mit 9:16 als Standardformat.

**Architecture:** Die reine TS-Engine (`src/engine/`) berechnet jeden Frame aus Einstellungen, Bildern, Seed und Zeit *t*. Vorschau (Main-Thread), PNG-Export und Video-Worker rufen dieselbe `renderFrame`-Funktion auf. Die UI (`src/ui/`) ist framework-frei und bindet DOM-Elemente über einen minimalen Signal-Store (`src/state/`). Desktop-Sidebar und Mobile-Werkzeugleiste entstehen aus derselben Werkzeugliste.

**Tech Stack:** Vite (aktuell 8.x), TypeScript (aktuell 7.x, strict), Vitest (aktuell 5.x), Mediabunny ^1.60.0, GitHub Actions + GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-28-strata-rewrite-design.md`. Vor jedem Task lesen, der Plan argumentiert aus ihr.

## Global Constraints

- Runtime-Dependency: nur `mediabunny` (^1.60.0). Kein UI-Framework. Dev-Dependencies: `vite`, `typescript`, `vitest`.
- TypeScript `strict`. `src/engine/` greift nie auf `document` oder `window` zu. `OffscreenCanvas` ist erlaubt, weil der Code auch im Worker läuft.
- Vite `base` ist `'/picture-tool-motion/'`, aber **nur** für `vite build`. Der Dev-Server läuft auf `/`.
- UI-Sprache Englisch, Labels in Großbuchstaben. Exakte Texte: `EXPORT`, `+ UPLOAD IMAGE`, `PNG · JPG · WEBP`, `FORMAT`, `VIDEO (MP4)`, `IMAGE (PNG)`, `SAVE / SHARE`, `CANCEL`, `Your browser can't create videos. Please use a current version of Chrome, Safari or Firefox.`
- Formate: `9:16` ▯ 1080 × 1920 (Default) · `4:5` ▯ 1080 × 1350 · `16:9` ▭ 1920 × 1080 · `original` □ ORIGINAL = Größe des ersten Clips, längste Kante ≤ 2000 px, beide Maße gerade.
- Defaults: size 80 (25–100), stretch 0 (0–100), threshold 35 (0–100), removeFront false, sensitivity 50 (10–100), color `#FFFFFF`, imgMask false, motion `buildUp`, speed 1.0 (0.5–10, Schritt 0.5), loops 2 (1–10), format `9:16`.
- Zyklus = 6 s ÷ speed. Videolänge = loops × Bilder × Zyklus. Export mit fest 30 fps.
- localStorage-Schlüssel `strata:v2`. Alte Schlüssel werden ignoriert.
- Mobile-Breakpoint: `(width <= 768px)`. Mobil nutzt `100dvh` und `env(safe-area-inset-*)`, die Seite scrollt nie vertikal.
- Kein `alert()`. Hinweise laufen über `toast()`.
- Browser-Untergrenze (abgeleitet aus Popover-API, WebCodecs, CSS Nesting): Chrome/Edge 120+, Safari 17.2+, Firefox 125+.

## Review Focus

1. **Riesige Handyfotos** (z.B. 6000 × 4000 px): Original wird auf 2000 px gedeckelt, feste Formate bleiben bei ihren Maßen, nichts friert ein. Abgedeckt durch einen Test in Task 2 und einen Browser-Check in Task 12.
2. **Clips entfernen, während die Vorschau läuft**, bis alle weg sind: Die Wiedergabe stoppt, der Leerzustand kommt zurück, es gibt keinen Fehler durch ein geschlossenes `ImageBitmap`, und IMG MASK geht unter 2 Bildern aus. Abgedeckt durch einen Test in Task 7 und einen Browser-Check in Task 10.
3. **Kaputte oder alte Einstellungen im localStorage** (z.B. `{"format":"21:9","speed":"fast"}` oder ungültiges JSON): Es gelten die Defaults, kein Absturz. Abgedeckt durch einen Test in Task 6.
4. **Export abbrechen und direkt neu exportieren:** Die zweite Datei ist korrekt, die UI ist nicht mehr gesperrt, und es läuft kein alter Worker weiter. Abgedeckt durch einen Browser-Check in Task 8.
5. **Degenerierte Bilder** (einfarbig, 1 × 1 px, transparent): kein Absturz und kein NaN. BACK liefert keine Balken, FRONT liefert alle. Abgedeckt durch einen Test in Task 3.

---

## Dateistruktur (Ziel)

```
index.html                      App-Shell (statisches Markup)
vite.config.ts                  base nur für Build, Worker als ES-Modul, Vitest-Config
tsconfig.json
package.json
public/favicon.svg
src/
  main.ts                       Verdrahtung aller Module
  engine/
    types.ts                    Settings, Bar, Size, Fit, FormatId, MotionId, Ctx2D
    rng.ts                      hashSeed, mulberry32, rngFor, shuffled, randomSeed
    timeline.ts                 cycleDuration, totalDuration, frameCount, positionAt, FPS
    formats.ts                  FORMATS, outputSize, fitFor, pixelLabel
    analyze.ts                  barGrid, gridBars, maskSize, buildForegroundMask, selectStrokeBars
    draw.ts                     drawFitted, fillBars, clipDraw, barNoise, clamp01
    motions/types.ts            Motion, FrameInput
    motions/{buildUp,fade,reveal,impulse,wave,glitch}.ts
    motions/index.ts            MOTIONS, motionById
    render.ts                   Scene, ImageLayer, renderFrame, renderStill, sceneDuration
    raster.ts                   rasterize (OffscreenCanvas → Pixeldaten)
    analysisCache.ts            AnalysisCache (gestufter Cache pro Bild)
  state/
    signal.ts                   signal, effect
    settings.ts                 DEFAULT_SETTINGS, RANGES, parseSettings, load/saveSettings
    store.ts                    App-Signale, patchSettings, resetSettings
  util/
    color.ts                    normalizeHex, hslToHex, pickFromWheel
    array.ts                    moveItem
  export/
    protocol.ts                 Worker-Nachrichten
    video.worker.ts             Mediabunny-Encoding
    video.ts                    exportVideo, ExportCancelled
    image.ts                    exportPng
    save.ts                     exportFileName, canShare, shareFile, downloadFile
    capability.ts               videoExportSupported
  ui/
    dom.ts                      h()-Helfer
    toast.ts
    scene.ts                    buildScene, forgetImage
    images.ts                   addImageFiles, removeImage, moveImage
    preview.ts                  Vorschau + Leerzustand + Drag & Drop
    popover.ts                  anchorPopover
    dropdown.ts
    colorWheel.ts
    controls.ts                 alle Werkzeug-Steuerungen
    tools.ts                    TOOLS, GROUP_LABELS
    sidebar.ts                  Desktop
    toolbar.ts                  Mobile-Leiste + Panel
    transport.ts
    clips.ts
    exportDialog.ts
  styles/tokens.css, layout.css, components.css
tests/…                         Vitest (nur Engine, State, Utils, images)
.github/workflows/deploy.yml
```

---

### Task 1: Projekt-Setup (Vite + TypeScript + Vitest)

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `.gitignore`, `src/main.ts`
- Replace: `index.html` (die alte Version bleibt im Commit `c0813cc` erhalten)
- Move: `favicon.svg` → `public/favicon.svg`
- Modify (lokal, nicht versioniert): `.claude/launch.json`

**Interfaces:**
- Consumes: –
- Produces: `npm run dev` (Port 5173), `npm test`, `npm run build`. Launch-Konfiguration `strata` für `preview_start`.

- [ ] **Step 1: Branch anlegen**

Falls `superpowers:using-git-worktrees` nicht schon einen Branch oder Worktree angelegt hat:

```bash
git switch -c rewrite/vite-ts
```

- [ ] **Step 2: `package.json` anlegen**

```json
{
  "name": "strata",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Abhängigkeiten installieren**

```bash
npm install mediabunny@^1.60.0
npm install -D vite typescript vitest
npx tsc --version
```

Erwartet: `Version 7.x` (oder neuer). Falls `npx tsc` nicht existiert oder die `tsconfig.json` aus Step 5 wegen einer entfernten Option abgelehnt wird, `npm install -D typescript@^6` ausführen und die Abweichung im Commit notieren.

- [ ] **Step 4: `vite.config.ts` anlegen**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig(({ command }) => ({
  // GitHub Pages serves the repo under /picture-tool-motion/; the dev server stays on /.
  base: command === 'build' ? '/picture-tool-motion/' : '/',
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
  },
}));
```

- [ ] **Step 5: `tsconfig.json` anlegen**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

- [ ] **Step 6: `.gitignore` anlegen**

```
node_modules/
dist/
.DS_Store
.superpowers/
```

- [ ] **Step 7: Favicon verschieben, minimale `index.html` und `src/main.ts`**

```bash
mkdir -p public src && git mv favicon.svg public/favicon.svg
```

`index.html` komplett ersetzen:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#141414">
  <title>Strata</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
</head>
<body>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

`src/main.ts`:

```ts
console.info('Strata booting');
```

- [ ] **Step 8: Launch-Konfiguration umstellen** (`.claude/launch.json`, ist nicht versioniert)

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "strata",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev", "--", "--port", "5173", "--strictPort"],
      "port": 5173
    }
  ]
}
```

- [ ] **Step 9: Prüfen**

```bash
npm test && npm run build
```

Erwartet: Vitest meldet „No test files found“ und beendet mit Exit 0. Der Build erzeugt `dist/index.html` mit `/picture-tool-motion/`-Pfaden (`grep picture-tool-motion dist/index.html` findet einen Treffer).

Danach `preview_start` mit `{ name: "strata" }` aufrufen, dann `read_console_messages`. Erwartet: `Strata booting`.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json .gitignore index.html public/favicon.svg src/main.ts
git commit -m "chore: scaffold Vite + TypeScript + Vitest"
```

---

### Task 2: Engine-Grundlagen – Typen, Zufall, Zeitmodell, Formate

**Files:**
- Create: `src/engine/types.ts`, `src/engine/rng.ts`, `src/engine/timeline.ts`, `src/engine/formats.ts`
- Test: `tests/engine/rng.test.ts`, `tests/engine/timeline.test.ts`, `tests/engine/formats.test.ts`

**Interfaces:**
- Consumes: –
- Produces:
  - `types.ts`: `Ctx2D`, `Fit = 'cover' | 'contain'`, `FORMAT_IDS`, `FormatId`, `MOTION_IDS`, `MotionId`, `Size {width,height}`, `Bar {x,y,width,height}`, `Settings`
  - `rng.ts`: `hashSeed(...parts: number[]): number`, `mulberry32(seed): () => number`, `rngFor(...parts): () => number`, `shuffled<T>(items: readonly T[], rng): T[]`, `randomSeed(): number`
  - `timeline.ts`: `BASE_CYCLE_SECONDS = 6`, `FPS = 30`, `TimelineInput {imageCount, loops, speed}`, `FramePosition {cycle, imageIndex, nextImageIndex, progress, frameIndex}`, `cycleDuration(speed)`, `totalDuration(input)`, `frameCount(duration, fps = FPS)`, `positionAt(t, input)`
  - `formats.ts`: `FormatDef {id, icon, label, size: Size | null}`, `FORMATS`, `ORIGINAL_MAX_EDGE = 2000`, `formatDef(id)`, `outputSize(id, firstImage: Size | null): Size | null`, `fitFor(id): Fit`, `pixelLabel(size: Size | null): string`

- [ ] **Step 1: `src/engine/types.ts` schreiben** (enthält keine Logik, deshalb kein eigener Test)

```ts
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** How an image is placed in the output frame: cropped to fill, or letterboxed. */
export type Fit = 'cover' | 'contain';

export const FORMAT_IDS = ['9:16', '4:5', '16:9', 'original'] as const;
export type FormatId = (typeof FORMAT_IDS)[number];

export const MOTION_IDS = ['buildUp', 'impulse', 'wave', 'fade', 'glitch', 'reveal'] as const;
export type MotionId = (typeof MOTION_IDS)[number];

export interface Size {
  width: number;
  height: number;
}

/** One stroke cell of the bar grid, in output pixels. */
export interface Bar {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Settings {
  size: number;
  stretch: number;
  threshold: number;
  removeFront: boolean;
  sensitivity: number;
  color: string;
  imgMask: boolean;
  motion: MotionId;
  speed: number;
  loops: number;
  format: FormatId;
}
```

- [ ] **Step 2: Failing Tests schreiben**

`tests/engine/rng.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hashSeed, mulberry32, rngFor, shuffled } from '../../src/engine/rng';

const take = (rng: () => number, n: number) => Array.from({ length: n }, rng);

describe('mulberry32', () => {
  it('repeats the same sequence for the same seed', () => {
    expect(take(mulberry32(42), 5)).toEqual(take(mulberry32(42), 5));
  });
  it('differs for different seeds', () => {
    expect(take(mulberry32(1), 5)).not.toEqual(take(mulberry32(2), 5));
  });
  it('stays in [0, 1)', () => {
    for (const v of take(mulberry32(7), 1000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('hashSeed / rngFor', () => {
  it('is order-sensitive', () => {
    expect(hashSeed(1, 2)).not.toBe(hashSeed(2, 1));
  });
  it('rngFor is deterministic per argument list', () => {
    expect(take(rngFor(9, 3, 1), 3)).toEqual(take(rngFor(9, 3, 1), 3));
    expect(take(rngFor(9, 3, 1), 3)).not.toEqual(take(rngFor(9, 4, 1), 3));
  });
});

describe('shuffled', () => {
  const items = Array.from({ length: 50 }, (_, i) => i);
  it('returns a permutation without touching the input', () => {
    const out = shuffled(items, mulberry32(5));
    expect([...out].sort((a, b) => a - b)).toEqual(items);
    expect(items[0]).toBe(0);
    expect(out).not.toEqual(items);
  });
  it('is deterministic for the same rng seed', () => {
    expect(shuffled(items, mulberry32(5))).toEqual(shuffled(items, mulberry32(5)));
  });
});
```

`tests/engine/timeline.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cycleDuration, frameCount, positionAt, totalDuration } from '../../src/engine/timeline';

describe('durations', () => {
  it('cycle is 6 s divided by speed', () => {
    expect(cycleDuration(1)).toBe(6);
    expect(cycleDuration(2)).toBe(3);
  });
  it('total = loops × images × cycle', () => {
    expect(totalDuration({ imageCount: 1, loops: 2, speed: 1 })).toBe(12);
    expect(totalDuration({ imageCount: 3, loops: 2, speed: 1 })).toBe(36);
    expect(totalDuration({ imageCount: 1, loops: 3, speed: 2 })).toBe(9);
    expect(totalDuration({ imageCount: 1, loops: 1, speed: 10 })).toBeCloseTo(0.6);
    expect(totalDuration({ imageCount: 0, loops: 2, speed: 1 })).toBe(0);
  });
  it('frameCount rounds up to whole frames at 30 fps', () => {
    expect(frameCount(12)).toBe(360);
    expect(frameCount(totalDuration({ imageCount: 1, loops: 1, speed: 10 }))).toBe(18);
    expect(frameCount(1.01)).toBe(31);
  });
});

describe('positionAt', () => {
  const three = { imageCount: 3, loops: 2, speed: 1 };
  it('starts at the first clip', () => {
    expect(positionAt(0, three)).toEqual({ cycle: 0, imageIndex: 0, nextImageIndex: 1, progress: 0, frameIndex: 0 });
  });
  it('walks through the clips cycle by cycle and wraps', () => {
    const p = positionAt(13, three);
    expect(p.cycle).toBe(2);
    expect(p.imageIndex).toBe(2);
    expect(p.nextImageIndex).toBe(0);
    expect(p.progress).toBeCloseTo(1 / 6);
    expect(positionAt(18.5, three).imageIndex).toBe(0);
  });
  it('hits exact cycle boundaries on 30 fps frame times', () => {
    const p = positionAt(180 / 30, three);
    expect(p.cycle).toBe(1);
    expect(p.progress).toBe(0);
    expect(positionAt(5 / 30, three).frameIndex).toBe(5);
  });
  it('clamps t to the last frame instead of overflowing', () => {
    const p = positionAt(999, three);
    expect(p.cycle).toBe(5);
    expect(p.progress).toBeLessThan(1);
  });
  it('treats zero images like one', () => {
    expect(positionAt(1, { imageCount: 0, loops: 1, speed: 1 }).imageIndex).toBe(0);
  });
});
```

`tests/engine/formats.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FORMATS, fitFor, outputSize, pixelLabel } from '../../src/engine/formats';

describe('outputSize', () => {
  it('uses fixed sizes for the social formats', () => {
    expect(outputSize('9:16', null)).toEqual({ width: 1080, height: 1920 });
    expect(outputSize('4:5', null)).toEqual({ width: 1080, height: 1350 });
    expect(outputSize('16:9', null)).toEqual({ width: 1920, height: 1080 });
  });
  it('original follows the first clip, capped at 2000 px and even', () => {
    expect(outputSize('original', { width: 3024, height: 4032 })).toEqual({ width: 1500, height: 2000 });
    expect(outputSize('original', { width: 1001, height: 777 })).toEqual({ width: 1000, height: 776 });
    expect(outputSize('original', { width: 6000, height: 4000 })).toEqual({ width: 2000, height: 1332 });
    expect(outputSize('original', { width: 1, height: 1 })).toEqual({ width: 2, height: 2 });
  });
  it('original without an image has no size', () => {
    expect(outputSize('original', null)).toBeNull();
  });
});

describe('format metadata', () => {
  it('lists 9:16 first and ORIGINAL last', () => {
    expect(FORMATS.map((f) => f.label)).toEqual(['9:16', '4:5', '16:9', 'ORIGINAL']);
    expect(FORMATS.map((f) => f.icon)).toEqual(['▯', '▯', '▭', '□']);
  });
  it('crops fixed formats and letterboxes original', () => {
    expect(fitFor('9:16')).toBe('cover');
    expect(fitFor('original')).toBe('contain');
  });
  it('formats pixel labels', () => {
    expect(pixelLabel({ width: 1080, height: 1920 })).toBe('1080 × 1920');
    expect(pixelLabel(null)).toBe('—');
  });
});
```

- [ ] **Step 3: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npm test`
Expected: FAIL (`Failed to resolve import "../../src/engine/rng"` usw.)

- [ ] **Step 4: `src/engine/rng.ts` implementieren**

```ts
/** Mixes integers into one 32-bit seed. Order matters: (1, 2) ≠ (2, 1). */
export function hashSeed(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    h = Math.imul(h ^ (p | 0), 0x01000193);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
  }
  return h >>> 0;
}

/** mulberry32: small, fast seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngFor(...parts: number[]): () => number {
  return mulberry32(hashSeed(...parts));
}

/** Fisher–Yates on a copy. */
export function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function randomSeed(): number {
  return (Math.random() * 0x100000000) >>> 0;
}
```

- [ ] **Step 5: `src/engine/timeline.ts` implementieren**

```ts
export const BASE_CYCLE_SECONDS = 6;
export const FPS = 30;

export interface TimelineInput {
  imageCount: number;
  loops: number;
  speed: number;
}

export interface FramePosition {
  cycle: number;
  imageIndex: number;
  nextImageIndex: number;
  /** 0 ≤ progress < 1 within the current cycle. */
  progress: number;
  /** t quantised to the 30 fps export grid; drives per-frame randomness. */
  frameIndex: number;
}

export function cycleDuration(speed: number): number {
  return BASE_CYCLE_SECONDS / speed;
}

export function totalDuration({ imageCount, loops, speed }: TimelineInput): number {
  return Math.max(0, imageCount) * loops * cycleDuration(speed);
}

export function frameCount(duration: number, fps = FPS): number {
  return Math.ceil(duration * fps - 1e-9);
}

export function positionAt(t: number, input: TimelineInput): FramePosition {
  const n = Math.max(1, input.imageCount);
  const cd = cycleDuration(input.speed);
  const total = totalDuration({ ...input, imageCount: n });
  // Clamp just inside the last frame; the tiny +1e-9 keeps exact frame times (f / 30) on the right cycle.
  const tt = Math.min(Math.max(0, t), Math.max(0, total - 1e-6));
  const cycle = Math.floor(tt / cd + 1e-9);
  const imageIndex = cycle % n;
  return {
    cycle,
    imageIndex,
    nextImageIndex: (imageIndex + 1) % n,
    progress: Math.max(0, (tt - cycle * cd) / cd),
    frameIndex: Math.floor(tt * FPS + 1e-6),
  };
}
```

- [ ] **Step 6: `src/engine/formats.ts` implementieren**

```ts
import type { Fit, FormatId, Size } from './types';

export interface FormatDef {
  id: FormatId;
  icon: string;
  label: string;
  /** null = derived from the first clip (ORIGINAL). */
  size: Size | null;
}

export const FORMATS: readonly FormatDef[] = [
  { id: '9:16', icon: '▯', label: '9:16', size: { width: 1080, height: 1920 } },
  { id: '4:5', icon: '▯', label: '4:5', size: { width: 1080, height: 1350 } },
  { id: '16:9', icon: '▭', label: '16:9', size: { width: 1920, height: 1080 } },
  { id: 'original', icon: '□', label: 'ORIGINAL', size: null },
];

export const ORIGINAL_MAX_EDGE = 2000;

export function formatDef(id: FormatId): FormatDef {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}

export function outputSize(id: FormatId, firstImage: Size | null): Size | null {
  const def = formatDef(id);
  if (def.size) return def.size;
  if (!firstImage) return null;
  const maxEdge = Math.max(firstImage.width, firstImage.height);
  // Integer maths (v × 2000 / maxEdge) avoids 3024 → 1499.999… rounding; H.264 needs even dimensions.
  const scaled = (v: number) => (maxEdge > ORIGINAL_MAX_EDGE ? Math.floor((v * ORIGINAL_MAX_EDGE) / maxEdge) : Math.floor(v));
  const even = (v: number) => Math.max(2, scaled(v) & ~1);
  return { width: even(firstImage.width), height: even(firstImage.height) };
}

export function fitFor(id: FormatId): Fit {
  return id === 'original' ? 'contain' : 'cover';
}

export function pixelLabel(size: Size | null): string {
  return size ? `${size.width} × ${size.height}` : '—';
}
```

- [ ] **Step 7: Tests laufen lassen, sie müssen grün sein**

Run: `npm test`
Expected: PASS (3 Dateien)

- [ ] **Step 8: Commit**

```bash
git add src/engine tests/engine
git commit -m "feat(engine): add types, seeded rng, timeline and formats"
```

---

### Task 3: Analyse – Vordergrund-Maske und Balkenauswahl

Port von `buildForegroundMask`, `barIsTarget` und `selectStrokeBars` aus dem alten `script.js` (Commit `c0813cc`, Zeilen 2481–2730). Der Algorithmus bleibt inhaltlich gleich, nur die Eingaben sind jetzt Pixeldaten statt Canvas.

Abweichung von der Spec: Der „IMG-MASK-Farbraster“-Cache entfällt. Die alten IMG-MASK-Pfade haben die gesampelten Farben nie benutzt, sie brauchen nur die Balken-Geometrie (`gridBars`).

**Files:**
- Create: `src/engine/analyze.ts`
- Test: `tests/engine/analyze.test.ts`

**Interfaces:**
- Consumes: `Bar` aus `types.ts`
- Produces: `PixelData {data: Uint8ClampedArray, width, height}`, `ForegroundMask {sat: Float64Array, w, h}`, `Grid {cols, rows}`, `MASK_MAX_EDGE = 256`, `maskSize(width, height): Size`, `barGrid(width, height, size, stretch): Grid`, `gridBars(width, height, grid): Bar[]`, `buildForegroundMask(px: PixelData, sensitivity): ForegroundMask`, `barIsForeground(mask, fullWidth, bar): boolean`, `selectStrokeBars(full: PixelData, mask, grid, threshold, removeFront): Bar[]`

- [ ] **Step 1: Failing Tests schreiben** – `tests/engine/analyze.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import {
  barGrid,
  buildForegroundMask,
  gridBars,
  maskSize,
  selectStrokeBars,
  type PixelData,
} from '../../src/engine/analyze';
import type { Bar } from '../../src/engine/types';

interface Rect { x: number; y: number; w: number; h: number }

function image(width: number, height: number, bg: number, rect?: Rect & { v: number }, alpha = 255): PixelData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = !!rect && x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
      const v = rect && inside ? rect.v : bg;
      data.set([v, v, v, alpha], (y * width + x) * 4);
    }
  }
  return { data, width, height };
}

const overlap = (bar: Bar, r: Rect) => {
  const w = Math.max(0, Math.min(bar.x + bar.width, r.x + r.w) - Math.max(bar.x, r.x));
  const h = Math.max(0, Math.min(bar.y + bar.height, r.y + r.h) - Math.max(bar.y, r.y));
  return (w * h) / (bar.width * bar.height);
};

const RECT: Rect = { x: 30, y: 50, w: 60, h: 100 };
const subject = image(120, 200, 235, { ...RECT, v: 20 });
const grid = barGrid(120, 200, 10, 0); // 12 × 7

describe('grid', () => {
  it('derives bar counts from size and stretch', () => {
    expect(barGrid(1080, 1920, 80, 0)).toEqual({ cols: 14, rows: 8 });
    expect(barGrid(1080, 1920, 80, 100)).toEqual({ cols: 14, rows: 4 });
    expect(grid).toEqual({ cols: 12, rows: 7 });
  });
  it('tiles the full frame without gaps', () => {
    const bars = gridBars(1080, 1920, { cols: 14, rows: 8 });
    expect(bars).toHaveLength(112);
    expect(bars.reduce((a, b) => a + b.width * b.height, 0)).toBe(1080 * 1920);
    expect(Math.max(...bars.map((b) => b.x + b.width))).toBe(1080);
  });
  it('mask size is capped at 256 px', () => {
    expect(maskSize(1080, 1920)).toEqual({ width: 144, height: 256 });
    expect(maskSize(120, 200)).toEqual({ width: 120, height: 200 });
  });
});

describe('buildForegroundMask', () => {
  it('finds the dark subject on a light background', () => {
    const mask = buildForegroundMask(subject, 50);
    const fg = mask.sat[mask.sat.length - 1];
    expect(fg).toBeGreaterThan(RECT.w * RECT.h * 0.85);
    expect(fg).toBeLessThan(RECT.w * RECT.h * 1.15);
  });
});

describe('selectStrokeBars', () => {
  const mask = buildForegroundMask(subject, 50);

  it('REMOVE BACK keeps bars on the subject, REMOVE FRONT the rest', () => {
    const back = selectStrokeBars(subject, mask, grid, 0, false);
    const front = selectStrokeBars(subject, mask, grid, 0, true);
    expect(back.length).toBeGreaterThan(0);
    for (const bar of back) expect(overlap(bar, RECT)).toBeGreaterThanOrEqual(0.4);
    for (const bar of front) expect(overlap(bar, RECT)).toBeLessThanOrEqual(0.6);
    expect(back.length + front.length).toBe(grid.cols * grid.rows);
  });

  it('THRESHOLD removes that share of candidates (max 90 %)', () => {
    const all = selectStrokeBars(subject, mask, grid, 0, true).length;
    expect(selectStrokeBars(subject, mask, grid, 50, true)).toHaveLength(all - Math.floor(all * 0.5));
    expect(selectStrokeBars(subject, mask, grid, 100, true)).toHaveLength(all - Math.floor(all * 0.9));
  });

  it('is deterministic', () => {
    expect(selectStrokeBars(subject, mask, grid, 35, false)).toEqual(selectStrokeBars(subject, mask, grid, 35, false));
  });

  it('survives degenerate images', () => {
    const flat = image(80, 80, 128);
    const flatMask = buildForegroundMask(flat, 50);
    const flatGrid = barGrid(80, 80, 10, 0);
    expect(selectStrokeBars(flat, flatMask, flatGrid, 0, false)).toEqual([]);
    expect(selectStrokeBars(flat, flatMask, flatGrid, 0, true)).toHaveLength(flatGrid.cols * flatGrid.rows);

    const dot = image(1, 1, 200);
    const dotMask = buildForegroundMask(dot, 50);
    expect(dotMask.sat).toHaveLength(4);
    expect(() => selectStrokeBars(dot, dotMask, barGrid(1, 1, 25, 0), 35, false)).not.toThrow();

    const clear = image(40, 40, 0, undefined, 0);
    const clearMask = buildForegroundMask(clear, 50);
    expect(Number.isNaN(clearMask.sat[clearMask.sat.length - 1])).toBe(false);
  });
});
```

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npm test -- tests/engine/analyze.test.ts`
Expected: FAIL (Modul fehlt)

- [ ] **Step 3: `src/engine/analyze.ts` implementieren**

```ts
import type { Bar, Size } from './types';

export interface PixelData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Summed-area table of foreground pixels at mask resolution. */
export interface ForegroundMask {
  sat: Float64Array;
  w: number;
  h: number;
}

export interface Grid {
  cols: number;
  rows: number;
}

export const MASK_MAX_EDGE = 256;

export function maskSize(width: number, height: number): Size {
  const scale = Math.min(1, MASK_MAX_EDGE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Bars are `size` wide and 3 × size (+ stretch) tall; counts are rounded so bars tile the frame. */
export function barGrid(width: number, height: number, size: number, stretch: number): Grid {
  const barHeight = size * 3 + Math.floor(stretch * 2);
  return {
    cols: Math.max(1, Math.round(width / size)),
    rows: Math.max(1, Math.round(height / barHeight)),
  };
}

export function gridBars(width: number, height: number, grid: Grid): Bar[] {
  const bars: Bar[] = [];
  for (let col = 0; col < grid.cols; col++) {
    const x = Math.round((col * width) / grid.cols);
    const w = Math.round(((col + 1) * width) / grid.cols) - x;
    for (let row = 0; row < grid.rows; row++) {
      const y = Math.round((row * height) / grid.rows);
      const h = Math.round(((row + 1) * height) / grid.rows) - y;
      bars.push({ x, y, width: w, height: h });
    }
  }
  return bars;
}

// Learn background colours from the top/left/right border, flood-fill the connected
// background from the edges, drop tiny foreground specks.
export function buildForegroundMask(px: PixelData, sensitivity: number): ForegroundMask {
  const { width: w, height: h, data } = px;
  const n = w * h;

  const lab = new Float32Array(n * 3);
  const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  for (let i = 0; i < n; i++) {
    const r = lin(data[i * 4]), g = lin(data[i * 4 + 1]), b = lin(data[i * 4 + 2]);
    const fx = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
    const fy = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
    const fz = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
    lab[i * 3] = 116 * fy - 16;
    lab[i * 3 + 1] = 500 * (fx - fy);
    lab[i * 3 + 2] = 200 * (fy - fz);
  }

  // Bottom edge is left out of the model: subjects (busts, products) usually touch it.
  const ring = Math.max(1, Math.round(Math.min(w, h) * 0.03));
  const samples: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (y < ring || x < ring || x >= w - ring) samples.push(y * w + x);
    }
  }

  const k = Math.min(8, samples.length);
  let centers: number[][] = [];
  for (let j = 0; j < k; j++) {
    const i = samples[Math.floor(((j + 0.5) * samples.length) / k)];
    centers.push([lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]]);
  }
  let counts: number[] = new Array(k).fill(0);
  for (let iter = 0; iter < 8; iter++) {
    const sums = centers.map(() => [0, 0, 0]);
    counts = new Array(k).fill(0);
    for (const i of samples) {
      let best = 0;
      let bestD = Infinity;
      for (let j = 0; j < k; j++) {
        const d = (lab[i * 3] - centers[j][0]) ** 2 + (lab[i * 3 + 1] - centers[j][1]) ** 2 + (lab[i * 3 + 2] - centers[j][2]) ** 2;
        if (d < bestD) { bestD = d; best = j; }
      }
      sums[best][0] += lab[i * 3];
      sums[best][1] += lab[i * 3 + 1];
      sums[best][2] += lab[i * 3 + 2];
      counts[best]++;
    }
    centers = centers.map((cen, j) => (counts[j] ? sums[j].map((v) => v / counts[j]) : cen));
  }
  const bgColors = centers.filter((_, j) => counts[j] >= samples.length * 0.03);

  const dist = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let m = Infinity;
    for (const cen of bgColors) {
      const d = (lab[i * 3] - cen[0]) ** 2 + (lab[i * 3 + 1] - cen[1]) ** 2 + (lab[i * 3 + 2] - cen[2]) ** 2;
      if (d < m) m = d;
    }
    dist[i] = Math.sqrt(m);
  }

  // Edge strength: the background fill may not cross object outlines.
  const grad = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      let g = 0;
      for (let ch = 0; ch < 3; ch++) {
        const gx = lab[(i + 1) * 3 + ch] - lab[(i - 1) * 3 + ch];
        const gy = lab[(i + w) * 3 + ch] - lab[(i - w) * 3 + ch];
        g += gx * gx + gy * gy;
      }
      grad[i] = Math.sqrt(g);
    }
  }
  const sortedGrad = Float32Array.from(grad).sort();
  const edgeThreshold = Math.max(10, sortedGrad[Math.floor(n * 0.9)]);

  // Image-adaptive colour tolerance (Otsu on the distance-to-background histogram);
  // the slider only shifts it: 50 = automatic, higher removes more.
  const bins = 128;
  const maxD = 100;
  const hist = new Float64Array(bins);
  for (let i = 0; i < n; i++) hist[Math.min(bins - 1, Math.floor((dist[i] / maxD) * bins))]++;
  let sumAll = 0;
  for (let b = 0; b < bins; b++) sumAll += b * hist[b];
  let wB = 0, sumB = 0, bestVar = -1, bestBin = 0;
  for (let b = 0; b < bins; b++) {
    wB += hist[b];
    if (!wB || wB === n) continue;
    sumB += b * hist[b];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / (n - wB);
    const between = wB * (n - wB) * (mB - mF) ** 2;
    if (between > bestVar) { bestVar = between; bestBin = b; }
  }
  const autoTol = Math.min(50, Math.max(5, ((bestBin + 1) / bins) * maxD));
  let tol = autoTol * Math.pow(2, (sensitivity - 50) / 50);

  const fillBackground = (tolerance: number): Uint8Array => {
    const bgMask = new Uint8Array(n);
    const stack: number[] = [];
    for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
    while (stack.length) {
      const i = stack.pop()!;
      if (bgMask[i] || dist[i] >= tolerance) continue;
      if (grad[i] >= edgeThreshold && dist[i] >= tolerance * 0.35) continue;
      bgMask[i] = 1;
      const x = i % w;
      const y = (i - x) / w;
      if (x > 0) stack.push(i - 1);
      if (x < w - 1) stack.push(i + 1);
      if (y > 0) stack.push(i - w);
      if (y < h - 1) stack.push(i + w);
    }
    return bgMask;
  };

  // Morphological opening on the foreground: cuts thin bridges to neighbouring background clutter.
  const morph = (src: Uint8Array, r: number, erode: boolean): Uint8Array => {
    const tmp = new Uint8Array(n);
    const out = new Uint8Array(n);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = erode ? 1 : 0;
        for (let d = -r; d <= r; d++) {
          const xx = Math.min(w - 1, Math.max(0, x + d));
          v = erode ? Math.min(v, src[y * w + xx]) : Math.max(v, src[y * w + xx]);
        }
        tmp[y * w + x] = v;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = erode ? 1 : 0;
        for (let d = -r; d <= r; d++) {
          const yy = Math.min(h - 1, Math.max(0, y + d));
          v = erode ? Math.min(v, tmp[yy * w + x]) : Math.max(v, tmp[yy * w + x]);
        }
        out[y * w + x] = v;
      }
    }
    return out;
  };

  const segment = (tolerance: number): { bgMask: Uint8Array; fgFrac: number } => {
    const r = Math.max(1, Math.round(Math.min(w, h) / 100));
    let fgMask = new Uint8Array(n);
    const filled = fillBackground(tolerance);
    for (let i = 0; i < n; i++) fgMask[i] = filled[i] ? 0 : 1;
    fgMask = morph(morph(fgMask, r, true), r, false);

    // Keep only the main subject parts: drop components much smaller than the largest one.
    const comps: number[][] = [];
    const seen = new Uint8Array(n);
    for (let s0 = 0; s0 < n; s0++) {
      if (!fgMask[s0] || seen[s0]) continue;
      const comp = [s0];
      seen[s0] = 1;
      for (let q = 0; q < comp.length; q++) {
        const i = comp[q];
        const x = i % w;
        const y = (i - x) / w;
        const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
        for (const j of nb) {
          if (j >= 0 && fgMask[j] && !seen[j]) { seen[j] = 1; comp.push(j); }
        }
      }
      comps.push(comp);
    }
    const largest = comps.reduce((m, c) => Math.max(m, c.length), 0);
    const minArea = Math.max(n * 0.004, largest * 0.15);
    const bgMask = new Uint8Array(n).fill(1);
    let kept = 0;
    for (const comp of comps) {
      if (comp.length < minArea) continue;
      for (const i of comp) bgMask[i] = 0;
      kept += comp.length;
    }
    return { bgMask, fgFrac: kept / n };
  };

  // Nudge the tolerance when the result is implausible (almost no subject / almost no background).
  let { bgMask: bg, fgFrac } = segment(tol);
  for (let attempt = 0; attempt < 4 && (fgFrac < 0.04 || fgFrac > 0.92); attempt++) {
    tol *= fgFrac < 0.04 ? 0.6 : 1.6;
    ({ bgMask: bg, fgFrac } = segment(tol));
  }

  const sat = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += bg[y * w + x] ? 0 : 1;
      sat[(y + 1) * (w + 1) + x + 1] = sat[y * (w + 1) + x + 1] + row;
    }
  }
  return { sat, w, h };
}

/** True when at least half of the bar lies on the foreground. */
export function barIsForeground(mask: ForegroundMask, fullWidth: number, bar: Bar): boolean {
  const { sat, w, h } = mask;
  const scale = w / fullWidth;
  const x0 = Math.min(w - 1, Math.floor(bar.x * scale));
  const y0 = Math.min(h - 1, Math.floor(bar.y * scale));
  const x1 = Math.max(x0 + 1, Math.min(w, Math.round((bar.x + bar.width) * scale)));
  const y1 = Math.max(y0 + 1, Math.min(h, Math.round((bar.y + bar.height) * scale)));
  const W = w + 1;
  const fg = sat[y1 * W + x1] - sat[y0 * W + x1] - sat[y1 * W + x0] + sat[y0 * W + x0];
  return fg / ((x1 - x0) * (y1 - y0)) >= 0.5;
}

// Bars that carry a stroke: on the chosen side (front/back), minus the darkest share set by
// THRESHOLD. The share is relative to this image's own brightness spread, so every photo
// breaks up similarly.
export function selectStrokeBars(full: PixelData, mask: ForegroundMask, grid: Grid, threshold: number, removeFront: boolean): Bar[] {
  const { width, height, data } = full;
  const candidates: (Bar & { lum: number })[] = [];
  for (const bar of gridBars(width, height, grid)) {
    if (barIsForeground(mask, width, bar) === removeFront) continue;
    const sx = Math.min(bar.x + Math.floor(bar.width / 2), width - 1);
    const sy = Math.min(bar.y + Math.floor(bar.height / 2), height - 1);
    const i = (sy * width + sx) * 4;
    candidates.push({ ...bar, lum: 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] });
  }
  const removeCount = Math.floor(candidates.length * Math.min(0.9, threshold / 100));
  // Score = half brightness rank, half stable per-bar noise → removal follows the image but stays scattered.
  const byLum = candidates.map((_, i) => i).sort((a, b) => candidates[a].lum - candidates[b].lum);
  const score = new Float32Array(candidates.length);
  byLum.forEach((ci, rank) => {
    const c = candidates[ci];
    const noise = (Math.imul(Math.imul(c.x, 73856093) ^ Math.imul(c.y, 19349663), 2654435761) >>> 0) / 0xffffffff;
    score[ci] = (0.5 * rank) / candidates.length + 0.5 * noise;
  });
  const lowest = candidates.map((_, i) => i).sort((a, b) => score[a] - score[b]);
  const removed = new Set(lowest.slice(0, removeCount));
  return candidates.filter((_, i) => !removed.has(i)).map(({ x, y, width: bw, height: bh }) => ({ x, y, width: bw, height: bh }));
}
```

- [ ] **Step 4: Tests laufen lassen, sie müssen grün sein**

Run: `npm test -- tests/engine/analyze.test.ts`
Expected: PASS. Falls `REMOVE BACK keeps bars on the subject` knapp scheitert, nicht die Toleranz im Test lockern, sondern prüfen, ob der Port vom Original abweicht (Zeilen im alten `script.js` 2481–2730 mit `git show c0813cc:script.js` vergleichen).

- [ ] **Step 5: Commit**

```bash
git add src/engine/analyze.ts tests/engine/analyze.test.ts
git commit -m "feat(engine): port foreground mask and stroke bar selection"
```

---

### Task 4: Zeichen-Helfer und die Animationen BUILD UP, FADE, REVEAL

**Files:**
- Create: `src/engine/draw.ts`, `src/engine/motions/types.ts`, `src/engine/motions/buildUp.ts`, `src/engine/motions/fade.ts`, `src/engine/motions/reveal.ts`
- Test: `tests/engine/helpers.ts`, `tests/engine/draw.test.ts`, `tests/engine/motions-basic.test.ts`

**Interfaces:**
- Consumes: `Bar`, `Ctx2D`, `Fit`, `MotionId`, `Settings` (types.ts)
- Produces:
  - `draw.ts`: `clamp01(v)`, `drawFitted(ctx, img: ImageBitmap, width, height, fit)`, `fillBars(ctx, bars, color, count = bars.length)`, `clipDraw(ctx, bars, img, width, height, fit)`, `barNoise(bar): number`
  - `motions/types.ts`: `FrameInput {width, height, fit, bars: readonly Bar[], progress, cycle, frameIndex, seed, color, image: ImageBitmap, nextImage: ImageBitmap, imgMask}`, `Motion {id: MotionId, label, icon, draw(ctx, f)}`
  - `buildUp`, `fade`, `reveal` (je `Motion`)
  - Test-Helfer: `RecordingCtx`, `fakeImage(id, w?, h?)`, `testBars(cols?, rows?, w?, h?)`, `frame(overrides)`, `record(fn)`, `TEST_SETTINGS`

- [ ] **Step 1: Test-Helfer schreiben** – `tests/engine/helpers.ts`

```ts
import type { FrameInput } from '../../src/engine/motions/types';
import type { Bar, Ctx2D, Settings } from '../../src/engine/types';

/** Minimal 2D context that records every drawing call as a string. */
export class RecordingCtx {
  calls: string[] = [];
  fillStyle = '#000000';
  globalAlpha = 1;
  private stack: { fillStyle: string; globalAlpha: number }[] = [];

  save(): void {
    this.stack.push({ fillStyle: this.fillStyle, globalAlpha: this.globalAlpha });
    this.calls.push('save');
  }
  restore(): void {
    const s = this.stack.pop();
    if (s) { this.fillStyle = s.fillStyle; this.globalAlpha = s.globalAlpha; }
    this.calls.push('restore');
  }
  beginPath(): void { this.calls.push('beginPath'); }
  rect(x: number, y: number, w: number, h: number): void { this.calls.push(`rect ${x} ${y} ${w} ${h}`); }
  clip(): void { this.calls.push('clip'); }
  clearRect(x: number, y: number, w: number, h: number): void { this.calls.push(`clearRect ${x} ${y} ${w} ${h}`); }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.calls.push(`fillRect ${x} ${y} ${w} ${h} ${this.fillStyle} ${this.globalAlpha.toFixed(3)}`);
  }
  drawImage(img: unknown, ...args: number[]): void {
    this.calls.push(`drawImage ${(img as { id: string }).id} ${args.map((a) => a.toFixed(2)).join(' ')} ${this.globalAlpha.toFixed(3)}`);
  }
  asCtx(): Ctx2D {
    return this as unknown as Ctx2D;
  }
}

export function fakeImage(id: string, width = 100, height = 300): ImageBitmap {
  return { id, width, height, close() {} } as unknown as ImageBitmap;
}

export function testBars(cols = 10, rows = 10, w = 10, h = 30): Bar[] {
  const bars: Bar[] = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) bars.push({ x: c * w, y: r * h, width: w, height: h });
  return bars;
}

export function frame(over: Partial<FrameInput> = {}): FrameInput {
  return {
    width: 100,
    height: 300,
    fit: 'cover',
    bars: testBars(),
    progress: 0.5,
    cycle: 0,
    frameIndex: 0,
    seed: 1,
    color: '#FFFFFF',
    image: fakeImage('cur'),
    nextImage: fakeImage('next'),
    imgMask: false,
    ...over,
  };
}

export function record(draw: (ctx: Ctx2D) => void): string[] {
  const r = new RecordingCtx();
  draw(r.asCtx());
  return r.calls;
}

export const count = (calls: string[], prefix: string) => calls.filter((c) => c.startsWith(prefix)).length;

export const TEST_SETTINGS: Settings = {
  size: 80, stretch: 0, threshold: 35, removeFront: false, sensitivity: 50, color: '#FFFFFF',
  imgMask: false, motion: 'buildUp', speed: 1, loops: 1, format: '9:16',
};
```

- [ ] **Step 2: Failing Tests schreiben**

`tests/engine/draw.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { barNoise, clipDraw, drawFitted, fillBars } from '../../src/engine/draw';
import { fakeImage, record, testBars } from './helpers';

describe('drawFitted', () => {
  it('cover crops the wider source to the target aspect, centred', () => {
    expect(record((ctx) => drawFitted(ctx, fakeImage('a', 200, 100), 100, 100, 'cover'))).toEqual([
      'drawImage a 50.00 0.00 100.00 100.00 0.00 0.00 100.00 100.00 1.000',
    ]);
  });
  it('contain letterboxes the source inside the target', () => {
    expect(record((ctx) => drawFitted(ctx, fakeImage('a', 200, 100), 100, 100, 'contain'))).toEqual([
      'drawImage a 0.00 25.00 100.00 50.00 1.000',
    ]);
  });
});

describe('fillBars / clipDraw', () => {
  it('fills only the first `count` bars', () => {
    expect(record((ctx) => fillBars(ctx, testBars(), '#FF0000', 3))).toEqual([
      'fillRect 0 0 10 30 #FF0000 1.000',
      'fillRect 0 30 10 30 #FF0000 1.000',
      'fillRect 0 60 10 30 #FF0000 1.000',
    ]);
  });
  it('clipDraw is a no-op without bars', () => {
    expect(record((ctx) => clipDraw(ctx, [], fakeImage('n'), 100, 300, 'cover'))).toEqual([]);
  });
  it('clipDraw clips to the bars, then draws the image once', () => {
    const calls = record((ctx) => clipDraw(ctx, testBars(1, 2), fakeImage('n'), 100, 300, 'cover'));
    expect(calls[0]).toBe('save');
    expect(calls.slice(1, 4)).toEqual(['beginPath', 'rect 0 0 10 30', 'rect 0 30 10 30']);
    expect(calls[4]).toBe('clip');
    expect(calls[5]).toMatch(/^drawImage n /);
    expect(calls[6]).toBe('restore');
  });
});

describe('barNoise', () => {
  it('is stable and in [0, 1)', () => {
    for (const bar of testBars(20, 20)) {
      const v = barNoise(bar);
      expect(v).toBe(barNoise({ ...bar }));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
```

`tests/engine/motions-basic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildUp } from '../../src/engine/motions/buildUp';
import { fade } from '../../src/engine/motions/fade';
import { reveal } from '../../src/engine/motions/reveal';
import { RecordingCtx, count, frame, record } from './helpers';

describe('BUILD UP', () => {
  const fills = (progress: number) => count(record((ctx) => buildUp.draw(ctx, frame({ progress }))), 'fillRect');
  it('rises to all bars at half-cycle and falls back symmetrically', () => {
    expect(fills(0)).toBe(0);
    expect(fills(0.25)).toBe(50);
    expect(fills(0.5)).toBe(100);
    expect(fills(0.75)).toBe(50);
  });
  it('IMG MASK reveals the next image through progress × bars', () => {
    const calls = record((ctx) => buildUp.draw(ctx, frame({ progress: 0.3, imgMask: true })));
    expect(count(calls, 'rect ')).toBe(30);
    expect(count(calls, 'drawImage next')).toBe(1);
    expect(count(calls, 'fillRect')).toBe(0);
  });
});

describe('FADE', () => {
  it('is fully in at half-cycle and gone at the end', () => {
    const mid = record((ctx) => fade.draw(ctx, frame({ progress: 0.5 })));
    expect(mid.filter((c) => c.startsWith('fillRect') && c.endsWith('1.000'))).toHaveLength(100);
    expect(count(record((ctx) => fade.draw(ctx, frame({ progress: 0.999 }))), 'fillRect')).toBe(0);
  });
  it('restores globalAlpha', () => {
    const r = new RecordingCtx();
    fade.draw(r.asCtx(), frame({ progress: 0.3 }));
    expect(r.globalAlpha).toBe(1);
  });
});

describe('REVEAL', () => {
  it('fills every bar and clears the first half at progress 0.25', () => {
    const calls = record((ctx) => reveal.draw(ctx, frame({ progress: 0.25 })));
    expect(count(calls, 'fillRect')).toBe(100);
    expect(count(calls, 'drawImage cur')).toBe(50);
  });
  it('IMG MASK lets the next image appear bar by bar', () => {
    const calls = record((ctx) => reveal.draw(ctx, frame({ progress: 0.25, imgMask: true })));
    expect(count(calls, 'drawImage next')).toBe(50);
    expect(count(calls, 'fillRect')).toBe(0);
  });
});

describe('determinism', () => {
  for (const motion of [buildUp, fade, reveal]) {
    it(`${motion.label} draws identically for identical input`, () => {
      const f = frame({ progress: 0.37 });
      expect(record((ctx) => motion.draw(ctx, f))).toEqual(record((ctx) => motion.draw(ctx, f)));
    });
  }
});
```

- [ ] **Step 3: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npm test`
Expected: FAIL (Module `draw`, `motions/*` fehlen)

- [ ] **Step 4: `src/engine/draw.ts` implementieren**

```ts
import type { Bar, Ctx2D, Fit } from './types';

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export function drawFitted(ctx: Ctx2D, img: ImageBitmap, width: number, height: number, fit: Fit): void {
  if (fit === 'contain') {
    const scale = Math.min(width / img.width, height / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
    return;
  }
  const imgAspect = img.width / img.height;
  const targetAspect = width / height;
  let sw = img.width, sh = img.height, sx = 0, sy = 0;
  if (imgAspect > targetAspect) {
    sw = img.height * targetAspect;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / targetAspect;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
}

export function fillBars(ctx: Ctx2D, bars: readonly Bar[], color: string, count = bars.length): void {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const b = bars[i];
    ctx.fillRect(b.x, b.y, b.width, b.height);
  }
}

/** Draws `img` only inside the union of `bars` (IMG MASK reveal). */
export function clipDraw(ctx: Ctx2D, bars: readonly Bar[], img: ImageBitmap, width: number, height: number, fit: Fit): void {
  if (bars.length === 0) return;
  ctx.save();
  ctx.beginPath();
  for (const b of bars) ctx.rect(b.x, b.y, b.width, b.height);
  ctx.clip();
  drawFitted(ctx, img, width, height, fit);
  ctx.restore();
}

/** Stable per-bar noise in [0, 1) – same hash the legacy animations used. */
export function barNoise(bar: Bar): number {
  const hx = (bar.x * 73856093) >>> 0;
  const hy = (bar.y * 19349663) >>> 0;
  return (((hx ^ hy) * 2654435761) >>> 0) / 0xffffffff;
}
```

- [ ] **Step 5: `src/engine/motions/types.ts` implementieren**

```ts
import type { Bar, Ctx2D, Fit, MotionId } from '../types';

export interface FrameInput {
  width: number;
  height: number;
  fit: Fit;
  /** Already shuffled with the scene seed; the full grid when imgMask is on. */
  bars: readonly Bar[];
  progress: number;
  cycle: number;
  frameIndex: number;
  seed: number;
  color: string;
  image: ImageBitmap;
  nextImage: ImageBitmap;
  imgMask: boolean;
}

export interface Motion {
  id: MotionId;
  label: string;
  icon: string;
  draw(ctx: Ctx2D, f: FrameInput): void;
}
```

- [ ] **Step 6: Die drei Animationen implementieren**

`src/engine/motions/buildUp.ts`:

```ts
import { clipDraw, fillBars } from '../draw';
import type { Motion } from './types';

/** Bars pile up to the full set in the first half of the cycle, then fall away again. */
export const buildUp: Motion = {
  id: 'buildUp',
  label: 'BUILD UP',
  icon: '↑',
  draw(ctx, f) {
    const n = f.bars.length;
    if (f.imgMask) {
      clipDraw(ctx, f.bars.slice(0, Math.floor(f.progress * n)), f.nextImage, f.width, f.height, f.fit);
      return;
    }
    const level = f.progress < 0.5 ? f.progress * 2 : 1 - (f.progress - 0.5) * 2;
    fillBars(ctx, f.bars, f.color, Math.floor(level * n));
  },
};
```

`src/engine/motions/fade.ts`:

```ts
import { clamp01, clipDraw, drawFitted } from '../draw';
import type { Motion } from './types';

const FADE_ZONE = 0.2;

/** Strokes fade in over the first half and out over the second, staggered by bar order. */
export const fade: Motion = {
  id: 'fade',
  label: 'FADE',
  icon: '◑',
  draw(ctx, f) {
    const total = f.bars.length;
    if (f.imgMask) {
      clipDraw(ctx, f.bars.filter((_, i) => i / total <= f.progress), f.nextImage, f.width, f.height, f.fit);
      f.bars.forEach((bar, i) => {
        const pos = i / total;
        if (pos <= f.progress || pos > f.progress + FADE_ZONE) return;
        ctx.save();
        ctx.globalAlpha = (f.progress + FADE_ZONE - pos) / FADE_ZONE;
        ctx.beginPath();
        ctx.rect(bar.x, bar.y, bar.width, bar.height);
        ctx.clip();
        drawFitted(ctx, f.nextImage, f.width, f.height, f.fit);
        ctx.restore();
      });
      return;
    }
    const fadeIn = f.progress <= 0.5;
    const phase = fadeIn ? f.progress * 2 : (f.progress - 0.5) * 2;
    ctx.fillStyle = f.color;
    f.bars.forEach((bar, i) => {
      const pos = i / total;
      const alpha = fadeIn ? clamp01(1 - (pos - phase) / FADE_ZONE) : clamp01((pos - phase) / FADE_ZONE);
      if (alpha <= 0) return;
      ctx.globalAlpha = alpha;
      ctx.fillRect(bar.x, bar.y, bar.width, bar.height);
    });
    ctx.globalAlpha = 1;
  },
};
```

`src/engine/motions/reveal.ts`:

```ts
import { clamp01, drawFitted } from '../draw';
import type { Bar } from '../types';
import type { Motion } from './types';

const WAVE_WIDTH = 0.15;

export const reveal: Motion = {
  id: 'reveal',
  label: 'REVEAL',
  icon: '◌',
  draw(ctx, f) {
    const total = f.bars.length;
    const clipTo = (bar: Bar, alpha: number, img: ImageBitmap) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(bar.x, bar.y, bar.width, bar.height);
      ctx.clip();
      ctx.globalAlpha = alpha;
      drawFitted(ctx, img, f.width, f.height, f.fit);
      ctx.restore();
    };
    if (f.imgMask) {
      // 0→0.5: the next image appears bar by bar; 0.5→1: the bars settle into the clear photo.
      const appear = Math.min(1, f.progress * 2);
      const settle = f.progress > 0.5 ? (f.progress - 0.5) * 2 : 0;
      f.bars.forEach((bar, i) => {
        const pos = i / total;
        const barAlpha = clamp01((appear - pos) / WAVE_WIDTH);
        if (barAlpha <= 0) return;
        const clearAlpha = f.progress > 0.5 ? clamp01((settle - pos) / WAVE_WIDTH) : 0;
        const pixAlpha = barAlpha * (1 - clearAlpha);
        if (pixAlpha > 0) clipTo(bar, pixAlpha, f.nextImage);
        if (clearAlpha > 0) clipTo(bar, barAlpha * clearAlpha, f.nextImage);
      });
      return;
    }
    // 0→0.5: coloured bars turn clear one by one; 0.5→1: they close again.
    const revealing = f.progress <= 0.5;
    const phase = revealing ? f.progress * 2 : (f.progress - 0.5) * 2;
    f.bars.forEach((bar, i) => {
      const t = (phase - i / total) / WAVE_WIDTH;
      const clearAlpha = revealing ? clamp01(t) : clamp01(1 - t);
      ctx.fillStyle = f.color;
      ctx.fillRect(bar.x, bar.y, bar.width, bar.height);
      if (clearAlpha > 0) clipTo(bar, clearAlpha, f.image);
    });
  },
};
```

- [ ] **Step 7: Tests laufen lassen, sie müssen grün sein**

Run: `npm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/engine/draw.ts src/engine/motions tests/engine
git commit -m "feat(engine): add draw helpers and BUILD UP, FADE, REVEAL motions"
```

---

### Task 5: IMPULSE, WAVE, GLITCH, Registry und `renderFrame`

**Files:**
- Create: `src/engine/motions/impulse.ts`, `src/engine/motions/wave.ts`, `src/engine/motions/glitch.ts`, `src/engine/motions/index.ts`, `src/engine/render.ts`
- Test: `tests/engine/motions.test.ts`, `tests/engine/render.test.ts`

**Interfaces:**
- Consumes: `draw.ts`, `rng.ts` (`rngFor`, `shuffled`, `hashSeed`, `mulberry32`), `timeline.ts` (`positionAt`, `totalDuration`), `motions/types.ts`
- Produces:
  - `motions/index.ts`: `MOTIONS: readonly Motion[]` (Reihenfolge buildUp, impulse, wave, fade, glitch, reveal), `motionById(id: MotionId): Motion`
  - `render.ts`: `ImageLayer {bitmap: ImageBitmap, strokeBars: Bar[], gridBars: Bar[]}`, `Scene {width, height, fit, layers: ImageLayer[], settings: Settings, seed: number}`, `imgMaskActive(scene)`, `sceneDuration(scene)`, `renderFrame(ctx, scene, t): number` (gibt den gezeigten Clip-Index zurück, −1 ohne Bilder), `renderStill(ctx, scene, index): void`

- [ ] **Step 1: Failing Tests schreiben**

`tests/engine/motions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MOTIONS, motionById } from '../../src/engine/motions';
import type { MotionId } from '../../src/engine/types';
import { RecordingCtx, count, frame, record } from './helpers';

describe('registry', () => {
  it('lists the six motions in menu order', () => {
    expect(MOTIONS.map((m) => m.label)).toEqual(['BUILD UP', 'IMPULSE', 'WAVE', 'FADE', 'GLITCH', 'REVEAL']);
  });
  it('falls back to BUILD UP for unknown ids', () => {
    expect(motionById('nope' as MotionId).id).toBe('buildUp');
  });
});

describe('every motion', () => {
  for (const motion of MOTIONS) {
    for (const imgMask of [false, true]) {
      for (const progress of [0.1, 0.4, 0.7, 0.95]) {
        it(`${motion.label} imgMask=${imgMask} p=${progress} is deterministic and leaves the context clean`, () => {
          const f = frame({ progress, imgMask, cycle: 3, frameIndex: 17, seed: 99 });
          const r = new RecordingCtx();
          motion.draw(r.asCtx(), f);
          expect(r.calls).toEqual(record((ctx) => motion.draw(ctx, f)));
          expect(count(r.calls, 'save')).toBe(count(r.calls, 'restore'));
          expect(r.globalAlpha).toBe(1);
        });
      }
    }
  }
});

describe('seeded motions', () => {
  for (const id of ['impulse', 'wave', 'glitch'] as const) {
    it(`${id} changes with the seed`, () => {
      const m = motionById(id);
      const a = record((ctx) => m.draw(ctx, frame({ progress: 0.3, seed: 1 })));
      const b = record((ctx) => m.draw(ctx, frame({ progress: 0.3, seed: 2 })));
      expect(a).not.toEqual(b);
    });
  }
});
```

`tests/engine/render.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { renderFrame, renderStill, sceneDuration, type ImageLayer, type Scene } from '../../src/engine/render';
import type { Settings } from '../../src/engine/types';
import { RecordingCtx, TEST_SETTINGS, count, fakeImage, record, testBars } from './helpers';

const layer = (id: string): ImageLayer => ({
  bitmap: fakeImage(id),
  strokeBars: testBars().filter((_, i) => i % 2 === 0),
  gridBars: testBars(),
});

function scene(ids = ['a', 'b', 'c'], s: Partial<Settings> = {}, seed = 7): Scene {
  return { width: 100, height: 300, fit: 'cover', seed, layers: ids.map(layer), settings: { ...TEST_SETTINGS, ...s } };
}

describe('renderFrame', () => {
  it('shows the clip that the timeline selects', () => {
    const sc = scene();
    const at = (t: number) => renderFrame(new RecordingCtx().asCtx(), sc, t);
    expect(at(0)).toBe(0);
    expect(at(6.5)).toBe(1);
    expect(at(13)).toBe(2);
    expect(sceneDuration(sc)).toBe(18);
  });

  it('paints black, then the current clip, then the motion', () => {
    const calls = record((ctx) => renderFrame(ctx, scene(), 1.5));
    expect(calls[0]).toBe('clearRect 0 0 100 300');
    expect(calls[1]).toBe('fillRect 0 0 100 300 #000000 1.000');
    expect(calls[2]).toMatch(/^drawImage a /);
    expect(count(calls, 'fillRect') - 1).toBe(25); // BUILD UP at p = 0.25 → half of 50 stroke bars
  });

  it('ignores IMG MASK with a single clip', () => {
    const calls = record((ctx) => renderFrame(ctx, scene(['a'], { imgMask: true }), 1.5));
    expect(calls[1]).toBe('fillRect 0 0 100 300 #000000 1.000');
    expect(count(calls, 'clip')).toBe(0);
  });

  it('IMG MASK with several clips reveals the next clip over the current one', () => {
    const calls = record((ctx) => renderFrame(ctx, scene(['a', 'b'], { imgMask: true }), 3));
    expect(calls).not.toContain('fillRect 0 0 100 300 #000000 1.000');
    expect(calls[1]).toMatch(/^drawImage a /);
    expect(count(calls, 'drawImage b')).toBe(1);
  });

  it('is deterministic per seed and changes with it', () => {
    const one = record((ctx) => renderFrame(ctx, scene(['a'], {}, 1), 1.5));
    expect(record((ctx) => renderFrame(ctx, scene(['a'], {}, 1), 1.5))).toEqual(one);
    expect(record((ctx) => renderFrame(ctx, scene(['a'], {}, 2), 1.5))).not.toEqual(one);
  });

  it('does nothing without clips', () => {
    expect(renderFrame(new RecordingCtx().asCtx(), scene([]), 0)).toBe(-1);
  });
});

describe('renderStill', () => {
  it('draws every stroke bar of the selected clip in the stroke colour', () => {
    const calls = record((ctx) => renderStill(ctx, scene(['a', 'b'], { color: '#FF0000' }), 1));
    expect(calls[2]).toMatch(/^drawImage b /);
    expect(calls.filter((c) => c.includes('#FF0000'))).toHaveLength(50);
  });
  it('IMG MASK shows the next clip behind the strokes', () => {
    const calls = record((ctx) => renderStill(ctx, scene(['a', 'b'], { imgMask: true }), 0));
    expect(calls[1]).toMatch(/^drawImage b /);
  });
});
```

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npm test`
Expected: FAIL (`motions/index`, `render` fehlen)

- [ ] **Step 3: Die drei Animationen implementieren**

`src/engine/motions/impulse.ts`:

```ts
import { barNoise, clamp01, clipDraw, fillBars } from '../draw';
import { rngFor } from '../rng';
import type { Bar } from '../types';
import type { Motion } from './types';

const SALT = 0x1a7;
const EXPAND_END = 0.62;

/** 2–3 shock waves expand from random centres, then the field collapses. */
export const impulse: Motion = {
  id: 'impulse',
  label: 'IMPULSE',
  icon: '◎',
  draw(ctx, f) {
    const rng = rngFor(f.seed, f.cycle, SALT);
    const count = rng() > 0.45 ? 3 : 2;
    const origins = Array.from({ length: count }, (_, i) => ({
      x: f.width * (0.15 + rng() * 0.7),
      y: f.height * (0.15 + rng() * 0.7),
      delay: i === 0 ? 0 : rng() * 0.22,
    }));
    const maxR = Math.hypot(f.width, f.height);
    const scatter = maxR * 0.16;
    const expandRadius = (delay: number, phase: number) =>
      maxR * (1 - Math.pow(1 - clamp01((phase - delay) / (EXPAND_END - delay)), 2.4));
    const reached = (bar: Bar, radiusFor: (delay: number) => number) => {
      const t = barNoise(bar);
      return origins.some((o) => t < (radiusFor(o.delay) - Math.hypot(bar.x - o.x, bar.y - o.y)) / scatter);
    };

    if (f.imgMask) {
      const phase = Math.min(f.progress, EXPAND_END);
      clipDraw(ctx, f.bars.filter((bar) => reached(bar, (d) => expandRadius(d, phase))), f.nextImage, f.width, f.height, f.fit);
      return;
    }
    const expanding = f.progress <= EXPAND_END;
    const collapseR = maxR * Math.pow(1 - (f.progress - EXPAND_END) / (1 - EXPAND_END), 1.6);
    const visible = f.bars.filter((bar) => reached(bar, (d) => (expanding ? expandRadius(d, f.progress) : collapseR)));
    fillBars(ctx, visible, f.color);
  },
};
```

`src/engine/motions/wave.ts`:

```ts
import { barNoise, clipDraw, fillBars } from '../draw';
import { rngFor } from '../rng';
import type { Motion } from './types';

const SALT = 0x3a1e;
const SCATTER = 0.45;

/** An organic wave front sweeps across the frame from a random side. */
export const wave: Motion = {
  id: 'wave',
  label: 'WAVE',
  icon: '∿',
  draw(ctx, f) {
    const rng = rngFor(f.seed, f.cycle, SALT);
    const direction = Math.floor(rng() * 4);
    const freq1 = 1.8 + rng() * 1.4;
    const freq2 = 4.0 + rng() * 2.5;
    const amp1 = 0.06 + rng() * 0.06;
    const amp2 = 0.03 + rng() * 0.03;
    const phase0 = rng() * Math.PI * 2;
    // IMG MASK sweeps one way and overshoots so every bar is revealed before the cycle ends;
    // otherwise the front follows a sine arc 0 → 1 → 0.
    const front = f.imgMask ? Math.sin((f.progress * Math.PI) / 2) * (1 + SCATTER + 0.25) : Math.sin(f.progress * Math.PI);
    const visible = f.bars.filter((bar) => {
      const u = bar.x / f.width;
      const v = bar.y / f.height;
      const [along, perp] = direction === 0 ? [u, v] : direction === 1 ? [1 - u, v] : direction === 2 ? [v, u] : [1 - v, u];
      const disp = amp1 * Math.sin(perp * freq1 * Math.PI * 2 + phase0) + amp2 * Math.sin(perp * freq2 * Math.PI * 2 - phase0 * 1.3);
      return barNoise(bar) < (front - (along + disp)) / SCATTER;
    });
    if (f.imgMask) clipDraw(ctx, visible, f.nextImage, f.width, f.height, f.fit);
    else fillBars(ctx, visible, f.color);
  },
};
```

`src/engine/motions/glitch.ts`:

```ts
import { clipDraw, fillBars } from '../draw';
import { rngFor, shuffled } from '../rng';
import type { Bar } from '../types';
import type { Motion } from './types';

const SALT = 0x611;
const FRINGE = 8;

/** Bars snap in (and out) in a random order with a flickering leading edge. */
export const glitch: Motion = {
  id: 'glitch',
  label: 'GLITCH',
  icon: '▦',
  draw(ctx, f) {
    const order = shuffled(f.bars, rngFor(f.seed, f.cycle, SALT));
    const flicker = rngFor(f.seed, f.cycle, f.frameIndex, SALT);
    const total = order.length;
    if (total === 0) return;

    if (f.imgMask) {
      const target = Math.floor(total * f.progress);
      const visible = order.slice(0, target);
      for (let i = target; i < Math.min(target + FRINGE, total); i++) if (flicker() > 0.6) visible.push(order[i]);
      clipDraw(ctx, visible, f.nextImage, f.width, f.height, f.fit);
      return;
    }
    const visible: Bar[] = [];
    if (f.progress < 0.5) {
      const target = Math.floor(total * f.progress * 2);
      visible.push(...order.slice(0, target));
      for (let i = target; i < Math.min(target + FRINGE, total); i++) if (flicker() > 0.6) visible.push(order[i]);
    } else {
      const hidden = Math.floor(total * (f.progress - 0.5) * 2);
      visible.push(...order.slice(hidden));
      for (let i = Math.max(0, hidden - FRINGE); i < hidden; i++) if (flicker() > 0.7) visible.push(order[i]);
    }
    fillBars(ctx, visible, f.color);
  },
};
```

- [ ] **Step 4: Registry und `render.ts` implementieren**

`src/engine/motions/index.ts`:

```ts
import type { MotionId } from '../types';
import { buildUp } from './buildUp';
import { fade } from './fade';
import { glitch } from './glitch';
import { impulse } from './impulse';
import { reveal } from './reveal';
import type { Motion } from './types';
import { wave } from './wave';

export type { FrameInput, Motion } from './types';

export const MOTIONS: readonly Motion[] = [buildUp, impulse, wave, fade, glitch, reveal];

export function motionById(id: MotionId): Motion {
  return MOTIONS.find((m) => m.id === id) ?? buildUp;
}
```

`src/engine/render.ts`:

```ts
import { drawFitted, fillBars } from './draw';
import { motionById } from './motions';
import { hashSeed, mulberry32, shuffled } from './rng';
import { positionAt, totalDuration } from './timeline';
import type { Bar, Ctx2D, Fit, Settings } from './types';

export interface ImageLayer {
  bitmap: ImageBitmap;
  /** Bars that carry a stroke (after REMOVE and THRESHOLD). */
  strokeBars: Bar[];
  /** Every cell of the grid – IMG MASK reveals through all of them. */
  gridBars: Bar[];
}

export interface Scene {
  width: number;
  height: number;
  fit: Fit;
  layers: ImageLayer[];
  settings: Settings;
  seed: number;
}

const ORDER_SALT = 0xba5;
const orderCache = new WeakMap<Bar[], { key: number; order: Bar[] }>();

/** Bar order for one clip; identical for every loop so loops repeat exactly. */
function barOrder(bars: Bar[], seed: number, imageIndex: number): Bar[] {
  const key = hashSeed(seed, imageIndex, ORDER_SALT);
  const hit = orderCache.get(bars);
  if (hit?.key === key) return hit.order;
  const order = shuffled(bars, mulberry32(key));
  orderCache.set(bars, { key, order });
  return order;
}

export function imgMaskActive(scene: Scene): boolean {
  return scene.settings.imgMask && scene.layers.length >= 2;
}

export function sceneDuration(scene: Scene): number {
  const { loops, speed } = scene.settings;
  return totalDuration({ imageCount: scene.layers.length, loops, speed });
}

function paintBase(ctx: Ctx2D, scene: Scene, image: ImageBitmap, black: boolean): void {
  const { width, height, fit } = scene;
  ctx.clearRect(0, 0, width, height);
  if (black) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
  }
  drawFitted(ctx, image, width, height, fit);
}

/** Draws the animation at time t (seconds). Returns the index of the clip shown, or −1. */
export function renderFrame(ctx: Ctx2D, scene: Scene, t: number): number {
  const n = scene.layers.length;
  if (n === 0) return -1;
  const s = scene.settings;
  const pos = positionAt(t, { imageCount: n, loops: s.loops, speed: s.speed });
  const cur = scene.layers[pos.imageIndex];
  const next = scene.layers[pos.nextImageIndex];
  const imgMask = imgMaskActive(scene);

  paintBase(ctx, scene, cur.bitmap, !imgMask);
  motionById(s.motion).draw(ctx, {
    width: scene.width,
    height: scene.height,
    fit: scene.fit,
    bars: barOrder(imgMask ? cur.gridBars : cur.strokeBars, scene.seed, pos.imageIndex),
    progress: pos.progress,
    cycle: pos.cycle,
    frameIndex: pos.frameIndex,
    seed: scene.seed,
    color: s.color,
    image: cur.bitmap,
    nextImage: next.bitmap,
    imgMask,
  });
  return pos.imageIndex;
}

/** The static stroke picture of one clip (animation stopped). */
export function renderStill(ctx: Ctx2D, scene: Scene, index: number): void {
  const n = scene.layers.length;
  if (n === 0) return;
  const i = Math.min(Math.max(0, index), n - 1);
  const imgMask = imgMaskActive(scene);
  paintBase(ctx, scene, scene.layers[imgMask ? (i + 1) % n : i].bitmap, !imgMask);
  fillBars(ctx, scene.layers[i].strokeBars, scene.settings.color);
}
```

- [ ] **Step 5: Tests laufen lassen, sie müssen grün sein**

Run: `npm test`
Expected: PASS (alle Engine-Tests)

- [ ] **Step 6: Commit**

```bash
git add src/engine tests/engine
git commit -m "feat(engine): add IMPULSE, WAVE, GLITCH and deterministic renderFrame"
```

---

### Task 6: State – Signale, Einstellungen, Store, Farb- und Array-Helfer

**Files:**
- Create: `src/state/signal.ts`, `src/state/settings.ts`, `src/state/store.ts`, `src/util/color.ts`, `src/util/array.ts`
- Test: `tests/state/signal.test.ts`, `tests/state/settings.test.ts`, `tests/util/color.test.ts`, `tests/util/array.test.ts`

**Interfaces:**
- Consumes: `Settings`, `FORMAT_IDS`, `MOTION_IDS` (types.ts), `randomSeed` (rng.ts)
- Produces:
  - `signal.ts`: `Signal<T> {get, set, update, subscribe}`, `signal<T>(initial)`, `effect(deps, fn): () => void`
  - `settings.ts`: `STORAGE_KEY = 'strata:v2'`, `DEFAULT_SETTINGS`, `RangeKey`, `RANGES`, `parseSettings(raw: unknown): Settings`, `loadSettings(storage?)`, `saveSettings(s, storage?)`
  - `store.ts`: `ImageEntry {id, name, bitmap, thumbUrl}`, `ToolId`, Signale `settings`, `images`, `selected`, `playing`, `shownClip`, `seed`, `activeTool`, `exporting`, sowie `patchSettings(patch)` und `resetSettings()`
  - `util/color.ts`: `normalizeHex(input): string | null`, `hslToRgb`, `rgbToHex`, `hslToHex(h, s, l)`, `WHEEL_INNER = 0.3`, `WheelPick`, `pickFromWheel(dx, dy, radius, brightness): WheelPick`
  - `util/array.ts`: `moveItem<T>(list: readonly T[], from, to): T[]`

- [ ] **Step 1: Failing Tests schreiben**

`tests/state/signal.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { effect, signal } from '../../src/state/signal';

describe('signal', () => {
  it('notifies subscribers on change, not on identical values', () => {
    const s = signal(1);
    const fn = vi.fn();
    s.subscribe(fn);
    s.set(2);
    s.set(2);
    s.update((v) => v + 1);
    expect(fn.mock.calls).toEqual([[2], [3]]);
    expect(s.get()).toBe(3);
  });
  it('stops notifying after unsubscribe', () => {
    const s = signal('a');
    const fn = vi.fn();
    const off = s.subscribe(fn);
    off();
    s.set('b');
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('effect', () => {
  it('runs immediately and on every dependency change until stopped', () => {
    const a = signal(1);
    const b = signal(1);
    const fn = vi.fn();
    const stop = effect([a, b], fn);
    a.set(2);
    b.set(2);
    stop();
    a.set(3);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
```

`tests/state/settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, STORAGE_KEY, loadSettings, parseSettings, saveSettings } from '../../src/state/settings';

describe('parseSettings', () => {
  it('returns defaults for missing input', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.format).toBe('9:16');
    expect(DEFAULT_SETTINGS.loops).toBe(2);
  });
  it('keeps valid values', () => {
    const custom = { ...DEFAULT_SETTINGS, size: 40, motion: 'wave', format: '4:5', speed: 2.5, loops: 5, removeFront: true, color: '#00FF00' };
    expect(parseSettings(custom)).toEqual(custom);
  });
  it('replaces invalid or out-of-range values with defaults', () => {
    const parsed = parseSettings({ format: '21:9', speed: 'fast', size: 500, color: 'red', motion: 'motion1', loops: 0, imgMask: 'yes' });
    expect(parsed).toEqual(DEFAULT_SETTINGS);
  });
  it('normalises colours and snaps to slider steps', () => {
    expect(parseSettings({ color: 'ff00aa' }).color).toBe('#FF00AA');
    expect(parseSettings({ speed: 2.3 }).speed).toBe(2.5);
    expect(parseSettings({ size: 40.4 }).size).toBe(40);
  });
});

describe('load / save', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  };
  it('round-trips through storage', () => {
    const store = memory();
    saveSettings({ ...DEFAULT_SETTINGS, loops: 7 }, store);
    expect(loadSettings(store).loops).toBe(7);
  });
  it('survives broken JSON, throwing storage and missing storage', () => {
    expect(loadSettings({ getItem: () => '{nope' })).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings({ getItem: () => { throw new Error('blocked'); } })).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(DEFAULT_SETTINGS, { setItem: () => { throw new Error('full'); } })).not.toThrow();
  });
  it('uses the v2 key only', () => {
    expect(STORAGE_KEY).toBe('strata:v2');
    expect(loadSettings({ getItem: (k: string) => (k === 'pixelToolSettings' ? '{"aspectRatio":"original"}' : null) }).format).toBe('9:16');
  });
});
```

`tests/util/color.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hslToHex, normalizeHex, pickFromWheel } from '../../src/util/color';

describe('normalizeHex', () => {
  it('accepts six hex digits with or without #', () => {
    expect(normalizeHex('#abc123')).toBe('#ABC123');
    expect(normalizeHex(' ABC123 ')).toBe('#ABC123');
  });
  it('rejects anything else', () => {
    expect(normalizeHex('#fff')).toBeNull();
    expect(normalizeHex('red')).toBeNull();
    expect(normalizeHex('#12345G')).toBeNull();
  });
});

describe('hslToHex', () => {
  it('converts primaries and greys', () => {
    expect(hslToHex(0, 100, 50)).toBe('#FF0000');
    expect(hslToHex(120, 100, 50)).toBe('#00FF00');
    expect(hslToHex(90, 100, 50)).toBe('#80FF00');
    expect(hslToHex(0, 0, 100)).toBe('#FFFFFF');
  });
});

describe('pickFromWheel', () => {
  it('centre halves pick black (left) and white (right)', () => {
    expect(pickFromWheel(-5, 0, 100, 100).hex).toBe('#000000');
    expect(pickFromWheel(5, 0, 100, 100).hex).toBe('#FFFFFF');
    expect(pickFromWheel(5, 0, 100, 100).hue).toBeNull();
  });
  it('the rim is fully saturated; outside is clamped to the rim', () => {
    expect(pickFromWheel(100, 0, 100, 100).hex).toBe('#FF0000');
    const outside = pickFromWheel(200, 0, 100, 100);
    expect(outside.hex).toBe('#FF0000');
    expect(outside.cursor).toEqual({ x: 100, y: 0 });
  });
  it('brightness scales lightness', () => {
    expect(pickFromWheel(100, 0, 100, 0).hex).toBe('#000000');
  });
});
```

`tests/util/array.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { moveItem } from '../../src/util/array';

describe('moveItem', () => {
  const list = ['a', 'b', 'c'] as const;
  it('moves forward and backward', () => {
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(list, 2, 0)).toEqual(['c', 'a', 'b']);
  });
  it('clamps the target and ignores invalid sources', () => {
    expect(moveItem(list, 0, 99)).toEqual(['b', 'c', 'a']);
    expect(moveItem(list, 5, 0)).toEqual(['a', 'b', 'c']);
  });
  it('never mutates the input', () => {
    moveItem(list, 0, 2);
    expect(list).toEqual(['a', 'b', 'c']);
  });
});
```

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npm test`
Expected: FAIL (Module fehlen)

- [ ] **Step 3: `src/state/signal.ts` implementieren**

```ts
export interface Signal<T> {
  get(): T;
  set(value: T): void;
  update(fn: (value: T) => T): void;
  subscribe(fn: (value: T) => void): () => void;
}

export function signal<T>(initial: T): Signal<T> {
  let value = initial;
  const subscribers = new Set<(value: T) => void>();
  const set = (next: T) => {
    if (Object.is(next, value)) return;
    value = next;
    for (const fn of [...subscribers]) fn(value);
  };
  return {
    get: () => value,
    set,
    update: (fn) => set(fn(value)),
    subscribe(fn) {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
  };
}

/** Runs `fn` now and whenever one of `deps` changes. Returns a stop function. */
export function effect(deps: readonly Signal<unknown>[], fn: () => void): () => void {
  fn();
  const stops = deps.map((d) => d.subscribe(() => fn()));
  return () => stops.forEach((stop) => stop());
}
```

- [ ] **Step 4: `src/util/color.ts` und `src/util/array.ts` implementieren**

`src/util/color.ts`:

```ts
export function normalizeHex(input: string): string | null {
  const hex = `#${input.trim().replace(/^#/, '')}`.toUpperCase();
  return /^#[0-9A-F]{6}$/.test(hex) ? hex : null;
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360;
  s /= 100;
  l /= 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

export function hslToHex(h: number, s: number, l: number): string {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

/** Inner radius (as a share of the wheel radius) of the black/white centre. */
export const WHEEL_INNER = 0.3;

export interface WheelPick {
  hex: string;
  hue: number | null;
  saturation: number | null;
  /** Cursor position relative to the wheel centre. */
  cursor: { x: number; y: number };
}

/** Colour under (dx, dy) relative to the wheel centre. brightness 0–100 (100 = pure hue). */
export function pickFromWheel(dx: number, dy: number, radius: number, brightness: number): WheelPick {
  const inner = radius * WHEEL_INNER;
  const dist = Math.hypot(dx, dy);
  if (dist <= inner) {
    const left = dx < 0;
    return { hex: left ? '#000000' : '#FFFFFF', hue: null, saturation: null, cursor: { x: (left ? -1 : 1) * radius * 0.15, y: 0 } };
  }
  const clamped = Math.min(dist, radius);
  const k = clamped / dist;
  let hue = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (hue < 0) hue += 360;
  const saturation = Math.min(100, ((clamped - inner) / (radius - inner)) * 100);
  return { hex: hslToHex(hue, saturation, brightness / 2), hue, saturation, cursor: { x: dx * k, y: dy * k } };
}
```

`src/util/array.ts`:

```ts
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = list.slice();
  if (from < 0 || from >= out.length) return out;
  const [item] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(to, out.length)), 0, item);
  return out;
}
```

- [ ] **Step 5: `src/state/settings.ts` implementieren**

```ts
import { FORMAT_IDS, MOTION_IDS, type Settings } from '../engine/types';
import { normalizeHex } from '../util/color';

export const STORAGE_KEY = 'strata:v2';

export const DEFAULT_SETTINGS: Settings = {
  size: 80,
  stretch: 0,
  threshold: 35,
  removeFront: false,
  sensitivity: 50,
  color: '#FFFFFF',
  imgMask: false,
  motion: 'buildUp',
  speed: 1,
  loops: 2,
  format: '9:16',
};

export type RangeKey = 'size' | 'stretch' | 'threshold' | 'sensitivity' | 'speed' | 'loops';

export const RANGES: Record<RangeKey, { min: number; max: number; step: number }> = {
  size: { min: 25, max: 100, step: 1 },
  stretch: { min: 0, max: 100, step: 1 },
  threshold: { min: 0, max: 100, step: 1 },
  sensitivity: { min: 10, max: 100, step: 1 },
  speed: { min: 0.5, max: 10, step: 0.5 },
  loops: { min: 1, max: 10, step: 1 },
};

export function parseSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  const ranged = (key: RangeKey): number => {
    const v = r[key];
    const { min, max, step } = RANGES[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) return d[key];
    return Math.round(v / step) * step;
  };
  const bool = (key: 'removeFront' | 'imgMask'): boolean => (typeof r[key] === 'boolean' ? (r[key] as boolean) : d[key]);
  const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
    (options as readonly unknown[]).includes(v) ? (v as T) : fallback;

  return {
    size: ranged('size'),
    stretch: ranged('stretch'),
    threshold: ranged('threshold'),
    removeFront: bool('removeFront'),
    sensitivity: ranged('sensitivity'),
    color: (typeof r.color === 'string' && normalizeHex(r.color)) || d.color,
    imgMask: bool('imgMask'),
    motion: oneOf(r.motion, MOTION_IDS, d.motion),
    speed: ranged('speed'),
    loops: ranged('loops'),
    format: oneOf(r.format, FORMAT_IDS, d.format),
  };
}

function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadSettings(storage: Pick<Storage, 'getItem'> | null = browserStorage()): Settings {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    return parseSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings, storage: Pick<Storage, 'setItem'> | null = browserStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or blocked (private mode): settings just won't persist.
  }
}
```

- [ ] **Step 6: `src/state/store.ts` implementieren** (reine Verdrahtung, deshalb kein eigener Test. Wird in Task 7 über `images.test.ts` mitgetestet.)

```ts
import { randomSeed } from '../engine/rng';
import type { Settings } from '../engine/types';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings';
import { signal } from './signal';

export interface ImageEntry {
  id: string;
  name: string;
  bitmap: ImageBitmap;
  thumbUrl: string;
}

export type ToolId =
  | 'size' | 'stretch' | 'threshold' | 'remove' | 'color' | 'imgMask'
  | 'motion' | 'speed' | 'loops' | 'format' | 'reset';

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

export function patchSettings(patch: Partial<Settings>): void {
  settings.update((s) => ({ ...s, ...patch }));
}

export function resetSettings(): void {
  settings.set({ ...DEFAULT_SETTINGS });
}

settings.subscribe((s) => saveSettings(s));
```

- [ ] **Step 7: Tests laufen lassen, sie müssen grün sein**

Run: `npm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/state src/util tests/state tests/util
git commit -m "feat(state): add signals, validated settings, store and colour utils"
```

---

### Task 7: App-Shell, Vorschau, Upload und Leerzustand

Diese Task baut das komplette Markup und **alle** Stylesheets. Einige Klassen (Werkzeugleiste, Dialog, Clips) werden erst in späteren Tasks benutzt. So muss niemand später CSS-Fragmente in fremde Dateien einflicken.

**Files:**
- Replace: `index.html`, `src/main.ts`
- Create: `src/styles/tokens.css`, `src/styles/layout.css`, `src/styles/components.css`, `src/engine/raster.ts`, `src/engine/analysisCache.ts`, `src/ui/dom.ts`, `src/ui/toast.ts`, `src/ui/scene.ts`, `src/ui/images.ts`, `src/ui/preview.ts`, `src/dev/testImage.ts`
- Test: `tests/ui/images.test.ts`

**Interfaces:**
- Consumes: Engine (`render.ts`, `analyze.ts`, `formats.ts`, `draw.ts`), Store, `moveItem`
- Produces:
  - `raster.ts`: `rasterize(img: ImageBitmap, size: Size, fit: Fit): PixelData`
  - `analysisCache.ts`: `class AnalysisCache { layer(id, bitmap, size, fit, settings): ImageLayer; forget(id): void }`
  - `ui/dom.ts`: `h(tag, attrs?, ...children)`
  - `ui/toast.ts`: `toast(message, kind?: 'info' | 'error')`
  - `ui/scene.ts`: `buildScene(): Scene | null`, `forgetImage(id): void`
  - `ui/images.ts`: `addImageFiles(files: Iterable<File>): Promise<void>`, `removeImage(index)`, `moveImage(from, to)`
  - `ui/preview.ts`: `PreviewApi { currentTime(): number | null }`, `mountPreview(root, pickFiles): PreviewApi`
  - DOM-IDs: `preview`, `previewCanvas`, `sidebar`, `transport`, `clips`, `panel`, `toolbar`, `exportBtnTop`, `exportDialog`, `toasts`, `fileInput`
  - `dev/testImage.ts`: `makeTestImage(accent = '#b33', width = 1200, height = 1600): Promise<File>` (synthetisches Foto für Browser-Checks)
  - Dev-Hook (nur `import.meta.env.DEV`, fällt im Build weg): `window.__strata = { addImageFiles, buildScene, loadTestImage(accent?, width?, height?), patchSettings }`. Ab Task 8 kommt `exportVideo` dazu.

- [ ] **Step 1: Failing Test schreiben** – `tests/ui/images.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { images, patchSettings, playing, selected, settings, type ImageEntry } from '../../src/state/store';
import { moveImage, removeImage } from '../../src/ui/images';

const entry = (id: string): ImageEntry => ({
  id,
  name: `${id}.png`,
  bitmap: { width: 10, height: 10, close() {} } as unknown as ImageBitmap,
  thumbUrl: `blob:${id}`,
});
const ids = () => images.get().map((i) => i.id);

beforeEach(() => {
  images.set([entry('a'), entry('b'), entry('c')]);
  selected.set(2);
  playing.set(true);
  patchSettings({ imgMask: true });
});

describe('removeImage', () => {
  it('keeps the selection inside the list', () => {
    removeImage(2);
    expect(ids()).toEqual(['a', 'b']);
    expect(selected.get()).toBe(1);
    expect(playing.get()).toBe(true);
  });
  it('switches IMG MASK off below two clips', () => {
    removeImage(0);
    expect(settings.get().imgMask).toBe(true);
    removeImage(0);
    expect(settings.get().imgMask).toBe(false);
  });
  it('stops playback when the last clip goes', () => {
    removeImage(0);
    removeImage(0);
    removeImage(0);
    expect(images.get()).toEqual([]);
    expect(playing.get()).toBe(false);
    expect(selected.get()).toBe(0);
  });
  it('ignores indices outside the list', () => {
    removeImage(7);
    expect(ids()).toEqual(['a', 'b', 'c']);
  });
});

describe('moveImage', () => {
  it('reorders and keeps the moved clip selected', () => {
    moveImage(0, 2);
    expect(ids()).toEqual(['b', 'c', 'a']);
    expect(selected.get()).toBe(2);
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npm test -- tests/ui/images.test.ts`
Expected: FAIL (`src/ui/images` fehlt)

- [ ] **Step 3: `src/ui/dom.ts` und `src/ui/toast.ts` implementieren**

`src/ui/dom.ts`:

```ts
type Child = Node | string | null | undefined | false;
type AttrValue = string | number | boolean | ((e: never) => void) | undefined;

/** Tiny element factory: attributes, `on*` listeners and children in one call. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, AttrValue> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (typeof value === 'function') el.addEventListener(key.slice(2), value as EventListener);
    else if (key === 'class') el.className = String(value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) if (child !== null && child !== undefined && child !== false) el.append(child);
  return el;
}
```

`src/ui/toast.ts`:

```ts
import { h } from './dom';

export function toast(message: string, kind: 'info' | 'error' = 'info'): void {
  const host = document.getElementById('toasts');
  if (!host) return;
  const el = h('div', { class: `toast toast--${kind}`, role: kind === 'error' ? 'alert' : 'status' }, message);
  host.append(el);
  setTimeout(() => el.remove(), 4000);
}
```

- [ ] **Step 4: `src/engine/raster.ts` und `src/engine/analysisCache.ts` implementieren**

`src/engine/raster.ts`:

```ts
import type { PixelData } from './analyze';
import { drawFitted } from './draw';
import type { Fit, Size } from './types';

/** Draws the image the way the output frame shows it and returns its pixels. */
export function rasterize(img: ImageBitmap, size: Size, fit: Fit): PixelData {
  const canvas = new OffscreenCanvas(size.width, size.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas is not available.');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size.width, size.height);
  drawFitted(ctx, img, size.width, size.height, fit);
  const { data, width, height } = ctx.getImageData(0, 0, size.width, size.height);
  return { data, width, height };
}
```

`src/engine/analysisCache.ts`:

```ts
import { barGrid, buildForegroundMask, gridBars, maskSize, selectStrokeBars, type ForegroundMask, type PixelData } from './analyze';
import { rasterize } from './raster';
import type { ImageLayer } from './render';
import type { Fit, Settings, Size } from './types';

interface Entry {
  pixelsKey: string;
  full: PixelData;
  small: PixelData;
  maskKey?: string;
  mask?: ForegroundMask;
  barsKey?: string;
  layer?: ImageLayer;
}

/**
 * Staged cache per image: pixels (format) → mask (sensitivity) → bars (size, stretch,
 * threshold, side). A slider only recomputes the stages after it.
 */
export class AnalysisCache {
  private entries = new Map<string, Entry>();

  layer(id: string, bitmap: ImageBitmap, size: Size, fit: Fit, s: Settings): ImageLayer {
    const pixelsKey = `${size.width}x${size.height}:${fit}`;
    let e = this.entries.get(id);
    if (!e || e.pixelsKey !== pixelsKey) {
      e = { pixelsKey, full: rasterize(bitmap, size, fit), small: rasterize(bitmap, maskSize(size.width, size.height), fit) };
      this.entries.set(id, e);
    }
    const maskKey = String(s.sensitivity);
    if (!e.mask || e.maskKey !== maskKey) {
      e.mask = buildForegroundMask(e.small, s.sensitivity);
      e.maskKey = maskKey;
      e.barsKey = undefined;
    }
    const barsKey = `${s.size}:${s.stretch}:${s.threshold}:${s.removeFront}`;
    if (!e.layer || e.barsKey !== barsKey) {
      const grid = barGrid(size.width, size.height, s.size, s.stretch);
      e.layer = {
        bitmap,
        gridBars: gridBars(size.width, size.height, grid),
        strokeBars: selectStrokeBars(e.full, e.mask, grid, s.threshold, s.removeFront),
      };
      e.barsKey = barsKey;
    }
    return e.layer;
  }

  forget(id: string): void {
    this.entries.delete(id);
  }
}
```

- [ ] **Step 5: `src/ui/scene.ts` und `src/ui/images.ts` implementieren**

`src/ui/scene.ts`:

```ts
import { AnalysisCache } from '../engine/analysisCache';
import { fitFor, outputSize } from '../engine/formats';
import type { Scene } from '../engine/render';
import { images, seed, settings } from '../state/store';

const cache = new AnalysisCache();

/** Current scene from the store, or null without clips. Analysis results are cached. */
export function buildScene(): Scene | null {
  const list = images.get();
  if (list.length === 0) return null;
  const s = settings.get();
  const size = outputSize(s.format, list[0].bitmap);
  if (!size) return null;
  const fit = fitFor(s.format);
  return {
    width: size.width,
    height: size.height,
    fit,
    settings: s,
    seed: seed.get(),
    layers: list.map((img) => cache.layer(img.id, img.bitmap, size, fit, s)),
  };
}

export function forgetImage(id: string): void {
  cache.forget(id);
}
```

`src/ui/images.ts`:

```ts
import { images, patchSettings, playing, selected, settings, type ImageEntry } from '../state/store';
import { moveItem } from '../util/array';
import { forgetImage } from './scene';
import { toast } from './toast';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
let nextId = 0;

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(file); // older engines reject the options bag
  }
}

export async function addImageFiles(files: Iterable<File>): Promise<void> {
  const added: ImageEntry[] = [];
  for (const file of files) {
    if (!ACCEPTED.includes(file.type)) {
      toast(`${file.name}: please use PNG, JPG or WEBP`, 'error');
      continue;
    }
    try {
      const bitmap = await decode(file);
      added.push({ id: `img${++nextId}`, name: file.name, bitmap, thumbUrl: URL.createObjectURL(file) });
    } catch {
      toast(`${file.name} could not be loaded`, 'error');
    }
  }
  if (added.length) images.update((list) => [...list, ...added]);
}

export function removeImage(index: number): void {
  const list = images.get();
  const entry = list[index];
  if (!entry) return;
  const next = list.filter((_, i) => i !== index);
  images.set(next);
  selected.set(Math.min(selected.get(), Math.max(0, next.length - 1)));
  if (next.length === 0) playing.set(false);
  if (next.length < 2 && settings.get().imgMask) patchSettings({ imgMask: false });
  // Release resources only after the store no longer references the clip.
  forgetImage(entry.id);
  URL.revokeObjectURL(entry.thumbUrl);
  entry.bitmap.close();
}

export function moveImage(from: number, to: number): void {
  const list = images.get();
  const item = list[from];
  if (!item) return;
  const next = moveItem(list, from, to);
  images.set(next);
  selected.set(next.indexOf(item));
}
```

- [ ] **Step 6: Test laufen lassen, er muss grün sein**

Run: `npm test -- tests/ui/images.test.ts`
Expected: PASS

- [ ] **Step 7: `src/ui/preview.ts` implementieren**

```ts
import { renderFrame, renderStill, sceneDuration, type Scene } from '../engine/render';
import { effect } from '../state/signal';
import { images, playing, seed, selected, settings, shownClip } from '../state/store';
import { h } from './dom';
import { addImageFiles } from './images';
import { buildScene } from './scene';

export interface PreviewApi {
  /** Animation time currently on screen, or null while paused. */
  currentTime(): number | null;
}

const PAD = 16;

export function mountPreview(root: HTMLElement, pickFiles: () => void): PreviewApi {
  const canvas = root.querySelector('canvas');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) throw new Error('#preview needs a <canvas>');

  let scene: Scene | null = null;
  let dirty = true;
  let raf = 0;
  let startedAt = 0;
  let lastT: number | null = null;
  let empty: HTMLElement | null = null;

  const fitCanvas = () => {
    if (!scene) return;
    const box = root.getBoundingClientRect();
    const scale = Math.min((box.width - PAD * 2) / scene.width, (box.height - PAD * 2) / scene.height);
    const cssW = Math.max(1, Math.floor(scene.width * scale));
    const cssH = Math.max(1, Math.floor(scene.height * scale));
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

  const draw = (now: number) => {
    raf = 0;
    if (dirty) {
      scene = buildScene();
      dirty = false;
      fitCanvas();
    }
    if (!scene) {
      lastT = null;
      return;
    }
    // Render in output coordinates, scaled down to the preview size.
    const k = canvas.width / scene.width;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (playing.get()) {
      const t = ((now - startedAt) / 1000) % sceneDuration(scene);
      lastT = t;
      shownClip.set(renderFrame(ctx, scene, t));
      raf = requestAnimationFrame(draw);
    } else {
      lastT = null;
      renderStill(ctx, scene, selected.get());
    }
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(draw);
  };
  const invalidate = () => {
    dirty = true;
    schedule();
  };

  effect([settings, images, seed], invalidate);
  selected.subscribe(schedule);
  playing.subscribe((on) => {
    if (on) startedAt = performance.now();
    schedule();
  });
  new ResizeObserver(invalidate).observe(root);

  // Empty state lives in the DOM only while there are no clips – nothing can shine through later.
  effect([images], () => {
    const hasImages = images.get().length > 0;
    canvas.hidden = !hasImages;
    if (hasImages) {
      empty?.remove();
      empty = null;
    } else if (!empty) {
      empty = h('div', { class: 'empty' },
        h('button', { class: 'btn btn--pill', type: 'button', onclick: pickFiles }, '+ UPLOAD IMAGE'),
        h('span', { class: 'empty__hint' }, 'PNG · JPG · WEBP'));
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
    if (e.dataTransfer?.files.length) void addImageFiles([...e.dataTransfer.files]);
  });

  return { currentTime: () => lastT };
}
```

- [ ] **Step 8: `index.html` ersetzen**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#141414">
  <title>Strata</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
</head>
<body>
  <div class="app">
    <header class="topbar">
      <span class="logo">STRATA</span>
      <button id="exportBtnTop" class="btn btn--solid btn--pill" type="button" disabled>EXPORT</button>
    </header>
    <aside class="sidebar" id="sidebar" aria-label="Settings"></aside>
    <main class="stage">
      <div class="preview" id="preview"><canvas id="previewCanvas" hidden></canvas></div>
      <div class="transport" id="transport" hidden></div>
      <div class="clips" id="clips" hidden></div>
    </main>
    <section class="panel" id="panel" aria-label="Active tool"></section>
    <nav class="toolbar" id="toolbar" aria-label="Tools"></nav>
  </div>
  <dialog class="export" id="exportDialog" aria-label="Export"></dialog>
  <div class="toasts" id="toasts"></div>
  <input type="file" id="fileInput" accept="image/png,image/jpeg,image/webp" multiple hidden>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 9: Stylesheets anlegen**

`src/styles/tokens.css`:

```css
:root {
  color-scheme: dark;
  --bg: #141414;
  --surface: #1b1b1b;
  --surface-2: #232323;
  --surface-3: #2c2c2c;
  --stage: #0c0c0c;
  --line: #262626;
  --line-strong: #444;
  --text: #fff;
  --text-2: #bbb;
  --text-3: #888;
  --text-4: #555;
  --warn: #ff8a73;
  --radius-s: 8px;
  --radius-m: 12px;
  --radius-pill: 999px;
  --font: Arial, Helvetica, sans-serif;
  --mono: ui-monospace, Menlo, Consolas, monospace;
  --label: 10px;
  --sidebar-w: 280px;
  --gutter: 16px;
}
```

`src/styles/layout.css`:

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
}
[hidden] { display: none !important; }

.app {
  height: 100dvh;
  display: grid;
  grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
  grid-template-areas: "sidebar stage";
}

.topbar, .panel, .toolbar { display: none; }

.sidebar {
  grid-area: sidebar;
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px var(--gutter);
  background: var(--surface);
  border-right: 1px solid var(--line);
  overflow-y: auto;
}

.stage {
  grid-area: stage;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.preview {
  position: relative;
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  background: var(--stage);

  & canvas { display: block; box-shadow: 0 0 0 1px var(--line); }
  &.dragover { outline: 2px dashed var(--text); outline-offset: -12px; }
}

@media (width <= 768px) {
  .app {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto auto;
    grid-template-areas: "topbar" "stage" "panel" "toolbar";
    padding-top: env(safe-area-inset-top);
  }
  .sidebar { display: none; }
  .topbar { grid-area: topbar; display: flex; }
  .panel { grid-area: panel; display: block; }
  .toolbar { grid-area: toolbar; display: flex; padding-bottom: max(6px, env(safe-area-inset-bottom)); }
}
```

`src/styles/components.css`:

```css
/* ---------- buttons ---------- */
.btn {
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--text);
  background: transparent;
  border: 1.5px solid var(--text);
  border-radius: var(--radius-s);
  padding: 9px 12px;
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;

  &:disabled { opacity: .35; cursor: default; }
  &[aria-pressed="true"] { background: var(--text); color: #000; }
}
.btn--solid { background: var(--text); color: #000; }
.btn--pill { border-radius: var(--radius-pill); }
.btn--ghost { border-color: var(--line-strong); color: var(--text-2); }
.btn--icon { min-width: 38px; padding: 0; font-size: 15px; }

:is(.btn, .tool, .clip, .dd__option, .swatch, .transport button):focus-visible {
  outline: 2px solid var(--text);
  outline-offset: 2px;
}

/* ---------- fields ---------- */
.field { display: flex; flex-direction: column; gap: 8px; }
.field__label {
  display: flex;
  justify-content: space-between;
  font-size: var(--label);
  font-weight: 700;
  letter-spacing: .08em;
  color: var(--text-3);
}
.field__value { color: var(--text); font-variant-numeric: tabular-nums; }
.row { display: flex; gap: 8px; & > .btn:first-child { flex: 1; } }

/* ---------- range ---------- */
.range {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 24px;
  background: transparent;
  cursor: pointer;
}
.range::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(var(--text), var(--text)) 0 / var(--fill, 0%) 100% no-repeat, var(--surface-3);
}
.range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  margin-top: -7px;
  border-radius: 50%;
  background: var(--text);
  border: 0;
}
.range::-moz-range-track { height: 4px; border-radius: 2px; background: var(--surface-3); }
.range::-moz-range-progress { height: 4px; border-radius: 2px; background: var(--text); }
.range::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: var(--text); border: 0; }

/* ---------- stepper ---------- */
.stepper { display: flex; align-items: center; gap: 12px; }
.stepper__btn { width: 38px; padding: 0; font-size: 16px; }
.stepper__value { min-width: 3ch; text-align: center; font-weight: 700; font-variant-numeric: tabular-nums; }

/* ---------- colour ---------- */
.color { display: flex; gap: 8px; align-items: center; }
.hex {
  flex: 1;
  min-width: 0;
  font-family: var(--mono);
  font-size: 12px;
  text-transform: uppercase;
  color: var(--text);
  background: var(--surface-2);
  border: 1.5px solid var(--line-strong);
  border-radius: var(--radius-s);
  padding: 9px 10px;
}
.swatch {
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1.5px solid var(--text);
  background: var(--swatch, #fff);
  cursor: pointer;
}
.wheel { display: flex; flex-direction: column; gap: 10px; width: 220px; }
.wheel canvas { width: 200px; height: 200px; align-self: center; touch-action: none; cursor: crosshair; }

/* ---------- popovers & dropdown ---------- */
.popover {
  position: fixed;
  inset: auto;
  margin: 0;
  color: var(--text);
  background: var(--surface-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-m);
  padding: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, .6);
}
.dd__button { width: 100%; justify-content: flex-start; }
.dd__detail { color: var(--text-3); font-weight: 400; }
.dd__caret { margin-left: auto; font-size: 9px; }
.dd__list { padding: 4px; min-width: 220px; display: flex; flex-direction: column; gap: 2px; }
.dd__option {
  display: grid;
  grid-template-columns: 12px 16px 1fr auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 11px 8px;
  border: 0;
  border-radius: var(--radius-s);
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .05em;
  text-align: left;
  cursor: pointer;

  &:hover { background: var(--surface-3); }
  &[aria-selected="true"] { background: var(--text); color: #000; }
  &[aria-selected="true"] :is(.dd__detail, .dd__icon) { color: #555; }
}
.dd__icon { color: var(--text-2); text-align: center; }

/* ---------- sidebar ---------- */
.sidebar__logo { font-weight: 700; letter-spacing: .14em; font-size: 13px; }
.group { display: flex; flex-direction: column; gap: 14px; }
.group__label { font-size: 9px; font-weight: 700; letter-spacing: .14em; color: var(--text-4); }
.group--actions { margin-top: auto; }
.sidebar__export { width: 100%; }

/* ---------- transport ---------- */
.transport {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-top: 1px solid var(--line);
  font-size: 11px;
  color: var(--text-2);
}
.transport__play {
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 0;
  background: var(--text);
  color: #000;
  font-size: 11px;
  cursor: pointer;
}
.transport__motion, .transport__shuffle {
  background: none;
  border: 0;
  color: var(--text-2);
  font: inherit;
  font-weight: 700;
  letter-spacing: .05em;
  padding: 6px 4px;
  cursor: pointer;
}
.transport__shuffle { font-size: 15px; }
.transport__info { margin-left: auto; font-variant-numeric: tabular-nums; }

/* ---------- clip strip ---------- */
.clips {
  display: flex;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--line);
  overflow-x: auto;
  touch-action: pan-x;
  scrollbar-width: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
.clips::-webkit-scrollbar { display: none; }
.clip {
  position: relative;
  flex: none;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-s);
  background: var(--surface-2);
  cursor: pointer;

  & img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; display: block; pointer-events: none; }
  &.is-current { outline: 2px solid var(--text); outline-offset: 1px; }
  &.is-dragging { z-index: 2; opacity: .85; scale: 1.08; }
}
.clip__remove {
  position: absolute;
  top: -7px;
  right: -7px;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 50%;
  background: var(--text);
  color: #000;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
}
.clip--add {
  display: grid;
  place-items: center;
  border: 1px dashed var(--line-strong);
  background: transparent;
  color: var(--text-2);
  font-size: 20px;
}

/* ---------- mobile panel & toolbar ---------- */
.panel { padding: 12px var(--gutter) 14px; border-top: 1px solid var(--line); min-height: 84px; }
.toolbar {
  gap: 4px;
  padding: 6px 8px;
  overflow-x: auto;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
  background: var(--surface);
  border-top: 1px solid var(--line);
}
.toolbar::-webkit-scrollbar { display: none; }
.tool {
  flex: none;
  scroll-snap-align: start;
  width: 62px;
  min-height: 58px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  background: none;
  border: 0;
  border-radius: var(--radius-m);
  color: var(--text-3);
  font: inherit;
  font-size: 9px;
  letter-spacing: .05em;
  text-transform: uppercase;
  cursor: pointer;

  &.is-active { color: var(--text); background: var(--surface-3); }
}
.tool__icon {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border: 1.5px solid currentColor;
  border-radius: 7px;
  font-size: 13px;
}
.topbar { align-items: center; justify-content: space-between; padding: 8px 14px; }
.logo { font-weight: 700; letter-spacing: .14em; font-size: 12px; }

/* ---------- empty state ---------- */
.empty { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.empty__hint { color: var(--text-3); font-size: 11px; letter-spacing: .08em; }
.is-empty :is(.toolbar, .sidebar > .group) { opacity: .35; }
.is-empty .panel { visibility: hidden; }

/* ---------- export dialog ---------- */
.export {
  margin: auto;
  width: min(420px, calc(100% - 32px));
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: 14px;
  padding: 18px;

  &::backdrop { background: rgba(0, 0, 0, .6); }
}
.export__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .12em;
}
.export__close { background: none; border: 0; color: var(--text-2); font-size: 22px; cursor: pointer; }
.segmented { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 12px; }
.export__info { font-size: 11px; color: var(--text-2); margin-bottom: 14px; font-variant-numeric: tabular-nums; }
.export__notice { font-size: 11px; color: var(--warn); margin-bottom: 12px; line-height: 1.4; }
.export__file { font-size: 11px; color: var(--text-2); word-break: break-all; }
.export__actions { display: flex; flex-direction: column; gap: 8px; & .btn { width: 100%; } }
.progress {
  height: 6px;
  border-radius: 3px;
  background: var(--surface-3);
  overflow: hidden;

  & > i { display: block; height: 100%; width: var(--p, 0%); background: var(--text); }
}

/* ---------- toasts ---------- */
.toasts {
  position: fixed;
  left: 50%;
  translate: -50% 0;
  bottom: calc(16px + env(safe-area-inset-bottom));
  width: min(420px, calc(100% - 32px));
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 10;
  pointer-events: none;
}
.toast {
  background: var(--surface-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-m);
  padding: 10px 14px;
  font-size: 12px;
}
.toast--error { border-color: var(--warn); }

@media (width <= 768px) {
  .clip { width: 40px; height: 40px; }
  .clips { padding: 8px 14px; }
  .dd__caret { rotate: 180deg; }
  .toasts { bottom: calc(160px + env(safe-area-inset-bottom)); }
}
```

- [ ] **Step 10: Dev-Testbild und `src/main.ts`**

`src/dev/testImage.ts` (wird nur vom Dev-Hook importiert und fällt im Production-Build per Tree-Shaking weg):

```ts
/** A synthetic "photo" – light backdrop, dark subject, coloured accent – for browser checks. */
export async function makeTestImage(accent = '#b33', width = 1200, height = 1600): Promise<File> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available.');
  ctx.fillStyle = '#e8e4dc';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.ellipse(width / 2, height * 0.59, width * 0.275, height * 0.325, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(width * 0.35, height * 0.325, width * 0.3, height * 0.15);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new File([blob], `test-${accent.replace('#', '')}.png`, { type: 'image/png' });
}
```

`src/main.ts` ersetzen:

```ts
import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';
import { makeTestImage } from './dev/testImage';
import { effect } from './state/signal';
import { images, patchSettings } from './state/store';
import { addImageFiles } from './ui/images';
import { mountPreview } from './ui/preview';
import { buildScene } from './ui/scene';

const byId = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing in index.html`);
  return el as T;
};

const fileInput = byId<HTMLInputElement>('fileInput');
const pickFiles = (): void => fileInput.click();
fileInput.addEventListener('change', () => {
  if (fileInput.files?.length) void addImageFiles([...fileInput.files]);
  fileInput.value = '';
});
// Dropping a file outside the preview must not navigate away from the app.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

mountPreview(byId('preview'), pickFiles);

effect([images], () => {
  document.body.classList.toggle('is-empty', images.get().length === 0);
});

if (import.meta.env.DEV) {
  const loadTestImage = async (accent?: string, width?: number, height?: number) =>
    addImageFiles([await makeTestImage(accent, width, height)]);
  Object.assign(window, { __strata: { addImageFiles, buildScene, loadTestImage, patchSettings } });
}
```

- [ ] **Step 11: Typecheck, Tests, Build**

```bash
npx tsc --noEmit && npm test && npm run build
```

Expected: keine Typfehler, alle Tests PASS, Build erfolgreich.

- [ ] **Step 12: Im Browser prüfen**

`preview_start { name: "strata" }`. Dann per `javascript_tool` (Testbild ohne Datei-Dialog):

```js
const before = !!document.querySelector('.empty');
await window.__strata.loadTestImage();
await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
({ before, emptyAfter: !!document.querySelector('.empty'), canvasHidden: document.getElementById('previewCanvas').hidden, size: [window.__strata.buildScene().width, window.__strata.buildScene().height] })
```

Expected: `{ before: true, emptyAfter: false, canvasHidden: false, size: [1080, 1920] }`. Screenshot zeigt die weißen Balken auf der dunklen Ellipse in 9:16. `read_console_messages` mit `onlyErrors: true` ist leer. Danach `resize_window { preset: "mobile" }`, neu laden, Screenshot: Top-Bar mit ausgegrautem EXPORT, „+ UPLOAD IMAGE“ zentriert. Zum Schluss `resize_window { preset: "desktop" }`.

- [ ] **Step 13: Commit**

```bash
git add index.html src tests
git commit -m "feat(ui): app shell, preview, upload and empty state"
```

---

### Task 8: Export – Mediabunny-Worker, PNG, Export-Dialog

**Files:**
- Create: `src/export/protocol.ts`, `src/export/video.worker.ts`, `src/export/video.ts`, `src/export/image.ts`, `src/export/save.ts`, `src/export/capability.ts`, `src/ui/exportDialog.ts`
- Replace: `src/main.ts`
- Test: `tests/export/fileName.test.ts`

**Interfaces:**
- Consumes: `Scene`, `renderFrame`, `renderStill`, `sceneDuration` (render.ts), `frameCount`, `FPS`, `totalDuration` (timeline.ts), `buildScene` (ui/scene.ts), `PreviewApi` (ui/preview.ts), Store (`exporting`, `playing`, `selected`, `settings`, `images`)
- Produces:
  - `protocol.ts`: `ToWorker`, `FromWorker`
  - `video.ts`: `class ExportCancelled extends Error`, `VideoJob {result: Promise<Blob>, cancel(): void}`, `exportVideo(scene, onProgress: (v: number) => void): VideoJob`
  - `image.ts`: `exportPng(scene, t: number | null, stillIndex: number): Promise<Blob>`
  - `save.ts`: `exportFileName(format: FormatId, ext: 'mp4' | 'png', date?: Date): string`, `canShare(file)`, `shareFile(file)`, `downloadFile(file)`
  - `capability.ts`: `videoExportSupported(): Promise<boolean>`
  - `exportDialog.ts`: `mountExportDialog(dialog, preview: PreviewApi): { open(): void }`

- [ ] **Step 1: Failing Test schreiben** – `tests/export/fileName.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { exportFileName } from '../../src/export/save';

describe('exportFileName', () => {
  const when = new Date(2026, 8, 28, 14, 32);
  it('encodes format and local time', () => {
    expect(exportFileName('9:16', 'mp4', when)).toBe('strata-9x16-20260928-1432.mp4');
    expect(exportFileName('16:9', 'png', when)).toBe('strata-16x9-20260928-1432.png');
    expect(exportFileName('original', 'png', when)).toBe('strata-original-20260928-1432.png');
  });
  it('zero-pads months, days, hours and minutes', () => {
    expect(exportFileName('4:5', 'mp4', new Date(2027, 0, 3, 4, 5))).toBe('strata-4x5-20270103-0405.mp4');
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npm test -- tests/export/fileName.test.ts`
Expected: FAIL (Modul fehlt)

- [ ] **Step 3: `src/export/save.ts` implementieren**

```ts
import type { FormatId } from '../engine/types';

export function exportFileName(format: FormatId, ext: 'mp4' | 'png', date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}`;
  return `strata-${format.replace(':', 'x')}-${stamp}.${ext}`;
}

export function canShare(file: File): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** Must be called from a user gesture (tap on SAVE / SHARE). */
export async function shareFile(file: File): Promise<void> {
  await navigator.share({ files: [file] });
}

export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
```

- [ ] **Step 4: Test laufen lassen, er muss grün sein**

Run: `npm test -- tests/export/fileName.test.ts`
Expected: PASS

- [ ] **Step 5: Protokoll, Worker, `video.ts`, `image.ts`, `capability.ts` implementieren**

`src/export/protocol.ts`:

```ts
import type { Scene } from '../engine/render';

export type ToWorker =
  | { type: 'start'; scene: Scene; fps: number }
  | { type: 'cancel' };

export type FromWorker =
  | { type: 'progress'; value: number }
  | { type: 'done'; buffer: ArrayBuffer; mimeType: string }
  | { type: 'cancelled' }
  | { type: 'error'; message: string };
```

`src/export/video.worker.ts`:

```ts
import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_VERY_HIGH, getFirstEncodableVideoCodec } from 'mediabunny';
import { renderFrame, sceneDuration, type Scene } from '../engine/render';
import { frameCount } from '../engine/timeline';
import type { FromWorker, ToWorker } from './protocol';

let output: Output | null = null;
let cancelled = false;

const post = (msg: FromWorker, transfer: Transferable[] = []): void =>
  (self as unknown as Worker).postMessage(msg, transfer);

self.addEventListener('message', (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  if (msg.type === 'cancel') {
    cancelled = true;
    void output?.cancel();
    return;
  }
  cancelled = false;
  encode(msg.scene, msg.fps).catch((err: unknown) => {
    if (cancelled) post({ type: 'cancelled' });
    else post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  });
});

async function encode(scene: Scene, fps: number): Promise<void> {
  const { width, height } = scene;
  const codec = await getFirstEncodableVideoCodec(['avc', 'hevc'], { width, height });
  if (!codec) throw new Error("This browser can't encode H.264 or HEVC video.");

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available.');

  const out = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  output = out;
  const source = new CanvasSource(canvas, { codec, quality: QUALITY_VERY_HIGH });
  out.addVideoTrack(source, { frameRate: fps });
  await out.start();

  const total = frameCount(sceneDuration(scene), fps);
  for (let f = 0; f < total; f++) {
    if (cancelled) {
      post({ type: 'cancelled' });
      return;
    }
    renderFrame(ctx, scene, f / fps);
    await source.add(f / fps, 1 / fps); // awaiting respects encoder backpressure
    if (f % 10 === 0) post({ type: 'progress', value: f / total });
  }
  await out.finalize();
  output = null;
  const buffer = out.target.buffer;
  if (!buffer) throw new Error('The encoder returned no data.');
  post({ type: 'progress', value: 1 });
  post({ type: 'done', buffer, mimeType: 'video/mp4' }, [buffer]);
}
```

`src/export/video.ts`:

```ts
import type { Scene } from '../engine/render';
import { FPS } from '../engine/timeline';
import type { FromWorker, ToWorker } from './protocol';

export class ExportCancelled extends Error {
  constructor() {
    super('Export cancelled');
  }
}

export interface VideoJob {
  result: Promise<Blob>;
  cancel(): void;
}

export function exportVideo(scene: Scene, onProgress: (value: number) => void): VideoJob {
  const started = performance.now();
  const worker = new Worker(new URL('./video.worker.ts', import.meta.url), { type: 'module' });
  let resolve!: (blob: Blob) => void;
  let reject!: (err: Error) => void;
  const result = new Promise<Blob>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  let settled = false;
  const settle = (fn: () => void) => {
    if (settled) return;
    settled = true;
    worker.terminate();
    fn();
  };

  worker.addEventListener('message', (e: MessageEvent<FromWorker>) => {
    const m = e.data;
    if (m.type === 'progress') onProgress(m.value);
    else if (m.type === 'done') {
      console.info(`[strata] video export took ${Math.round(performance.now() - started)} ms`);
      settle(() => resolve(new Blob([m.buffer], { type: m.mimeType })));
    } else if (m.type === 'cancelled') settle(() => reject(new ExportCancelled()));
    else settle(() => reject(new Error(m.message)));
  });
  worker.addEventListener('error', (e) => settle(() => reject(new Error(e.message || 'The video worker crashed.'))));
  worker.postMessage({ type: 'start', scene, fps: FPS } satisfies ToWorker);

  return {
    result,
    cancel() {
      worker.postMessage({ type: 'cancel' } satisfies ToWorker);
      // If the worker is stuck inside the encoder, don't wait for it.
      setTimeout(() => settle(() => reject(new ExportCancelled())), 1000);
    },
  };
}
```

`src/export/image.ts`:

```ts
import { renderFrame, renderStill, type Scene } from '../engine/render';

/** t = animation time on screen, or null to export the still of `stillIndex`. */
export async function exportPng(scene: Scene, t: number | null, stillIndex: number): Promise<Blob> {
  const canvas = new OffscreenCanvas(scene.width, scene.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available.');
  if (t === null) renderStill(ctx, scene, stillIndex);
  else renderFrame(ctx, scene, t);
  return canvas.convertToBlob({ type: 'image/png' });
}
```

`src/export/capability.ts`:

```ts
import { canEncodeVideo } from 'mediabunny';

export async function videoExportSupported(): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof Worker === 'undefined') {
    return false;
  }
  try {
    const size = { width: 1080, height: 1920 };
    return (await canEncodeVideo('avc', size)) || (await canEncodeVideo('hevc', size));
  } catch {
    return false;
  }
}
```

- [ ] **Step 6: `src/ui/exportDialog.ts` implementieren**

```ts
import { FPS, frameCount, totalDuration } from '../engine/timeline';
import { videoExportSupported } from '../export/capability';
import { exportPng } from '../export/image';
import { canShare, downloadFile, exportFileName, shareFile } from '../export/save';
import { ExportCancelled, exportVideo, type VideoJob } from '../export/video';
import { exporting, images, playing, selected, settings } from '../state/store';
import { h } from './dom';
import type { PreviewApi } from './preview';
import { buildScene } from './scene';

type Kind = 'video' | 'png';
type Phase =
  | { name: 'idle' }
  | { name: 'running'; progress: number }
  | { name: 'done'; file: File; shared: boolean }
  | { name: 'error'; message: string };

const UNSUPPORTED = "Your browser can't create videos. Please use a current version of Chrome, Safari or Firefox.";
const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function mountExportDialog(dialog: HTMLDialogElement, preview: PreviewApi): { open: () => void } {
  let kind: Kind = 'video';
  let phase: Phase = { name: 'idle' };
  let job: VideoJob | null = null;
  let videoSupported: boolean | null = null; // null while checking

  void videoExportSupported().then((ok) => {
    videoSupported = ok;
    if (!ok) kind = 'png';
    if (dialog.open) render();
  });

  // Esc must not close the dialog while a video is rendering.
  dialog.addEventListener('cancel', (e) => {
    if (phase.name === 'running') e.preventDefault();
  });

  function info(): string {
    const scene = buildScene();
    if (!scene) return '';
    const size = `${scene.width} × ${scene.height}`;
    if (kind === 'png') return `${size} · PNG`;
    const { loops, speed } = settings.get();
    const d = totalDuration({ imageCount: images.get().length, loops, speed });
    return `${size} · ${loops} loop${loops === 1 ? '' : 's'} · ${d.toFixed(1)} s · ${frameCount(d, FPS)} frames`;
  }

  function render(): void {
    const running = phase.name === 'running';
    const segment = (k: Kind, label: string, disabled: boolean) =>
      h('button', {
        class: 'btn',
        type: 'button',
        'aria-pressed': String(kind === k),
        disabled: disabled || running,
        onclick: () => {
          kind = k;
          phase = { name: 'idle' };
          render();
        },
      }, label);

    const actions = h('div', { class: 'export__actions' });
    switch (phase.name) {
      case 'idle':
        actions.append(h('button', {
          class: 'btn btn--solid',
          type: 'button',
          disabled: kind === 'video' && videoSupported !== true,
          onclick: () => void start(),
        }, 'EXPORT'));
        break;
      case 'running': {
        const pct = Math.round(phase.progress * 100);
        const bar = h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct }, h('i'));
        bar.style.setProperty('--p', `${pct}%`);
        actions.append(
          bar,
          h('p', { class: 'export__info export__progress-label' }, `Rendering… ${pct} %`),
          h('button', { class: 'btn', type: 'button', onclick: () => job?.cancel() }, 'CANCEL'),
        );
        break;
      }
      case 'done': {
        const file = phase.file;
        if (phase.shared) {
          actions.append(
            h('button', { class: 'btn btn--solid', type: 'button', onclick: () => void shareFile(file).catch(() => {}) }, 'SAVE / SHARE'),
            h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => downloadFile(file) }, 'DOWNLOAD FILE'),
          );
        } else {
          actions.append(
            h('p', { class: 'export__file' }, `Saved ${file.name}`),
            h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => downloadFile(file) }, 'DOWNLOAD AGAIN'),
          );
        }
        break;
      }
      case 'error':
        actions.append(
          h('p', { class: 'export__notice', role: 'alert' }, phase.message),
          h('button', { class: 'btn btn--solid', type: 'button', onclick: () => void start() }, 'TRY AGAIN'),
        );
        break;
    }

    dialog.replaceChildren(
      h('div', { class: 'export__head' },
        h('span', {}, 'EXPORT'),
        running ? null : h('button', { class: 'export__close', type: 'button', 'aria-label': 'Close', onclick: () => dialog.close() }, '×')),
      h('div', { class: 'segmented' }, segment('video', 'VIDEO (MP4)', videoSupported === false), segment('png', 'IMAGE (PNG)', false)),
      h('p', { class: 'export__info' }, info()),
      videoSupported === false ? h('p', { class: 'export__notice' }, UNSUPPORTED) : '',
      actions,
    );
  }

  // Progress arrives every ~10 frames: update in place so the CANCEL button is never re-created mid-tap.
  function setProgress(value: number): void {
    phase = { name: 'running', progress: value };
    const bar = dialog.querySelector<HTMLElement>('.progress');
    const label = dialog.querySelector<HTMLElement>('.export__progress-label');
    if (!bar || !label) return render();
    const pct = Math.round(value * 100);
    bar.style.setProperty('--p', `${pct}%`);
    bar.setAttribute('aria-valuenow', String(pct));
    label.textContent = `Rendering… ${pct} %`;
  }

  function deliver(file: File): void {
    const shared = matchMedia('(pointer: coarse)').matches && canShare(file);
    if (!shared) downloadFile(file);
    phase = { name: 'done', file, shared };
    render();
  }

  async function start(): Promise<void> {
    const scene = buildScene();
    if (!scene) return;
    if (kind === 'png') {
      try {
        const blob = await exportPng(scene, preview.currentTime(), selected.get());
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
      job = exportVideo(scene, setProgress);
      const blob = await job.result;
      deliver(new File([blob], exportFileName(scene.settings.format, 'mp4'), { type: 'video/mp4' }));
    } catch (err) {
      phase = err instanceof ExportCancelled ? { name: 'idle' } : { name: 'error', message: messageOf(err) };
      render();
    } finally {
      job = null;
      exporting.set(false);
    }
  }

  return {
    open() {
      if (images.get().length === 0 || dialog.open) return;
      phase = { name: 'idle' };
      render();
      dialog.showModal();
    },
  };
}
```

- [ ] **Step 7: `src/main.ts` ersetzen**

```ts
import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';
import { makeTestImage } from './dev/testImage';
import { exportVideo } from './export/video';
import { effect } from './state/signal';
import { exporting, images, patchSettings } from './state/store';
import { mountExportDialog } from './ui/exportDialog';
import { addImageFiles } from './ui/images';
import { mountPreview } from './ui/preview';
import { buildScene } from './ui/scene';

const byId = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing in index.html`);
  return el as T;
};

const fileInput = byId<HTMLInputElement>('fileInput');
const pickFiles = (): void => fileInput.click();
fileInput.addEventListener('change', () => {
  if (fileInput.files?.length) void addImageFiles([...fileInput.files]);
  fileInput.value = '';
});
// Dropping a file outside the preview must not navigate away from the app.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

const preview = mountPreview(byId('preview'), pickFiles);
const exportDialog = mountExportDialog(byId<HTMLDialogElement>('exportDialog'), preview);

const topExport = byId<HTMLButtonElement>('exportBtnTop');
topExport.addEventListener('click', exportDialog.open);

effect([images, exporting], () => {
  const empty = images.get().length === 0;
  document.body.classList.toggle('is-empty', empty);
  topExport.disabled = empty || exporting.get();
});

if (import.meta.env.DEV) {
  const loadTestImage = async (accent?: string, width?: number, height?: number) =>
    addImageFiles([await makeTestImage(accent, width, height)]);
  Object.assign(window, { __strata: { addImageFiles, buildScene, exportVideo, loadTestImage, patchSettings } });
}
```

- [ ] **Step 8: Typecheck, Tests, Build**

```bash
npx tsc --noEmit && npm test && npm run build
```

Expected: alles grün. Im Build-Output taucht ein eigener Worker-Chunk auf (`dist/assets/video.worker-*.js`).

- [ ] **Step 9: Im Browser prüfen – Export, Abbrechen, erneuter Export (Review Focus 4)**

`preview_start { name: "strata" }`, neu laden, per `javascript_tool` `await window.__strata.loadTestImage()`. Dann einen Export mit Abbruch starten und direkt einen zweiten fertig laufen lassen:

```js
window.__check = null;
(async () => {
  const s = window.__strata;
  s.patchSettings({ format: '9:16', loops: 1, speed: 2 });
  const first = s.exportVideo(s.buildScene(), () => {});
  setTimeout(() => first.cancel(), 150);
  const firstOutcome = await first.result.then(() => 'finished', (e) => e.message);
  const second = s.exportVideo(s.buildScene(), () => {});
  const blob = await second.result;
  const v = document.createElement('video');
  v.src = URL.createObjectURL(blob);
  await new Promise((r) => v.addEventListener('loadedmetadata', r, { once: true }));
  window.__check = { firstOutcome, type: blob.type, mb: +(blob.size / 1e6).toFixed(2), duration: +v.duration.toFixed(2), w: v.videoWidth, h: v.videoHeight };
})();
```

Nach ein paar Sekunden `window.__check` abfragen (bei Bedarf wiederholen). Expected: `firstOutcome: 'Export cancelled'`, `type: 'video/mp4'`, `duration: 3` (±0.05), `w: 1080`, `h: 1920`.

Danach den Dialog-Ablauf per UI prüfen: `resize_window { preset: "mobile" }`, neu laden, `await window.__strata.loadTestImage()`, Top-Bar-EXPORT klicken, Screenshot (Info-Zeile `1080 × 1920 · 2 loops · 12.0 s · 360 frames`), EXPORT klicken, während der Fortschritt läuft CANCEL klicken. Expected: Der Dialog springt zurück auf `idle`, EXPORT in der Top-Bar ist wieder aktiv. Ein erneuter EXPORT läuft bis „Saved …“ bzw. SAVE / SHARE durch. `read_console_messages` enthält `[strata] video export took … ms` und keine Fehler. Danach `resize_window { preset: "desktop" }`.

- [ ] **Step 10: Commit**

```bash
git add src tests
git commit -m "feat(export): Mediabunny MP4 export in a worker, PNG export and export dialog"
```

---

### Task 9: Werkzeuge – Steuerungen, Dropdown, Farbrad, Sidebar und Mobile-Leiste

**Files:**
- Create: `src/ui/popover.ts`, `src/ui/dropdown.ts`, `src/ui/colorWheel.ts`, `src/ui/controls.ts`, `src/ui/tools.ts`, `src/ui/sidebar.ts`, `src/ui/toolbar.ts`
- Replace: `src/main.ts`

**Interfaces:**
- Consumes: `RANGES`, `RangeKey` (settings.ts), Store (`settings`, `patchSettings`, `resetSettings`, `images`, `activeTool`, `exporting`, `ToolId`), `MOTIONS`, `FORMATS`, `outputSize`, `pixelLabel`, `normalizeHex`, `hslToHex`, `pickFromWheel`, `WHEEL_INNER`, `effect`, `h`, `toast`
- Produces:
  - `popover.ts`: `anchorPopover(pop, anchor, opts?: { matchWidth?: boolean; onOpen?: () => void })`
  - `dropdown.ts`: `DropdownOption<T>`, `dropdown<T>(cfg): HTMLElement`
  - `colorWheel.ts`: `colorWheel(onPick): { el: HTMLElement; redraw(): void }`
  - `controls.ts`: `sliderControl`, `loopsControl`, `removeControl`, `colorControl`, `imgMaskControl`, `motionControl`, `formatControl`, `resetControl`
  - `tools.ts`: `GroupId`, `ToolDef`, `TOOLS`, `GROUP_LABELS`
  - `sidebar.ts`: `mountSidebar(root, openExport)`
  - `toolbar.ts`: `mountToolbar(bar, panel)`

- [ ] **Step 1: `src/ui/popover.ts` implementieren**

```ts
const MOBILE = '(width <= 768px)';

/**
 * Positions a popover next to its anchor each time it opens: above the anchor on mobile
 * (tools sit at the bottom of the screen), below it on desktop.
 */
export function anchorPopover(pop: HTMLElement, anchor: HTMLElement, opts: { matchWidth?: boolean; onOpen?: () => void } = {}): void {
  pop.addEventListener('beforetoggle', (e) => {
    if (e.newState === 'open') pop.style.visibility = 'hidden';
  });
  pop.addEventListener('toggle', (e) => {
    if (e.newState !== 'open') return;
    const r = anchor.getBoundingClientRect();
    const gap = 6;
    if (opts.matchWidth) pop.style.width = `${Math.max(r.width, 220)}px`;
    pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8))}px`;
    if (matchMedia(MOBILE).matches) {
      pop.style.top = 'auto';
      pop.style.bottom = `${innerHeight - r.top + gap}px`;
    } else {
      pop.style.bottom = 'auto';
      pop.style.top = `${Math.max(8, Math.min(r.bottom + gap, innerHeight - pop.offsetHeight - 8))}px`;
    }
    pop.style.visibility = '';
    opts.onOpen?.();
  });
}
```

- [ ] **Step 2: `src/ui/dropdown.ts` implementieren**

```ts
import { effect, type Signal } from '../state/signal';
import { h } from './dom';
import { anchorPopover } from './popover';

export interface DropdownOption<T extends string> {
  value: T;
  icon: string;
  label: string;
  detail?: string;
}

/** Label above, a button showing only the current choice, and a popover listbox. */
export function dropdown<T extends string>(cfg: {
  label: string;
  options: () => readonly DropdownOption<T>[];
  value: () => T;
  onSelect: (value: T) => void;
  deps: readonly Signal<unknown>[];
}): HTMLElement {
  const button = h('button', { class: 'btn dd__button', type: 'button', 'aria-haspopup': 'listbox' });
  const list = h('div', { class: 'popover dd__list', role: 'listbox', 'aria-label': cfg.label });
  list.popover = 'auto';
  button.popoverTargetElement = list;

  effect(cfg.deps, () => {
    const current = cfg.value();
    const options = cfg.options();
    const sel = options.find((o) => o.value === current);
    button.setAttribute('aria-label', `${cfg.label}: ${sel?.label ?? ''}`);
    button.replaceChildren(
      h('span', { 'aria-hidden': 'true' }, sel?.icon ?? ''),
      h('span', {}, sel?.label ?? ''),
      sel?.detail ? h('span', { class: 'dd__detail' }, sel.detail) : null,
      h('span', { class: 'dd__caret', 'aria-hidden': 'true' }, '▾'),
    );
    list.replaceChildren(...options.map((o) =>
      h('button', {
        class: 'dd__option',
        type: 'button',
        role: 'option',
        'aria-selected': String(o.value === current),
        onclick: () => {
          cfg.onSelect(o.value);
          list.hidePopover();
          button.focus();
        },
      },
      h('span', { 'aria-hidden': 'true' }, o.value === current ? '✓' : ''),
      h('span', { class: 'dd__icon', 'aria-hidden': 'true' }, o.icon),
      h('span', {}, o.label),
      h('span', { class: 'dd__detail' }, o.detail ?? ''))));
  });

  anchorPopover(list, button, {
    matchWidth: true,
    onOpen: () => list.querySelector<HTMLElement>('[aria-selected="true"]')?.focus(),
  });
  list.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...list.querySelectorAll<HTMLElement>('.dd__option')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  });

  return h('div', { class: 'field' }, h('div', { class: 'field__label' }, h('span', {}, cfg.label)), button, list);
}
```

- [ ] **Step 3: `src/ui/colorWheel.ts` implementieren** (Port von `initializeColorWheel`/`selectColorFromWheel`, jetzt mit Pointer Events, damit Touch funktioniert)

```ts
import { WHEEL_INNER, hslToHex, pickFromWheel } from '../util/color';
import { h } from './dom';

const SIZE = 200;
const C = SIZE / 2;
const RADIUS = C - 10;

function paintWheel(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, SIZE, SIZE);
  for (let angle = 0; angle < 360; angle++) {
    const start = ((angle - 1) * Math.PI) / 180;
    const end = (angle * Math.PI) / 180;
    ctx.beginPath();
    ctx.arc(C, C, RADIUS, start, end);
    ctx.arc(C, C, RADIUS * WHEEL_INNER, end, start, true);
    ctx.closePath();
    ctx.fillStyle = `hsl(${angle}, 100%, 50%)`;
    ctx.fill();
  }
  const inner = RADIUS * WHEEL_INNER;
  ctx.beginPath();
  ctx.arc(C, C, inner, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.closePath();
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(C, C, inner, -Math.PI / 2, Math.PI / 2);
  ctx.closePath();
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(C, C, inner, 0, 2 * Math.PI);
  ctx.strokeStyle = '#666666';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function colorWheel(onPick: (hex: string) => void): { el: HTMLElement; redraw(): void } {
  const canvas = h('canvas', { width: SIZE, height: SIZE, role: 'img', 'aria-label': 'Colour wheel' });
  const brightness = h('input', { class: 'range', type: 'range', min: 0, max: 100, value: 100, 'aria-label': 'Brightness' });
  const ctx = canvas.getContext('2d');
  const base = document.createElement('canvas');
  base.width = SIZE;
  base.height = SIZE;
  const baseCtx = base.getContext('2d');
  if (!ctx || !baseCtx) throw new Error('2D canvas is not available.');
  paintWheel(baseCtx);

  let cursor: { x: number; y: number } | null = null;
  let hueSat: { hue: number; saturation: number } | null = null;

  const redraw = () => {
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(base, 0, 0);
    if (!cursor) return;
    ctx.beginPath();
    ctx.arc(cursor.x, cursor.y, 6, 0, 2 * Math.PI);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  const pick = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const k = SIZE / r.width; // the canvas may be scaled by CSS
    const p = pickFromWheel((e.clientX - r.left) * k - C, (e.clientY - r.top) * k - C, RADIUS, Number(brightness.value));
    cursor = { x: C + p.cursor.x, y: C + p.cursor.y };
    hueSat = p.hue === null || p.saturation === null ? null : { hue: p.hue, saturation: p.saturation };
    onPick(p.hex);
    redraw();
  };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pick(e);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (canvas.hasPointerCapture(e.pointerId)) pick(e);
  });
  brightness.addEventListener('input', () => {
    if (hueSat) onPick(hslToHex(hueSat.hue, hueSat.saturation, Number(brightness.value) / 2));
  });

  redraw();
  const el = h('div', { class: 'wheel' }, canvas, h('div', { class: 'field__label' }, h('span', {}, 'BRIGHTNESS')), brightness);
  return { el, redraw };
}
```

- [ ] **Step 4: `src/ui/controls.ts` implementieren**

```ts
import { FORMATS, outputSize, pixelLabel } from '../engine/formats';
import { MOTIONS } from '../engine/motions';
import type { FormatId, MotionId, Settings } from '../engine/types';
import { RANGES, type RangeKey } from '../state/settings';
import { effect } from '../state/signal';
import { images, patchSettings, resetSettings, settings } from '../state/store';
import { normalizeHex } from '../util/color';
import { colorWheel } from './colorWheel';
import { h } from './dom';
import { dropdown } from './dropdown';
import { anchorPopover } from './popover';
import { toast } from './toast';

const label = (text: string, value?: HTMLElement | null) =>
  h('div', { class: 'field__label' }, h('span', {}, text), value ?? null);

export function sliderControl(opts: { label: string; key: RangeKey; readout?: (v: number) => string }): HTMLElement {
  const { min, max, step } = RANGES[opts.key];
  const input = h('input', { class: 'range', type: 'range', min, max, step, 'aria-label': opts.label });
  const value = opts.readout ? h('span', { class: 'field__value' }) : null;
  input.addEventListener('input', () => {
    const patch: Partial<Settings> = {};
    patch[opts.key] = Number(input.value);
    patchSettings(patch);
  });
  effect([settings], () => {
    const v = settings.get()[opts.key];
    if (Number(input.value) !== v) input.value = String(v);
    input.style.setProperty('--fill', `${((v - min) / (max - min)) * 100}%`);
    if (value && opts.readout) value.textContent = opts.readout(v);
  });
  return h('div', { class: 'field' }, label(opts.label, value), input);
}

export function loopsControl(): HTMLElement {
  const { min, max } = RANGES.loops;
  const value = h('span', { class: 'stepper__value', 'aria-live': 'polite' });
  const step = (d: number) => patchSettings({ loops: Math.min(max, Math.max(min, settings.get().loops + d)) });
  const minus = h('button', { class: 'btn stepper__btn', type: 'button', 'aria-label': 'Fewer loops', onclick: () => step(-1) }, '−');
  const plus = h('button', { class: 'btn stepper__btn', type: 'button', 'aria-label': 'More loops', onclick: () => step(1) }, '+');
  effect([settings], () => {
    const loops = settings.get().loops;
    value.textContent = `${loops}×`;
    minus.disabled = loops <= min;
    plus.disabled = loops >= max;
  });
  return h('div', { class: 'field' }, label('LOOPS'), h('div', { class: 'stepper' }, minus, value, plus));
}

export function removeControl(): HTMLElement {
  const flip = () => patchSettings({ removeFront: !settings.get().removeFront });
  const toggle = h('button', { class: 'btn', type: 'button', onclick: flip });
  const swap = h('button', {
    class: 'btn btn--icon',
    type: 'button',
    title: 'Switch back / front',
    'aria-label': 'Switch between remove back and remove front',
    onclick: flip,
  }, '⇄');
  effect([settings], () => {
    toggle.textContent = settings.get().removeFront ? 'REMOVE FRONT' : 'REMOVE BACK';
  });
  return h('div', { class: 'field' },
    label('REMOVE'),
    h('div', { class: 'row' }, toggle, swap),
    sliderControl({ label: 'SENSITIVITY', key: 'sensitivity' }));
}

export function colorControl(): HTMLElement {
  const input = h('input', { class: 'hex', type: 'text', maxlength: 7, spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Hex colour' });
  const swatch = h('button', { class: 'swatch', type: 'button', 'aria-label': 'Open colour wheel' });
  const wheel = colorWheel((hex) => patchSettings({ color: hex }));
  const pop = h('div', { class: 'popover' }, wheel.el);
  pop.popover = 'auto';
  swatch.popoverTargetElement = pop;
  anchorPopover(pop, swatch, { onOpen: wheel.redraw });

  input.addEventListener('input', () => {
    const hex = normalizeHex(input.value);
    if (hex) patchSettings({ color: hex });
  });
  input.addEventListener('change', () => {
    if (!normalizeHex(input.value)) input.value = settings.get().color;
  });
  effect([settings], () => {
    const c = settings.get().color;
    if (document.activeElement !== input) input.value = c;
    swatch.style.setProperty('--swatch', c);
  });
  return h('div', { class: 'field' }, label('COLOR'), h('div', { class: 'color' }, input, swatch, pop));
}

export function imgMaskControl(): HTMLElement {
  const btn = h('button', { class: 'btn', type: 'button', onclick: () => patchSettings({ imgMask: !settings.get().imgMask }) });
  effect([settings], () => {
    const on = settings.get().imgMask;
    btn.textContent = `IMG MASK: ${on ? 'ON' : 'OFF'}`;
    btn.setAttribute('aria-pressed', String(on));
  });
  return h('div', { class: 'field' }, label('IMG MASK'), btn);
}

export function motionControl(): HTMLElement {
  return dropdown<MotionId>({
    label: 'MOTION',
    options: () => MOTIONS.map((m) => ({ value: m.id, icon: m.icon, label: m.label })),
    value: () => settings.get().motion,
    onSelect: (motion) => patchSettings({ motion }),
    deps: [settings],
  });
}

export function formatControl(): HTMLElement {
  return dropdown<FormatId>({
    label: 'FORMAT',
    options: () => {
      const first = images.get()[0]?.bitmap ?? null;
      return FORMATS.map((f) => ({ value: f.id, icon: f.icon, label: f.label, detail: pixelLabel(outputSize(f.id, first)) }));
    },
    value: () => settings.get().format,
    onSelect: (format) => patchSettings({ format }),
    deps: [settings, images],
  });
}

export function resetControl(): HTMLElement {
  return h('div', { class: 'field' },
    h('button', {
      class: 'btn btn--ghost',
      type: 'button',
      onclick: () => {
        resetSettings();
        toast('Settings reset');
      },
    }, '↺ RESET SETTINGS'));
}
```

- [ ] **Step 5: `src/ui/tools.ts`, `src/ui/sidebar.ts`, `src/ui/toolbar.ts` implementieren**

`src/ui/tools.ts`:

```ts
import { images, type ToolId } from '../state/store';
import {
  colorControl, formatControl, imgMaskControl, loopsControl, motionControl, removeControl, resetControl, sliderControl,
} from './controls';

export type GroupId = 'adjust' | 'background' | 'color' | 'motion' | 'format' | 'actions';

export interface ToolDef {
  id: ToolId;
  /** Short label under the icon in the mobile toolbar. */
  label: string;
  icon: string;
  group: GroupId;
  build: () => HTMLElement;
  visible?: () => boolean;
}

/** Desktop group headings; FORMAT carries its own label above the dropdown. */
export const GROUP_LABELS: Record<GroupId, string> = {
  adjust: 'ADJUST',
  background: 'BACKGROUND',
  color: 'COLOR',
  motion: 'MOTION',
  format: '',
  actions: '',
};

/** Single source for the desktop sidebar and the mobile toolbar, in toolbar order. */
export const TOOLS: readonly ToolDef[] = [
  { id: 'size', label: 'Size', icon: '▣', group: 'adjust', build: () => sliderControl({ label: 'SIZE', key: 'size' }) },
  { id: 'stretch', label: 'Stretch', icon: '↔', group: 'adjust', build: () => sliderControl({ label: 'STRETCH', key: 'stretch' }) },
  { id: 'threshold', label: 'Thresh.', icon: '◐', group: 'adjust', build: () => sliderControl({ label: 'THRESHOLD', key: 'threshold' }) },
  { id: 'remove', label: 'Remove', icon: '✂', group: 'background', build: removeControl },
  { id: 'color', label: 'Color', icon: '●', group: 'color', build: colorControl },
  { id: 'imgMask', label: 'Img Mask', icon: '◧', group: 'color', build: imgMaskControl, visible: () => images.get().length >= 2 },
  { id: 'motion', label: 'Motion', icon: '∿', group: 'motion', build: motionControl },
  { id: 'speed', label: 'Speed', icon: '»', group: 'motion', build: () => sliderControl({ label: 'SPEED', key: 'speed', readout: (v) => `${v.toFixed(1)}×` }) },
  { id: 'loops', label: 'Loops', icon: '⟳', group: 'motion', build: loopsControl },
  { id: 'format', label: 'Format', icon: '▯', group: 'format', build: formatControl },
  { id: 'reset', label: 'Reset', icon: '↺', group: 'actions', build: resetControl },
];
```

`src/ui/sidebar.ts`:

```ts
import { effect } from '../state/signal';
import { exporting, images } from '../state/store';
import { h } from './dom';
import { GROUP_LABELS, TOOLS, type GroupId } from './tools';

export function mountSidebar(root: HTMLElement, openExport: () => void): void {
  root.append(h('div', { class: 'sidebar__logo' }, 'STRATA'));
  const groups = new Map<GroupId, HTMLElement>();
  for (const tool of TOOLS) {
    let group = groups.get(tool.group);
    if (!group) {
      const heading = GROUP_LABELS[tool.group];
      group = h('section', { class: `group group--${tool.group}` }, heading ? h('h2', { class: 'group__label' }, heading) : null);
      groups.set(tool.group, group);
      root.append(group);
    }
    const el = tool.build();
    el.dataset.tool = tool.id;
    group.append(el);
    const visible = tool.visible;
    if (visible) effect([images], () => { el.hidden = !visible(); });
  }
  const exportBtn = h('button', { class: 'btn btn--solid sidebar__export', type: 'button', onclick: openExport }, 'EXPORT');
  root.append(exportBtn);
  effect([images, exporting], () => {
    exportBtn.disabled = images.get().length === 0 || exporting.get();
  });
}
```

`src/ui/toolbar.ts`:

```ts
import { effect } from '../state/signal';
import { activeTool, images } from '../state/store';
import { h } from './dom';
import { TOOLS } from './tools';

/** Mobile: a scrollable icon bar; only the active tool's control is shown in the panel above it. */
export function mountToolbar(bar: HTMLElement, panel: HTMLElement): void {
  for (const tool of TOOLS) {
    const btn = h('button', {
      class: 'tool',
      type: 'button',
      'data-tool-btn': tool.id,
      'aria-pressed': 'false',
      onclick: () => activeTool.set(tool.id),
    }, h('span', { class: 'tool__icon', 'aria-hidden': 'true' }, tool.icon), h('span', {}, tool.label));
    const pane = tool.build();
    pane.dataset.tool = tool.id;
    bar.append(btn);
    panel.append(pane);

    effect([activeTool, images], () => {
      const visible = tool.visible ? tool.visible() : true;
      if (!visible && activeTool.get() === tool.id) {
        activeTool.set('size');
        return;
      }
      const active = visible && activeTool.get() === tool.id;
      btn.hidden = !visible;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
      pane.hidden = !active;
    });
  }
  activeTool.subscribe((id) => {
    bar.querySelector<HTMLElement>(`[data-tool-btn="${id}"]`)?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
  });
}
```

- [ ] **Step 6: `src/main.ts` ersetzen**

```ts
import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';
import { makeTestImage } from './dev/testImage';
import { exportVideo } from './export/video';
import { effect } from './state/signal';
import { exporting, images, patchSettings } from './state/store';
import { mountExportDialog } from './ui/exportDialog';
import { addImageFiles } from './ui/images';
import { mountPreview } from './ui/preview';
import { buildScene } from './ui/scene';
import { mountSidebar } from './ui/sidebar';
import { mountToolbar } from './ui/toolbar';

const byId = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing in index.html`);
  return el as T;
};

const fileInput = byId<HTMLInputElement>('fileInput');
const pickFiles = (): void => fileInput.click();
fileInput.addEventListener('change', () => {
  if (fileInput.files?.length) void addImageFiles([...fileInput.files]);
  fileInput.value = '';
});
// Dropping a file outside the preview must not navigate away from the app.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

const preview = mountPreview(byId('preview'), pickFiles);
const exportDialog = mountExportDialog(byId<HTMLDialogElement>('exportDialog'), preview);
mountSidebar(byId('sidebar'), exportDialog.open);
mountToolbar(byId('toolbar'), byId('panel'));

const topExport = byId<HTMLButtonElement>('exportBtnTop');
topExport.addEventListener('click', exportDialog.open);

// Tools are greyed out without clips and locked while a video renders.
const lockable = ['sidebar', 'panel', 'toolbar'].map((id) => byId(id));
effect([images, exporting], () => {
  const empty = images.get().length === 0;
  document.body.classList.toggle('is-empty', empty);
  topExport.disabled = empty || exporting.get();
  for (const el of lockable) el.inert = empty || exporting.get();
});

if (import.meta.env.DEV) {
  const loadTestImage = async (accent?: string, width?: number, height?: number) =>
    addImageFiles([await makeTestImage(accent, width, height)]);
  Object.assign(window, { __strata: { addImageFiles, buildScene, exportVideo, loadTestImage, patchSettings } });
}
```

- [ ] **Step 7: Typecheck, Tests, Build**

```bash
npx tsc --noEmit && npm test && npm run build
```

Expected: alles grün.

- [ ] **Step 8: Im Browser prüfen – Desktop**

`preview_start { name: "strata" }`, neu laden, per `javascript_tool` `await window.__strata.loadTestImage()`. Dann:

1. `read_page` mit `filter: "interactive"`: Die Sidebar enthält SIZE, STRETCH, THRESHOLD, REMOVE BACK, ⇄, SENSITIVITY, Hex-Feld, Swatch, MOTION-Dropdown, SPEED (Wert `1.0×`), LOOPS (`2×`, −/+), FORMAT-Dropdown, RESET und EXPORT. IMG MASK ist versteckt (nur 1 Bild).
2. FORMAT-Button klicken, Screenshot. Erwartet: Liste unter dem Button mit `✓ ▯ 9:16 1080 × 1920`, `▯ 4:5 1080 × 1350`, `▭ 16:9 1920 × 1080`, `□ ORIGINAL 1200 × 1600` (das Testbild ist 1200 × 1600). „FORMAT“ steht über dem Button, nicht darin.
3. `4:5` wählen. Expected: `window.__strata.buildScene().height === 1350`, das Vorschau-Seitenverhältnis wechselt.
4. SIZE-Slider per `form_input` auf 40 setzen. Expected: Die Vorschau zeigt schmalere Balken, `JSON.parse(localStorage['strata:v2']).size === 40`.
5. Swatch klicken, auf den roten Rand des Farbrads klicken (rechts vom Mittelpunkt). Expected: Das Hex-Feld zeigt `#FF…`, die Balken werden rot.
6. RESET klicken. Expected: Toast „Settings reset“, Format zurück auf 9:16.

- [ ] **Step 9: Im Browser prüfen – Mobile**

`resize_window { preset: "mobile" }`, neu laden, `await window.__strata.loadTestImage()`. Screenshot. Expected: Top-Bar (STRATA / EXPORT), große Vorschau, darunter das Panel mit dem SIZE-Regler und die Werkzeugleiste (Size aktiv). Dann:

1. In der Werkzeugleiste auf „Format“ tippen (vorher ggf. horizontal scrollen). Expected: Das Panel zeigt nur `FORMAT` + Button, der Button der Leiste ist hervorgehoben.
2. Format-Button tippen, Screenshot. Expected: Das Menü öffnet sich **nach oben**, 9:16 ist markiert.
3. Prüfen, dass nichts vertikal scrollt: `document.scrollingElement.scrollHeight <= innerHeight` ergibt `true`.
4. `resize_window { preset: "desktop" }`.

- [ ] **Step 10: Commit**

```bash
git add src
git commit -m "feat(ui): tools for desktop sidebar and mobile toolbar"
```

---

### Task 10: Transport-Zeile und Clip-Leiste

**Files:**
- Create: `src/ui/transport.ts`, `src/ui/clips.ts`
- Replace: `src/main.ts`

**Interfaces:**
- Consumes: Store (`playing`, `seed`, `settings`, `images`, `activeTool`, `selected`, `shownClip`), `motionById`, `totalDuration`, `randomSeed`, `removeImage`, `moveImage`, `h`, `effect`
- Produces: `mountTransport(root)`, `mountClips(root, pickFiles)`

- [ ] **Step 1: `src/ui/transport.ts` implementieren**

```ts
import { motionById } from '../engine/motions';
import { randomSeed } from '../engine/rng';
import { totalDuration } from '../engine/timeline';
import { effect } from '../state/signal';
import { activeTool, images, playing, seed, settings } from '../state/store';
import { h } from './dom';

export function mountTransport(root: HTMLElement): void {
  const play = h('button', { class: 'transport__play', type: 'button', onclick: () => playing.set(!playing.get()) });
  const motion = h('button', {
    class: 'transport__motion',
    type: 'button',
    onclick: () => {
      activeTool.set('motion');
      if (matchMedia('(width > 768px)').matches) {
        document.querySelector<HTMLElement>('#sidebar [data-tool="motion"] .dd__button')?.click();
      }
    },
  });
  const shuffle = h('button', {
    class: 'transport__shuffle',
    type: 'button',
    title: 'Shuffle',
    'aria-label': 'Shuffle the random pattern',
    onclick: () => seed.set(randomSeed()),
  }, '⤮');
  const info = h('span', { class: 'transport__info' });
  root.append(play, motion, shuffle, info);

  effect([playing], () => {
    const on = playing.get();
    play.textContent = on ? '❚❚' : '▶';
    play.setAttribute('aria-label', on ? 'Pause' : 'Play');
  });
  effect([settings, images], () => {
    const s = settings.get();
    const m = motionById(s.motion);
    const count = images.get().length;
    root.hidden = count === 0;
    motion.textContent = `${m.icon} ${m.label}`;
    info.textContent = `${s.loops}× · ${totalDuration({ imageCount: count, loops: s.loops, speed: s.speed }).toFixed(1)} s`;
  });
}
```

- [ ] **Step 2: `src/ui/clips.ts` implementieren**

```ts
import { effect } from '../state/signal';
import { images, playing, selected, shownClip } from '../state/store';
import { h } from './dom';
import { moveImage, removeImage } from './images';

const LONG_PRESS_MS = 300;

/** Thumbnails in play order. Tap = select, × = remove, drag (long-press on touch) = reorder. */
export function mountClips(root: HTMLElement, pickFiles: () => void): void {
  let dragging = false;

  const markCurrent = () => {
    const current = playing.get() ? shownClip.get() : selected.get();
    root.querySelectorAll<HTMLElement>('.clip[data-index]').forEach((el) => {
      el.classList.toggle('is-current', Number(el.dataset.index) === current);
    });
  };

  const dropIndex = (dragged: HTMLElement, clientX: number) => {
    let index = 0;
    root.querySelectorAll<HTMLElement>('.clip[data-index]').forEach((el) => {
      if (el === dragged) return;
      const r = el.getBoundingClientRect();
      if (clientX > r.left + r.width / 2) index++;
    });
    return index;
  };

  const wire = (el: HTMLElement, index: number) => {
    let pointerId = -1;
    let startX = 0;
    let timer = 0;
    let active = false;
    const begin = (e: PointerEvent) => {
      active = true;
      dragging = true;
      el.setPointerCapture(e.pointerId);
      el.classList.add('is-dragging');
      navigator.vibrate?.(10);
    };
    const stop = () => {
      clearTimeout(timer);
      pointerId = -1;
      if (!active) return;
      active = false;
      dragging = false;
      el.classList.remove('is-dragging');
      el.style.translate = '';
    };
    el.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('.clip__remove')) return;
      pointerId = e.pointerId;
      startX = e.clientX;
      if (e.pointerType === 'touch') timer = window.setTimeout(() => begin(e), LONG_PRESS_MS);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      if (!active) {
        if (e.pointerType !== 'touch' && Math.abs(dx) > 4) begin(e);
        else if (e.pointerType === 'touch' && Math.abs(dx) > 8) stop(); // the finger is scrolling the strip
        return;
      }
      el.style.translate = `${dx}px 0`;
    });
    el.addEventListener('pointerup', (e) => {
      if (e.pointerId !== pointerId) return;
      const wasDragging = active;
      stop();
      if (wasDragging) moveImage(index, dropIndex(el, e.clientX));
      else selected.set(index);
    });
    el.addEventListener('pointercancel', stop);
    // Once a long-press drag has started, the strip must not scroll under the finger.
    el.addEventListener('touchmove', (e) => { if (active) e.preventDefault(); }, { passive: false });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selected.set(index); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeImage(index); }
      else if (e.key === 'ArrowLeft' && index > 0) moveImage(index, index - 1);
      else if (e.key === 'ArrowRight') moveImage(index, index + 1);
    });
  };

  const render = () => {
    if (dragging) return;
    const list = images.get();
    const sel = selected.get();
    root.hidden = list.length === 0;
    root.replaceChildren(
      ...list.map((img, i) => {
        const el = h('div', { class: 'clip', role: 'button', tabindex: 0, 'data-index': i, 'aria-label': `Image ${i + 1}: ${img.name}` },
          h('img', { src: img.thumbUrl, alt: '', draggable: 'false' }),
          i === sel && !playing.get()
            ? h('button', {
              class: 'clip__remove',
              type: 'button',
              'aria-label': `Remove image ${i + 1}`,
              onclick: (e: MouseEvent) => {
                e.stopPropagation();
                removeImage(i);
              },
            }, '×')
            : null);
        wire(el, i);
        return el;
      }),
      h('button', { class: 'clip clip--add', type: 'button', 'aria-label': 'Add images', onclick: pickFiles }, '+'),
    );
    markCurrent();
  };

  effect([images, selected, playing], render);
  shownClip.subscribe(markCurrent);
}
```

- [ ] **Step 3: `src/main.ts` ersetzen** (Endstand)

```ts
import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';
import { makeTestImage } from './dev/testImage';
import { exportVideo } from './export/video';
import { effect } from './state/signal';
import { exporting, images, patchSettings } from './state/store';
import { mountClips } from './ui/clips';
import { mountExportDialog } from './ui/exportDialog';
import { addImageFiles } from './ui/images';
import { mountPreview } from './ui/preview';
import { buildScene } from './ui/scene';
import { mountSidebar } from './ui/sidebar';
import { mountToolbar } from './ui/toolbar';
import { mountTransport } from './ui/transport';

const byId = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing in index.html`);
  return el as T;
};

const fileInput = byId<HTMLInputElement>('fileInput');
const pickFiles = (): void => fileInput.click();
fileInput.addEventListener('change', () => {
  if (fileInput.files?.length) void addImageFiles([...fileInput.files]);
  fileInput.value = '';
});
// Dropping a file outside the preview must not navigate away from the app.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

const preview = mountPreview(byId('preview'), pickFiles);
const exportDialog = mountExportDialog(byId<HTMLDialogElement>('exportDialog'), preview);
mountSidebar(byId('sidebar'), exportDialog.open);
mountToolbar(byId('toolbar'), byId('panel'));
mountTransport(byId('transport'));
mountClips(byId('clips'), pickFiles);

const topExport = byId<HTMLButtonElement>('exportBtnTop');
topExport.addEventListener('click', exportDialog.open);

// Tools are greyed out without clips; everything is locked while a video renders.
const tools = ['sidebar', 'panel', 'toolbar'].map((id) => byId(id));
const timeline = ['transport', 'clips'].map((id) => byId(id));
effect([images, exporting], () => {
  const empty = images.get().length === 0;
  const busy = exporting.get();
  document.body.classList.toggle('is-empty', empty);
  topExport.disabled = empty || busy;
  for (const el of tools) el.inert = empty || busy;
  for (const el of timeline) el.inert = busy;
});

if (import.meta.env.DEV) {
  const loadTestImage = async (accent?: string, width?: number, height?: number) =>
    addImageFiles([await makeTestImage(accent, width, height)]);
  Object.assign(window, { __strata: { addImageFiles, buildScene, exportVideo, loadTestImage, patchSettings } });
}
```

- [ ] **Step 4: Typecheck, Tests, Build**

```bash
npx tsc --noEmit && npm test && npm run build
```

Expected: alles grün.

- [ ] **Step 5: Im Browser prüfen – Wiedergabe, Clips, Entfernen während der Wiedergabe (Review Focus 2)**

`preview_start { name: "strata" }`, neu laden. Drei Testbilder laden: `for (const c of ['#b33', '#3b3', '#33b']) await window.__strata.loadTestImage(c)`. Dann:

1. Screenshot. Expected: Transport-Zeile `▶ ↑ BUILD UP ⤮ … 2× · 36.0 s`, Clip-Leiste mit 3 Thumbnails + „+“, der erste ist markiert und hat ein ×. IMG MASK ist jetzt in der Sidebar sichtbar.
2. ▶ klicken, 7 s warten, Screenshot. Expected: Die Animation läuft, der zweite Clip ist markiert (`.clip.is-current` hat `data-index="1"`).
3. Den ersten Clip per `left_click_drag` hinter den dritten ziehen. Expected: Die Reihenfolge ändert sich, der gezogene Clip ist ausgewählt.
4. **Während der Wiedergabe** alle Clips entfernen. Das × gibt es nur pausiert, deshalb über die Entf-Taste auf dem fokussierten Clip, die auch während der Wiedergabe funktioniert. Per `javascript_tool`:

```js
const errors = [];
window.addEventListener('error', (e) => errors.push(e.message));
const play = document.querySelector('.transport__play');
if (play.getAttribute('aria-label') !== 'Pause') play.click();
await new Promise((r) => setTimeout(r, 500));
for (let i = 0; i < 3; i++) {
  document.querySelector('.clip[data-index]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
  await new Promise((r) => setTimeout(r, 300)); // let a few animation frames run in between
}
({
  clips: document.querySelectorAll('.clip[data-index]').length,
  empty: !!document.querySelector('.empty'),
  transportHidden: document.getElementById('transport').hidden,
  playLabel: play.getAttribute('aria-label'),
  errors,
})
```

Expected: `{ clips: 0, empty: true, transportHidden: true, playLabel: 'Play', errors: [] }`. Zusätzlich liefert `read_console_messages` mit `onlyErrors: true` nichts (insbesondere kein `InvalidStateError` durch ein geschlossenes `ImageBitmap`). Danach die drei Testbilder erneut laden.

5. ⤮ klicken, während pausiert ist. Expected: Das Balkenmuster der Vorschau ändert sich nicht (das Standbild hängt nicht vom Seed ab). Nach ▶ läuft BUILD UP in einer anderen Reihenfolge als vorher.
6. Mobile: `resize_window { preset: "mobile" }`, neu laden, 2 Bilder laden, Screenshot. Expected: Die Transport-Zeile und die Clip-Leiste liegen zwischen Vorschau und Panel, `scrollHeight <= innerHeight`. Danach `resize_window { preset: "desktop" }`.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat(ui): transport row and reorderable clip strip"
```

---

### Task 11: GitHub-Pages-Deployment und Aufräumen

**Files:**
- Create: `.github/workflows/deploy.yml`
- Delete: `script.js`, `styles.css`, `lib/` (h264-mp4-encoder.web.js, hme.js, hme.wasm), `logo.png` (wird nirgends referenziert)
- Delete (lokal, nicht versioniert): `.claude/serve.py`

**Interfaces:**
- Consumes: `npm test`, `npm run build` (Task 1)
- Produces: Workflow `Deploy to GitHub Pages` (läuft bei Push auf `main` und manuell)

- [ ] **Step 1: Workflow anlegen** – `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 2: Alte Dateien entfernen**

```bash
git rm -r script.js styles.css lib logo.png
rm -f .claude/serve.py
grep -rn "script.js\|styles.css\|h264\|hme\|logo.png" index.html src || echo "no references left"
```

Expected: `no references left`

- [ ] **Step 3: Build mit Pages-Pfad prüfen**

```bash
npm test && npm run build && ls dist dist/assets
```

Expected: `dist/index.html`, `dist/favicon.svg`, JS/CSS-Bundles und ein `video.worker-*.js` in `dist/assets`. `grep -c "/picture-tool-motion/" dist/index.html` ergibt mindestens 2.

Dann den Build lokal gegen den Pages-Pfad testen: in `.claude/launch.json` die Konfiguration `{ "name": "strata-dist", "runtimeExecutable": "npm", "runtimeArgs": ["run", "preview", "--", "--port", "4173", "--strictPort"], "port": 4173 }` ergänzen, `preview_start { name: "strata-dist" }`, zu `http://localhost:4173/picture-tool-motion/` navigieren. Testbild laden. `window.__strata` fehlt im Build absichtlich, deshalb das Bild selbst erzeugen und per `DataTransfer` auf `#preview` droppen:

```js
const c = new OffscreenCanvas(1200, 1600);
const x = c.getContext('2d');
x.fillStyle = '#e8e4dc'; x.fillRect(0, 0, 1200, 1600);
x.fillStyle = '#222'; x.beginPath(); x.ellipse(600, 944, 330, 520, 0, 0, Math.PI * 2); x.fill();
const file = new File([await c.convertToBlob({ type: 'image/png' })], 'test.png', { type: 'image/png' });
const dt = new DataTransfer();
dt.items.add(file);
document.getElementById('preview').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
typeof window.__strata
```

Expected: `'undefined'`. Die Vorschau zeigt das Bild, der Sidebar-EXPORT öffnet den Dialog, ein Video-Export läuft durch (der Worker lädt unter `/picture-tool-motion/assets/…`, `read_network_requests` ohne 404). Danach `preview_stop` für `strata-dist`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "chore: deploy to GitHub Pages and remove the legacy app"
```

---

### Task 12: Gesamt-Verifikation und Performance-Messung

**Files:** keine Code-Änderung. Befunde führen zu Fix-Commits in der jeweils zuständigen Datei.

**Interfaces:**
- Consumes: alles
- Produces: Messwerte (alt vs. neu) und eine Checkliste für die PR-Beschreibung

- [ ] **Step 1: Volle Test- und Build-Runde**

```bash
npx tsc --noEmit && npm test && npm run build
```

Expected: alles grün.

- [ ] **Step 2: Legacy-Version für die Vergleichsmessung bereitstellen**

```bash
git worktree add ../strata-legacy c0813cc
```

In `.claude/launch.json` ergänzen: `{ "name": "strata-legacy", "runtimeExecutable": "python3", "runtimeArgs": ["-m", "http.server", "8081", "--directory", "../strata-legacy"], "port": 8081 }`.

- [ ] **Step 3: Legacy-Export messen** (9:16, 1 Bild, 12 s = 2 Durchläufe bei Speed 1×)

`preview_start { name: "strata-legacy" }`. Dann per `javascript_tool` starten (der Export läuft im Hintergrund, das Ergebnis landet in `window.__legacyMs`):

```js
window.alert = () => {};
window.__legacyMs = null;
(async () => {
  const c = new OffscreenCanvas(1200, 1600);
  const x = c.getContext('2d');
  x.fillStyle = '#e8e4dc'; x.fillRect(0, 0, 1200, 1600);
  x.fillStyle = '#222'; x.beginPath(); x.ellipse(600, 944, 330, 520, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#b33'; x.fillRect(420, 520, 360, 240);
  const file = new File([await c.convertToBlob({ type: 'image/png' })], 'test.png', { type: 'image/png' });
  const dt = new DataTransfer();
  dt.items.add(file);
  document.getElementById('dropZone').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 800));
  const sel = document.getElementById('aspectRatioSelect');
  sel.value = '9:16';
  sel.dispatchEvent(new Event('change'));
  const btn = document.getElementById('videoDownloadBtn');
  btn.click();                                   // live preview starts
  await new Promise((r) => setTimeout(r, 12000)); // 12 s = 2 cycles at 1×
  const t0 = performance.now();
  btn.click();                                   // stop → offline render + encode
  await new Promise((r) => {
    const iv = setInterval(() => {
      if (!btn.disabled && btn.textContent.includes('VIDEO')) { clearInterval(iv); r(); }
    }, 50);
  });
  window.__legacyMs = Math.round(performance.now() - t0);
})();
```

`window.__legacyMs` abfragen, bis es nicht mehr `null` ist (alle ~10 s). Der gemessene Wert enthält nur Rendern + Encoding, nicht die 12 s Live-Aufnahme. Die wartet der Nutzer im alten Tool **zusätzlich** ab, das gehört mit in die Beschreibung.

- [ ] **Step 4: Neuen Export mit derselben Einstellung messen**

`preview_start { name: "strata" }`, neu laden, dann:

```js
window.__newResult = null;
(async () => {
  const s = window.__strata;
  await s.loadTestImage('#b33'); // same picture as the legacy run above
  s.patchSettings({ format: '9:16', loops: 2, speed: 1 });
  const t0 = performance.now();
  const blob = await s.exportVideo(s.buildScene(), () => {}).result;
  const ms = Math.round(performance.now() - t0);
  const v = document.createElement('video');
  v.src = URL.createObjectURL(blob);
  await new Promise((r) => v.addEventListener('loadedmetadata', r, { once: true }));
  window.__newResult = { ms, duration: +v.duration.toFixed(2), mb: +(blob.size / 1e6).toFixed(2), w: v.videoWidth, h: v.videoHeight };
})();
```

Expected: `duration: 12` (±0.05), `w: 1080`, `h: 1920`. **Erfolgskriterium:** `__legacyMs / __newResult.ms >= 3`. Wird das verfehlt, im Worker Render- und Encode-Zeit getrennt messen (`performance.now()` um `renderFrame` bzw. `source.add`) und die Ursache mit `superpowers:systematic-debugging` klären, bevor es weitergeht. Das Ergebnis nicht schönrechnen. Beide Werte, Browser und Gerät für die PR-Beschreibung notieren.

- [ ] **Step 5: Große Bilder (Review Focus 1)**

Im neuen Tool (Dev-Server) neu laden, dann per `javascript_tool` ein 6000 × 4000-Testbild laden und messen:

```js
const s = window.__strata;
await s.loadTestImage('#b33', 6000, 4000);
s.patchSettings({ format: 'original' });
let t0 = performance.now(); const a = s.buildScene(); const originalMs = Math.round(performance.now() - t0);
s.patchSettings({ format: '9:16' });
t0 = performance.now(); const b = s.buildScene(); const socialMs = Math.round(performance.now() - t0);
({ original: [a.width, a.height], originalMs, social: [b.width, b.height], socialMs })
```

Expected: `original: [2000, 1332]`, `social: [1080, 1920]`, jeweils unter ~1500 ms beim ersten Aufruf. Danach einen SIZE-Slider-Zug in der UI: Die Vorschau reagiert ohne sichtbares Hängen.

- [ ] **Step 6: Abschluss-Checkliste Mobile (375 × 812)**

`resize_window { preset: "mobile" }`, neu laden und nacheinander prüfen (Screenshots ablegen):

- Leerzustand: nur „+ UPLOAD IMAGE“ + „PNG · JPG · WEBP“, Werkzeuge ausgegraut, EXPORT deaktiviert.
- Nach dem Upload: `document.querySelector('.empty') === null`, kein Text hinter dem Bild (Screenshot, auch bei 16:9, damit oben und unten freie Fläche sichtbar ist).
- `document.scrollingElement.scrollHeight <= innerHeight` bei allen Werkzeugen (jedes einmal antippen).
- Format-Menü: öffnet nach oben, Reihenfolge 9:16 ✓ · 4:5 · 16:9 · ORIGINAL, jeweils mit Symbol und Pixelmaß.
- Export-Dialog: Info-Zeile, Fortschritt, CANCEL, danach SAVE / SHARE (bei `pointer: coarse`) bzw. automatischer Download.

Danach `resize_window { preset: "desktop" }`.

- [ ] **Step 7: Optional – Safari im iOS-Simulator**

Nur wenn ein Simulator verfügbar ist (`xcrun simctl list devices available | grep -i iphone`). Simulator booten (`xcrun simctl boot "<Name>"`), `mcp__Claude_Code_iOS_Simulator__control { action: "attach" }`, dann `open_url` mit `http://localhost:5173/`. Screenshot vom Leerzustand und vom Format-Menü. Den Video-Export mit einem Bild aus der Simulator-Fotomediathek ausprobieren. Ist kein Simulator vorhanden, im Abschlussbericht vermerken, dass Safari/iOS nicht geprüft wurde.

- [ ] **Step 8: Aufräumen**

```bash
git worktree remove ../strata-legacy
```

Die Konfiguration `strata-legacy` wieder aus `.claude/launch.json` entfernen.

- [ ] **Step 9: Abschluss**

Mit `superpowers:finishing-a-development-branch` weitermachen. Die Messwerte aus Step 3–4 (alt, neu, Faktor, Browser, Gerät) und die Hinweise „GitHub → Settings → Pages → Source: GitHub Actions einmalig umstellen“ sowie ggf. „Safari/iOS ungetestet“ gehören in die PR-Beschreibung.
