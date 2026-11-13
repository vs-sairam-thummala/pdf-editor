import { useEffect, useRef } from 'react';

const CORNERS = ['nw', 'ne', 'sw', 'se'];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function DraggableImage({
  image,
  pageWidth,
  pageHeight,
  isSelected,
  onSelect,
  onChange,
  onRemove,
}) {
  const interactionRef = useRef(null);

  useEffect(() => {
    const handlePointerMove = (e) => {
      const interaction = interactionRef.current;
      if (!interaction) return;

      const dx = e.clientX - interaction.startX;
      const dy = e.clientY - interaction.startY;

      if (interaction.type === 'drag') {
        const nextX = clamp(
          interaction.origX + dx,
          0,
          Math.max(0, pageWidth - interaction.origWidth)
        );
        const nextY = clamp(
          interaction.origY + dy,
          0,
          Math.max(0, pageHeight - interaction.origHeight)
        );
        onChange(image.id, { x: nextX, y: nextY });
        return;
      }

      if (interaction.type === 'resize') {
        const { corner, origX, origY, origWidth, origHeight } = interaction;
        const { aspectRatio } = image;
        const isLeft = corner === 'nw' || corner === 'sw';
        const isTop = corner === 'nw' || corner === 'ne';

        const anchorX = isLeft ? origX + origWidth : origX;
        const anchorY = isTop ? origY + origHeight : origY;

        const maxWByX = isLeft ? anchorX : pageWidth - anchorX;
        const maxHByY = isTop ? anchorY : pageHeight - anchorY;
        const maxW = Math.min(maxWByX, maxHByY * aspectRatio);
        const minW = Math.min(maxW, Math.max(24, 24 * aspectRatio));

        const rawWidth = isLeft ? origWidth - dx : origWidth + dx;
        const nextWidth = clamp(rawWidth, minW, maxW);
        const nextHeight = nextWidth / aspectRatio;
        const nextX = isLeft ? anchorX - nextWidth : anchorX;
        const nextY = isTop ? anchorY - nextHeight : anchorY;

        onChange(image.id, {
          x: nextX,
          y: nextY,
          width: nextWidth,
          height: nextHeight,
        });
      }
    };

    const handlePointerUp = () => {
      interactionRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [image, pageWidth, pageHeight, onChange]);

  const startDrag = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(image.id);
    interactionRef.current = {
      type: 'drag',
      startX: e.clientX,
      startY: e.clientY,
      origX: image.x,
      origY: image.y,
      origWidth: image.width,
      origHeight: image.height,
    };
  };

  const startResize = (corner) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(image.id);
    interactionRef.current = {
      type: 'resize',
      corner,
      startX: e.clientX,
      startY: e.clientY,
      origX: image.x,
      origY: image.y,
      origWidth: image.width,
      origHeight: image.height,
    };
  };

  return (
    <div
      className={`placed-image ${isSelected ? 'is-selected' : ''}`}
      style={{
        left: `${image.x}px`,
        top: `${image.y}px`,
        width: `${image.width}px`,
        height: `${image.height}px`,
      }}
      onPointerDown={startDrag}
      onClick={(e) => e.stopPropagation()}
    >
      <img
        src={image.src}
        alt="Added overlay"
        draggable={false}
        className="placed-image__img"
      />

      {isSelected && (
        <>
          <button
            type="button"
            className="placed-image__remove"
            title="Remove image"
            aria-label="Remove image"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(image.id);
            }}
          >
            ×
          </button>

          {CORNERS.map((corner) => (
            <span
              key={corner}
              className={`placed-image__handle placed-image__handle--${corner}`}
              onPointerDown={startResize(corner)}
            />
          ))}
        </>
      )}
    </div>
  );
}

