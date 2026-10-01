# Strata Video-Modus: Stroke-Übergänge über Videoclips

Datum: 2026-10-01 · Status: Entwurf zur Freigabe · Basis: `edgarnien/main` (d89db61)

## 1. Ziel und Kontext

Bisher verarbeitet Strata nur Standbilder: Man lädt Fotos hoch, die Bildanalyse erzeugt Balken („Strokes“), und das Ergebnis wird als PNG oder animiertes MP4 exportiert. Mehrere Fotos werden ohne harten Schnitt verkettet. Die Strokes decken in der Mitte jedes Zyklus das ganze Bild ab, und genau in diesem Moment wird das Bild darunter gewechselt.

Neu kommt ein zweiter Modus **Video** hinzu. Man lädt Videoclips hoch, und Strata „verkleidet“ deren Schnitte mit Stroke-Übergängen. Auf Wunsch laufen die Strokes auch am Anfang (Intro) und am Ende (Outro). Die vorhandenen Werkzeuge (Motion, MOVE, Farbe, Size, Stretch, Threshold, Format, IMG MASK) werden weiterverwendet.

Strata wird für die HSBI-Kommunikation genutzt. Die CD-Regeln gelten weiter: Die Balken stehen im Raster, MOVE verschiebt nur um ganze Zellen, und Farben kommen bevorzugt aus der HSBI-Palette.

### Entscheidungen aus dem Brainstorming

| Thema | Entscheidung |
|---|---|
| Moduswechsel | Segment-Schalter „Foto \| Video“ im Apple-Stil, oben rechts neben EXPORT (mobil in der Topbar, am Desktop oben in der Sidebar) |
| Herkunft der Schnitte | Beides: mehrere Clips mit automatischem Übergang an jeder Clip-Grenze **und** frei setzbare Marker innerhalb eines Clips |
| „Ease in / ease out“ | Bedeutet **Intro / Outro**: Das Video startet bedeckt und die Strokes fallen weg; am Ende baut sich alles wieder zu. Beides ist einzeln schaltbar. |
| Übergangsarten | Farb-Strokes (Video läuft darunter weiter, kein Zeitversatz) **und** IMG MASK (der nächste Shot erscheint in den Balken; die Shots überlappen) |
| Tempo | Ein globaler Wert **DAUER** für alle Übergänge, kein Wert pro Marker |
| Ton | Originalton bleibt erhalten, an Überlappungen kurz übergeblendet, Schalter TON an/aus |
| Trimmen | Nicht in v1: Clips kommen fertig geschnitten herein |
| Architektur | Ansatz A: Vorschau über `<video>`-Elemente plus Canvas, Export framegenau über Mediabunny im Worker |
| Einstellungen | Foto und Video teilen sich den Look (Farbe, Motion, MOVE, Size, Stretch, Threshold, Format, Seed). Getrennt sind die Inhalte: Bilder auf der einen, Clips und Marker auf der anderen Seite. |

### Erfolgskriterien

- Ein Schnitt an einer Clip-Grenze oder einem Marker ist im exportierten MP4 **nie sichtbar**. Bei Farb-Strokes fällt der Schnitt genau auf den Frame mit voller Abdeckung.
- Export und Vorschau zeigen bei gleichen Einstellungen denselben Ablauf. Die Vorschau darf an Übergängen um bis zu 2 Frames abweichen, der Export ist framegenau.
- Der Ton im Export ist synchron zum Bild. Über einen 60-s-Export gemessen beträgt der Versatz höchstens 1 Frame.
- iPhone-Hochkantvideos (HEVC/MOV mit Rotations-Metadaten) erscheinen in Vorschau und Export richtig herum.
- Der Foto-Modus verhält sich unverändert, und alle bestehenden Tests bleiben grün.
- Mobil (375 px Breite) bleiben Vorschau, Zeitleiste und Werkzeugleiste ohne vertikales Scrollen sichtbar.

### Nicht im Umfang (v1)

