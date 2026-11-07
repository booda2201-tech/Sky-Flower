/**
 * Reads a photo from the device and shrinks it to a small JPEG `data:` URL, so a product photo takes
 * ~100 KB of the browser's storage rather than several MB. Rejects when the file is not an image.
 */
export async function photoToDataUrl(file: File, maxSide = 900, quality = 0.82): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not an image');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.fillStyle = '#fff'; // JPEG has no transparency
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    bitmap.close();
  }
}
