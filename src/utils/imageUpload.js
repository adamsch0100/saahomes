/**
 * Read an image the user picked into a data: URL for the upload endpoints
 * (brokerage logo/icon, agent photo). PNG, JPEG, WebP or SVG, ≤ 600 KB.
 */
export const IMAGE_UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
export const IMAGE_UPLOAD_MAX_BYTES = 600 * 1024;

export function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file chosen'));
      return;
    }
    if (!IMAGE_UPLOAD_TYPES.includes(file.type)) {
      reject(new Error('Use a PNG, JPEG, WebP or SVG image.'));
      return;
    }
    if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
      reject(new Error('That image is over 600 KB. Use a smaller one.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.readAsDataURL(file);
  });
}