- Clips trimmen (Start und Ende abschneiden)
- eigene DAUER pro Marker
- Freeze bzw. Halten im voll bedeckten Moment
- eigene Musikspur statt Originalton
- harten Schnitt an einer Clip-Grenze erzwingen (Übergang abschalten)
- automatische Schnitterkennung in einem fertig geschnittenen Video
- Clips über einen Seiten-Reload hinweg speichern (die Bilder werden heute auch nicht gespeichert)

## 2. Begriffe

- **Clip:** eine hochgeladene Videodatei.
- **Marker:** ein vom Nutzer gesetzter Zeitpunkt innerhalb eines Clips (Clip-ID plus Quellzeit).
- **Schnitt:** jede Clip-Grenze und jeder Marker.
- **Shot:** ein Abschnitt zwischen zwei Schnitten (bzw. zwischen Anfang/Ende und einem Schnitt). Ein Clip mit zwei Markern ergibt drei Shots.
- **Übergang:** die Stroke-Animation zwischen zwei aufeinanderfolgenden Shots.
- **DAUER (D):** die Länge *einer* Stroke-Phase, also Aufbauen oder Wegfallen. Ein Übergang dauert 2 · D, Intro und Outro je D.

## 3. Bedienung

### 3.1 Modus-Schalter

- Der Segment-Schalter „FOTO | VIDEO“ sitzt mobil in der Topbar links neben EXPORT und am Desktop oben in der Sidebar neben dem Logo.
- Umschalten verwirft nichts. Bilder, Clips und Marker bleiben im jeweiligen Modus erhalten, solange die Seite offen ist.
- Während eines Exports ist der Schalter gesperrt, wie alle anderen Werkzeuge auch.
- Der gewählte Modus wird gespeichert.

### 3.2 Leerer Zustand im Video-Modus

- Statt „+ UPLOAD IMAGE“ erscheint „+ UPLOAD VIDEO“ mit dem Hinweis „MP4 · MOV · WEBM“.
- Drag & Drop auf die Vorschau nimmt im Video-Modus Videos an, im Foto-Modus Bilder. Passt eine Datei nicht zum aktiven Modus, erklärt ein Toast den Grund.

### 3.3 Zeitleiste (ersetzt im Video-Modus die Clip-Leiste)

- Die Clips stehen hintereinander, die Breite jedes Clips ist proportional zu seiner Länge. Jeder Clip zeigt einen Filmstreifen aus Mini-Frames.
- **Abspielkopf:** Ein weißer Strich lässt sich durch Tippen oder Ziehen verschieben (Scrubben). Beim Scrubben pausiert die Wiedergabe.
- **Clip-Grenze:** Eine gefüllte Raute markiert den automatischen Übergang.
- **Marker:** eine leere Raute.
  - **„+ MARKER“** setzt einen Marker an der Position des Abspielkopfs.
  - **Antippen** wählt einen Marker aus. Ein ausgewählter Marker bekommt ein ×, das ihn löscht.
  - **Ziehen** verschiebt einen Marker. Er bleibt dabei im eigenen Clip und rastet auf ganze Frames (30 fps) ein.
- **Intro / Outro:** Ist eine der beiden Optionen an, ist am Anfang bzw. Ende des Videos ein Bereich der Länge D hell schraffiert.
- **„+ CLIP“** hängt weitere Clips an. Clips lassen sich per Long-Press und Ziehen umsortieren und mit × entfernen, wie heute die Bilder.
- **Abstandsregel:** Zwei Übergänge dürfen sich nicht überschneiden. Jeder Shot muss in der Ausgabe mindestens so lang sein, wie seine angrenzenden Übergänge beanspruchen (Formel in 4.2).
  - Ein Marker, der zu dicht an einem anderen Schnitt läge, rastet auf den nächsten gültigen Platz ein.
  - Gibt es dort keinen gültigen Platz, wird er nicht gesetzt, und ein Toast nennt den Grund.

### 3.4 Werkzeuge im Video-Modus

Diese Werkzeuge erscheinen in Sidebar und Toolbar wie heute:

