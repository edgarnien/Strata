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
