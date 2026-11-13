function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/**
 * Removes pixels matching the target hex color (within tolerance) using Canvas API
 * and returns a transparent PNG as { src, bytes, mimeType, width, height }.
 */
export async function removeSolidBackground(imageSrc, targetHex = '#ffffff', tolerance = 30) {
  const img = await loadImage(imageSrc);
  const width = img.naturalWidth;
  const height = img.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const { r: tr, g: tg, b: tb } = hexToRgb(targetHex);
  const maxDist = (tolerance / 100) * 220;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) continue;

    const dr = data[i] - tr;
    const dg = data[i + 1] - tg;
    const db = data[i + 2] - tb;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    if (dist <= maxDist) {
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('PNG export failed'))),
      'image/png'
    );
  });

  const buffer = await blob.arrayBuffer();
  return {
    src: URL.createObjectURL(blob),
    bytes: new Uint8Array(buffer),
    mimeType: 'image/png',
    width,
    height,
  };
}