| Werkzeug | Foto | Video | Anmerkung |
|---|---|---|---|
| SIZE, STRETCH, THRESHOLD, REMOVE | ✓ | ✓ | gemeinsam |
| COLOR | ✓ | ✓ | Im Video-Modus nur gesperrt, wenn IMG MASK an ist **und** Intro und Outro beide aus sind. Intro und Outro arbeiten immer mit Farb-Strokes. |
| IMG MASK | ab 2 Bildern | ab 1 Schnitt | |
| MOTION, MOVE | ✓ | ✓ | gemeinsam |
| SPEED, LOOPS | ✓ | – | |
| **DAUER** | – | ✓ | Sekunden, Bereich 0,2–1,5 s, Schritt 0,1 s, Standard 0,6 s. Das Maximum wird zusätzlich durch den kürzesten Shot begrenzt; die Anzeige erklärt dann den Grund, z. B. „max. 0,4 s wegen Marker bei 0:12“. |
| **INTRO / OUTRO** | – | ✓ | zwei Schalter in einem Werkzeug, Standard: beide an |
| **TON** | – | ✓ | an/aus, Standard: an |
| FORMAT | ✓ | ✓ | gemeinsam; „Original“ übernimmt im Video-Modus das Format des ersten Clips |

Der Transport (▶, Motion-Knopf, Shuffle) bleibt gleich. Statt „2× · 12.0 s“ zeigt die Info im Video-Modus „aktuelle Zeit / Gesamtlänge“.

### 3.5 Export im Video-Modus

- Es gibt MP4 und PNG. PNG ist der Frame am Abspielkopf.
- Der Exportdialog mit seinen Phasen (Fortschritt, Abbrechen, SAVE / SHARE) bleibt unverändert.
- **Längenlimit:** Ist die Gesamtlänge der Ausgabe größer als 180 s, ist MP4 gesperrt. Der Dialog zeigt dann den Hinweis „Video zu lang für den Export im Browser (max. 3 min)“. Der Grund: Der Export entsteht im Arbeitsspeicher.

## 4. Zeitmodell (`src/engine/videoTimeline.ts`)

Das Zeitmodell besteht aus reinen Funktionen ohne DOM und lässt sich vollständig in Vitest testen.

### 4.1 Eingabe

```ts
interface VideoTimelineInput {
  clips: readonly { id: string; duration: number }[]; // Quelllänge in s
  markers: readonly { clipId: string; time: number }[]; // Quellzeit in s
  dauer: number;      // D in s
  imgMask: boolean;
  intro: boolean;
  outro: boolean;
}
```

### 4.2 Shots und Ausgabezeit

- Die Clips werden in Reihenfolge an ihren Markern in Shots zerlegt. Jeder Shot hat eine `clipId`, einen `sourceStart` und ein `sourceEnd`.
- Zwischen zwei aufeinanderfolgenden Shots liegt ein Übergang. Seine Breite ist **W = 2 · D**.
- **Ohne IMG MASK** liegen die Shots lückenlos hintereinander. Die Ausgabelänge entspricht der Summe der Shot-Längen, und der Übergang ist mittig auf dem Schnitt: Er läuft von `cut − D` bis `cut + D`.
- **Mit IMG MASK** überlappt Shot B mit dem Ende von Shot A um W. Der Übergang läuft von `endA − W` bis `endA`. Shot B beginnt bei `endA − W` mit seiner Quellzeit `sourceStart`. Die Ausgabelänge entspricht der Summe der Shot-Längen minus `W · (Anzahl Übergänge)`.
- **Mindestlänge eines Shots:** Er muss die Zeit decken, die seine angrenzenden Übergänge bzw. Intro und Outro für sich beanspruchen.
  - Ohne IMG MASK braucht ein innerer Shot ≥ 2 · D (je D für die Hälften der beiden Übergänge). Ein Randshot braucht ≥ D + (Intro bzw. Outro an ? D : 0).
  - Mit IMG MASK braucht ein innerer Shot ≥ 2 · W, ein Randshot ≥ W + (Intro bzw. Outro an ? D : 0).
  - Ein einziger Shot (ein Clip ohne Marker) braucht ≥ (Intro an ? D : 0) + (Outro an ? D : 0).
