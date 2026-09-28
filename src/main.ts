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
