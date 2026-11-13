import { useEffect, useRef } from 'react';
import DraggableImage from './DraggableImage';

export default function PdfPage({
  page,
  pageIndex,
  scale,
  width,
  height,
  images,
  selectedImageId,
  onSelectPage,
  onSelectImage,
  onChangeImage,
  onRemoveImage,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !page) return;

    const dpr = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale });

    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const context = canvas.getContext('2d');
    const renderTask = page.render({
      canvasContext: context,
      viewport,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
    });

    return () => {
      renderTask.cancel();
    };
  }, [page, scale]);

  return (
    <div
      className="pdf-page"
      style={{ width: `${width}px`, height: `${height}px` }}
      onClick={() => {
        onSelectPage(pageIndex);
        onSelectImage(null);
      }}
    >
      <canvas ref={canvasRef} className="pdf-page__canvas" />

      {images.map((img) => (
        <DraggableImage
          key={img.id}
          image={img}
          pageWidth={width}
          pageHeight={height}
          isSelected={img.id === selectedImageId}
          onSelect={(id) => {
            onSelectPage(pageIndex);
            onSelectImage(id);
          }}
          onChange={onChangeImage}
          onRemove={onRemoveImage}
        />
      ))}
    </div>
  );
}