- `maxDauer(input)` liefert das größte D, bei dem alle Shots die Mindestlänge erfüllen, und dazu den begrenzenden Schnitt.
- `validMarkerTime(input, clipId, time)` gibt die nächste zulässige Quellzeit zurück, oder `null`, wenn es keine gibt.

### 4.3 Abfrage pro Zeitpunkt

```ts
interface VideoFramePosition {
  shot: ShotRef;            // { shotIndex, clipId, sourceTime } – Grundbild
  next: ShotRef | null;     // nur in einer IMG-MASK-Überlappung: Inhalt der Balken
  phase: 'none' | 'intro' | 'transition' | 'outro';
  transitionIndex: number;  // Index des Übergangs; −1 sonst (auch in Intro und Outro)
  progress: number;         // 0..1 im Motion-Sinn (siehe 4.4)
  frameIndex: number;       // t auf dem 30-fps-Raster, für Zufall pro Frame
}
function videoPositionAt(t: number, input: VideoTimelineInput, covered: 'middle' | 'ends'): VideoFramePosition;
function videoDuration(input: VideoTimelineInput): number;
```

### 4.4 Abbildung auf den Motion-`progress`

Die bestehenden Motions laufen über einen Zyklus mit `progress` von 0 bis 1. Damit sie unverändert weiterarbeiten können, rechnet das Zeitmodell jede Video-Phase in diesen Zyklus um:

- **Farb-Übergang**, mit `u = (t − cut) / W ∈ [−0,5; 0,5]`:
  - `covered: 'middle'` (BUILD UP, IMPULSE, WAVE, FADE, GLITCH): `progress = 0,5 + u`. Volle Abdeckung liegt bei 0,5, also genau auf dem Schnitt.
  - `covered: 'ends'` (REVEAL): `progress = frac(1 + u)`. Volle Abdeckung liegt bei 0 bzw. 1, also ebenfalls auf dem Schnitt.
- **Bild unter den Strokes:** bis zum Schnitt Shot A, ab dem Schnitt-Frame Shot B. Das ist dasselbe Prinzip wie die Übergabe in der Foto-Clip-Kette.
- **Intro:** Es läuft die zweite Hälfte eines Farb-Übergangs (`u` von 0 bis 0,5 über D), also das Wegfallen nach voller Abdeckung.
- **Outro:** Es läuft die erste Hälfte (`u` von −0,5 bis 0 über D), also das Aufbauen bis zur vollen Abdeckung im letzten Frame.
- **IMG MASK:** `progress = (t − start) / W` von 0 bis 1. Das ist dieselbe Bedeutung wie heute: `paceLevel` gleich `progress`, und die Balken zeigen Shot B.
- **Außerhalb jeder Phase** werden keine Strokes gezeichnet, und das Video läuft pur.

**Frame-Raster:** Die Zeiten der Schnitte werden auf das 30-fps-Raster der Ausgabe gerundet. So fällt `progress = 0,5` exakt auf einen Ausgabe-Frame, und der Schnitt liegt genau dort.

## 5. Rendering

### 5.1 Geteilte Bausteine aus `render.ts`

- `paintBase`, `barOrder` und `movedStrokes` wandern in ein eigenes Modul (`src/engine/strokes.ts`), damit Foto und Video sie gemeinsam nutzen.
- `render.ts` behält das Verhalten des Foto-Modus bei. Die bestehenden Render-Tests sichern das ab.
- **Bildquellen:** `FrameInput.image`, `FrameInput.nextImage` und die Helfer in `draw.ts` (`drawFitted`, `clipDraw`, `drawInBar`) akzeptieren künftig eine `DrawSource` statt nur `ImageBitmap`.
  - Eine `DrawSource` ist ein `ImageBitmap`, ein `HTMLVideoElement`, ein `VideoFrame` oder ein `OffscreenCanvas`/`HTMLCanvasElement`.
  - Ihre Größe ermittelt ein Helfer `sourceSize()` (`videoWidth`/`videoHeight` bzw. `displayWidth`/`displayHeight`).

### 5.2 `renderVideoFrame(ctx, scene, t, frames)`

