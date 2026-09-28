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

  // A second Esc / Android back can still close the dialog; never keep rendering invisibly.
  dialog.addEventListener('close', () => {
    if (phase.name === 'running') job?.cancel();
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
