import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';
import { makeTestImage } from './dev/testImage';
import { loadTestVideos } from './dev/testVideos';
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

const byId = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing in index.html`);
  return el as T;
};

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

if (import.meta.env.DEV) {
  const loadTestImage = async (accent?: string, width?: number, height?: number) =>
    addImageFiles([await makeTestImage(accent, width, height)]);
  Object.assign(window, { __strata: { addImageFiles, addVideoFiles, buildScene, exportVideo, loadTestImage, loadTestVideos, patchSettings } });
}