- `frames` liefert die aktuellen Bildquellen für `shot` und `next`. In der Vorschau sind das die `<video>`-Elemente, beim Export decodierte Canvases.
- Das Grundbild ist `shot`, eingepasst wie heute (`cover`/`contain`).
- **Balken pro Phase:**
  - **Farb-Übergang:** Vor dem Schnitt gilt der Look von Shot A, gemessen am letzten Frame vor dem Schnitt. Ab dem Schnitt gilt der Look von Shot B, gemessen am ersten Frame danach. In beiden Fällen kommt danach der Rest des Rasters, so wie `barOrder(…, whole = true)` heute.
  - **Intro:** Look des ersten Frames. **Outro:** Look des letzten Frames.
  - **IMG MASK:** Look von Shot A am letzten Frame vor dem Überlappungsende.
- **Seed:** Er wird pro Übergang mit `hashSeed(seed, transitionIndex, …)` abgeleitet. SHUFFLE würfelt alle Übergänge neu.
- **MOVE** wirkt wie im Foto-Modus. `movedStrokes` erhält dazu den umgerechneten `progress`.

### 5.3 Analyse-Frames (`src/video/analysisFrames.ts`)

- Für jeden Schnitt sowie für Anfang und Ende holt das Modul per Mediabunny `CanvasSink` die beiden benötigten Frames als `ImageBitmap`. Die Breite ist dabei auf die Ausgabegröße begrenzt.
- Die Analyse selbst übernimmt der vorhandene `AnalysisCache`. Der Cache-Schlüssel ist `${clipId}@${frameTime}`.
- Neu geholt bzw. berechnet wird nur bei neuen Clips, verschobenen Markern, einem anderen Format oder geänderten Analyse-Einstellungen. Das stufenweise Cachen funktioniert wie heute.
- Analyse-Bitmaps nicht mehr benutzter Schnitte werden mit `close()` freigegeben.

## 6. Vorschau (`src/video/player.ts`)

- Die Vorschau hat eine eigene Uhr: Die Ausgabezeit t läuft per `performance.now()` und rAF.
- **Zwei versteckte `<video>`-Elemente** (`playsinline`, `preload="auto"`):
  - **A** zeigt den aktuellen Shot.
  - **B** lädt vor dem nächsten Schnitt den nächsten Clip vor und an der richtigen Stelle. Mit IMG MASK läuft B während der Überlappung mit.
  - Am Schnitt tauschen A und B die Rollen. So entsteht beim Clipwechsel keine Ladepause.
- **Synchronisierung:** Pro Frame wird `currentTime` gegen die Soll-Quellzeit geprüft. Weicht sie um mehr als 0,1 s ab, wird gesprungen (Seek). Kleinere Abweichungen werden nicht korrigiert.
- **Ton:**
  - Ist TON an, ist das jeweils sichtbare Element hörbar.
  - In einer IMG-MASK-Überlappung blendet die Lautstärke linear von A nach B über.
  - Ist TON aus, sind beide Elemente stumm.
- **Pause und Scrubben:** Beide Elemente springen auf die Soll-Zeit. Gezeichnet wird nach `seeked`.
- **iOS:** Wiedergabe mit Ton startet nur nach einer Nutzergeste. Der ▶-Knopf ist eine solche Geste. Schlägt `play()` trotzdem fehl, läuft die Vorschau stumm weiter und ein Toast erklärt den Grund.
- **Speicher:** Ein Clip wird erst als Object-URL geöffnet, wenn er gebraucht wird. Beim Entfernen des Clips wird die URL wieder freigegeben.

## 7. Import (`src/video/clipImport.ts`)

- Jede Datei wird mit Mediabunny `Input` + `BlobSource` geprüft:
  - Gibt es eine Videospur?
  - Lässt sie sich decodieren (`canDecode()`)?
  - Wie lang ist sie, wie groß, mit welcher Rotation?
  - Gibt es eine Tonspur?
- **Abgelehnt** werden Dateien ohne Videospur und solche mit nicht decodierbarem Codec. Ein Toast nennt jeweils Dateiname und Grund.
- **Filmstreifen:** Für die Zeitleiste werden Mini-Frames geholt, etwa einer pro Sekunde, 48 px hoch, und als Object-URL abgelegt.
- Das `accept` des Datei-Inputs hängt vom Modus ab. Im Video-Modus ist es `video/mp4,video/quicktime,video/webm`.

