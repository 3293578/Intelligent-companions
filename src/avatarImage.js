const SUPPORTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_SOURCE_BYTES = 6 * 1024 * 1024;
const OUTPUT_SIZE = 320;

export function validateAvatarFile(file = {}) {
  if (!SUPPORTED_TYPES.has(file.type)) return { ok: false, error: 'Choose a PNG, JPEG, or WebP image.' };
  if (Number(file.size || 0) > MAX_SOURCE_BYTES) return { ok: false, error: 'Choose an image smaller than 6 MB.' };
  return { ok: true, error: '' };
}

export function avatarCrop(width, height) {
  const size = Math.min(width, height);
  return { sx: (width - size) / 2, sy: (height - size) / 2, size };
}

export async function processAvatarFile(file, env = globalThis) {
  const validation = validateAvatarFile(file);
  if (!validation.ok) throw new Error(validation.error);

  const source = await new Promise((resolve, reject) => {
    const image = new env.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not read that image.'));
    image.src = env.URL.createObjectURL(file);
  });
  const crop = avatarCrop(source.naturalWidth, source.naturalHeight);
  const canvas = env.document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  canvas.getContext('2d').drawImage(source, crop.sx, crop.sy, crop.size, crop.size, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  env.URL.revokeObjectURL(source.src);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Could not prepare that image.'));
      const reader = new env.FileReader();
      reader.onload = () => resolve({ kind: 'custom', dataUrl: reader.result, mimeType: 'image/webp' });
      reader.onerror = () => reject(new Error('Could not save that image.'));
      reader.readAsDataURL(blob);
    }, 'image/webp', 0.82);
  });
}
