import { PDFDocument } from 'pdf-lib';

function isPng(bytes, mimeType) {
  if (mimeType === 'image/png') return true;
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

/**
 * Embeds all added images into the original PDF and downloads the result.
 */
export async function exportPdfWithImages({
  pdfBytes,
  images,
  pages,
  fileName = 'document.pdf',
}) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pdfPages = pdfDoc.getPages();

  for (const img of images) {
    const pdfPage = pdfPages[img.pageIndex];
    const pageMeta = pages[img.pageIndex];
    if (!pdfPage || !pageMeta) continue;

    const { x: cropX, y: cropY, width: pdfWidth, height: pdfHeight } =
      pdfPage.getCropBox();

    const scaleX = pdfWidth / pageMeta.width;
    const scaleY = pdfHeight / pageMeta.height;

    const embeddedImage = isPng(img.bytes, img.mimeType)
      ? await pdfDoc.embedPng(img.bytes)
      : await pdfDoc.embedJpg(img.bytes);

    const drawWidth = img.width * scaleX;
    const drawHeight = img.height * scaleY;
    const drawX = cropX + img.x * scaleX;
    const drawY = cropY + pdfHeight - (img.y + img.height) * scaleY;

    pdfPage.drawImage(embeddedImage, {
      x: drawX,
      y: drawY,
      width: drawWidth,
      height: drawHeight,
    });
  }

  const modifiedBytes = await pdfDoc.save();
  const blob = new Blob([modifiedBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const baseName = fileName.replace(/\.pdf$/i, '');
  const link = document.createElement('a');
  link.href = url;
  link.download = `${baseName}-edited.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