## 8. Export

### 8.1 Ablauf

- `exportVideo` bekommt eine zweite Szenenart: `VideoProjectScene`. Sie enthält:
  - die Clip-Dateien als `File`, strukturiert klonbar,
  - das Zeitmodell-Input,
  - die fertigen Balken pro Phase als reine Arrays,
  - die Settings, das Format und den Seed.
- `ToWorker` bekommt dafür einen eigenen Nachrichtentyp. Fortschritt und Abbrechen funktionieren wie heute.
- **Im Worker:**
  - Pro Clip öffnen ein `Input` und ein `CanvasSink` (auf Ausgabegröße, Rotation angewendet) den Clip.
  - Die Ausgabe-Frames f = 0 … N−1 werden über `videoPositionAt(f / 30)` aufgelöst. Die Frames werden pro Clip in aufsteigender Zeit über `canvasesAtTimestamps` geholt, damit der Decoder sequentiell läuft.
  - Gerendert wird mit `renderVideoFrame`. Kodiert wird wie heute per `CanvasSource`, mit H.264 bzw. HEVC und 30 fps.
- Quellen mit 60 fps oder variabler Framerate werden auf den jeweils nächsten Quell-Frame abgebildet.

### 8.2 Ton (`src/export/audioMix.ts`)

Das Modul besteht aus reinen Funktionen und wird getestet.

- **Mischen:**
  - Pro Clip liest `AudioSampleSink` die Samples aus der Tonspur. Sie werden nach `f32-planar` kopiert und auf 48 kHz Stereo gebracht (lineares Resampling, Mono wird verdoppelt).
  - Jeder Shot schreibt seinen Abschnitt in einen Mix-Puffer an die Position seiner Ausgabezeit.
  - In IMG-MASK-Überlappungen werden A und B linear übergeblendet.
  - Clips ohne Tonspur ergeben an ihrer Stelle Stille.
- **Kodieren:** Der Puffer wird in Blöcken als `AudioSample` an eine `AudioSampleSource` gegeben. Der Codec ist der erste kodierbare aus `['aac', 'opus']`.
- **Wann ohne Ton exportiert wird:**
  - Ist TON aus oder hat kein Clip eine Tonspur, gibt es keine Tonspur.
  - Kann der Browser keinen Ton kodieren, wird ebenfalls ohne Ton exportiert. Der Dialog zeigt dann nach dem Export den Hinweis „Ohne Ton exportiert – dieser Browser kann keinen Ton kodieren“.

### 8.3 Fehler

- Wenn ein Clip beim Export nicht decodierbar ist, bricht der Export mit einer Meldung ab, die den Clipnamen nennt.
- Abbrechen und Worker-Absturz behandelt der Export wie heute.

## 9. Zustand und Einstellungen

- **`src/engine/types.ts`:**
  - `Settings` bekommt `mode: 'photo' | 'video'`, `dauer: number`, `intro: boolean`, `outro: boolean` und `audio: boolean`.
  - `ToolId` wird um `dauer`, `introOutro` und `audio` erweitert.
- **`src/state/settings.ts`:**
  - Standards: `mode: 'photo'`, `dauer: 0.6`, `intro: true`, `outro: true`, `audio: true`.
  - Für `dauer` gilt die Range `{ min: 0.2, max: 1.5, step: 0.1 }`. `parseSettings` validiert alle neuen Felder.
  - Alte gespeicherte Einstellungen ohne diese Felder werden auf die Standards gesetzt, der Speicherschlüssel `strata:v2` bleibt.
- **`src/state/store.ts`:**
  - Neue Signals: `videoClips: VideoClipEntry[]` (id, name, file, duration, size, rotation, hasAudio, filmstrip) und `markers: Marker[]`.
  - `playhead` speichert die Ausgabezeit in Sekunden, `selectedMarker` den gewählten Marker.
