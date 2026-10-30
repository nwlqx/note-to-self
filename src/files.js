// Prepares a file for upload. Photos are resized and saved as JPEG so a phone
// picture of handwritten notes stays sharp but small (usually 300–700 KB).
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_SIDE = 2400;

const toBase64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

async function shrinkImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
  return blob;
}

export async function prepareUpload(file) {
  let blob = file;
  let name = file.name || 'file';
  let type = file.type || 'application/octet-stream';
  if (/^image\/(jpeg|png|heic|heif|webp)$/.test(type)) {
    try {
      blob = await shrinkImage(file);
      type = 'image/jpeg';
      name = name.replace(/\.[^.]+$/, '') + '.jpg';
    } catch {
      /* couldn't decode: upload the original */
    }
  }
  if (blob.size > MAX_BYTES) throw new Error(`${file.name} is over 20 MB. Try a smaller file or a link instead.`);
  return { name, type, size: blob.size, base64: toBase64(await blob.arrayBuffer()) };
}

export const formatSize = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