- `colorLocked()` berücksichtigt den Modus (siehe 3.4). `TOOLS` bekommt pro Werkzeug eine Angabe `modes`, und Sidebar und Toolbar filtern danach.

## 10. Dateistruktur

| Datei | Art | Inhalt |
|---|---|---|
| `src/engine/videoTimeline.ts` | neu | Zeitmodell (Abschnitt 4) |
| `src/engine/strokes.ts` | neu | aus `render.ts` herausgelöst: `paintBase`, `barOrder`, `movedStrokes` und die Grid-Helfer |
| `src/engine/renderVideo.ts` | neu | `renderVideoFrame`, `VideoProjectScene` |
| `src/engine/render.ts` | geändert | nutzt `strokes.ts`, Verhalten unverändert |
| `src/engine/draw.ts`, `motions/types.ts` | geändert | `DrawSource` statt `ImageBitmap` |
| `src/engine/types.ts`, `src/state/settings.ts`, `src/state/store.ts` | geändert | siehe Abschnitt 9 |
| `src/video/clipImport.ts` | neu | Prüfen, Metadaten und Filmstreifen |
| `src/video/analysisFrames.ts` | neu | Analyse-Frames an den Schnitten |
| `src/video/player.ts` | neu | Vorschau-Controller mit zwei `<video>`-Elementen |
| `src/ui/modeSwitch.ts` | neu | Segment-Schalter |
| `src/ui/timeline.ts` | neu | Zeitleiste mit Abspielkopf, Markern und Clips |
| `src/ui/controls.ts`, `src/ui/tools.ts` | geändert | DAUER, INTRO/OUTRO, TON; `modes` pro Werkzeug |
| `src/ui/preview.ts`, `src/ui/transport.ts`, `src/ui/exportDialog.ts`, `src/main.ts`, `index.html` | geändert | modusabhängiges Verhalten |
| `src/export/audioMix.ts` | neu | Ton-Mix (reine Funktionen) |
| `src/export/video.worker.ts`, `protocol.ts`, `video.ts` | geändert | Video-Projekt-Export |

## 11. Tests

- **`tests/engine/videoTimeline.test.ts`:**
  - Shots aus Clips und Markern.
  - Ausgabelänge mit und ohne IMG MASK.
  - `progress = 0,5` exakt auf dem Schnitt-Frame (für `middle` und `ends`).
  - Intro und Outro.
  - Grundbild-Wechsel am Schnitt.
  - `maxDauer` und `validMarkerTime`.
  - Rundung auf das 30-fps-Raster.
- **`tests/export/audioMix.test.ts`:**
  - Platzierung im Mix-Puffer.
  - Lineare Überblendung.
  - Resampling.
  - Mono zu Stereo.
  - Stille bei Clips ohne Tonspur.
- **`tests/state/settings.test.ts`:** neue Felder, Grenzen, alte gespeicherte Einstellungen.
- **`tests/engine/render.test.ts`** bleibt grün. Neu kommt ein Test für `renderVideoFrame` mit synthetischen Canvas-Quellen: Vor dem Schnitt liegt A unter den Strokes, danach B.
- **Manuell im Browser:**
  - Chrome und Safari auf dem Mac: Import, Vorschau, Scrubben, Marker, IMG MASK und MP4-Export mit Ton.
  - iPhone (macht der Nutzer): Hochkant-HEVC importieren, abspielen und exportieren, danach „Video sichern“.

## 12. Risiken

- **Safari und WebCodecs-Audio:** Ältere Safari-Versionen können keinen Ton kodieren. Dann greift der Fallback „ohne Ton“ mit Hinweis.
- **HEVC unter Chrome und Windows:** Ob HEVC decodiert werden kann, hängt von der Plattform ab. `canDecode()` lehnt solche Clips beim Import sauber ab.
- **Speicher:** Der Export liegt als `BufferTarget` im RAM. Das 180-s-Limit hält die Größe bei 1080 × 1920 in einem vertretbaren Rahmen.
- **Drift in der Vorschau:** Der Seek-Schwellenwert von 0,1 s kann auf langsamen Geräten zu Rucklern führen. Der Wert wird bei den Browser-Tests justiert.
