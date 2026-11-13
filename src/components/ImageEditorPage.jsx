import { useEffect, useRef, useState } from 'react';

const CORNERS = ['nw', 'ne', 'sw', 'se'];

const BLUR_SHAPES = [
  { value: 'rect', label: 'Rectangle' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'ellipse', label: 'Circle / Ellipse' },
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function drawRoundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

let measureCtx = null;
function measureTextBox(item) {
  if (!measureCtx && typeof document !== 'undefined') {
    measureCtx = document.createElement('canvas').getContext('2d');
  }
  if (!measureCtx) {
    return {
      width: Math.max(24, item.text.length * item.fontSize * 0.6),
      height: item.fontSize * 1.2,
    };
  }
  measureCtx.font = `600 ${item.fontSize}px system-ui, -apple-system, sans-serif`;
  return {
    width: Math.max(24, measureCtx.measureText(item.text).width),
    height: item.fontSize * 1.2,
  };
}

export default function ImageEditorPage() {
  const [imageData, setImageData] = useState(null);
  const [blurs, setBlurs] = useState([]);
  const [texts, setTexts] = useState([]);
  const [selected, setSelected] = useState(null); // { kind: 'blur' | 'text', id }

  const [textInput, setTextInput] = useState('Sample Text');
  const [textColor, setTextColor] = useState('#111827');
  const [fontSize, setFontSize] = useState(36);

  const [blurShape, setBlurShape] = useState('rect');
  const [blurAmount, setBlurAmount] = useState(14);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const imgElementRef = useRef(null);
  const objectUrlRef = useRef(null);
  const interactionRef = useRef(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const displaySize = imageData
    ? (() => {
        const maxW = 720;
        const maxH = 480;
        const scale = Math.min(1, maxW / imageData.width, maxH / imageData.height);
        return {
          width: Math.round(imageData.width * scale),
          height: Math.round(imageData.height * scale),
          scale,
        };
      })()
    : null;

  // Render base image + blurs + texts onto the full-resolution canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const imgEl = imgElementRef.current;
    if (!canvas || !imgEl || !imageData) return;

    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, imageData.width, imageData.height);
    ctx.drawImage(imgEl, 0, 0, imageData.width, imageData.height);

    for (const blur of blurs) {
      ctx.save();
      if (blur.shape === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(
          blur.x + blur.width / 2,
          blur.y + blur.height / 2,
          blur.width / 2,
          blur.height / 2,
          0,
          0,
          Math.PI * 2
        );
      } else if (blur.shape === 'rounded') {
        drawRoundedRectPath(
          ctx,
          blur.x,
          blur.y,
          blur.width,
          blur.height,
          Math.min(blur.width, blur.height) * 0.2
        );
      } else {
        ctx.beginPath();
        ctx.rect(blur.x, blur.y, blur.width, blur.height);
      }
      ctx.clip();
      ctx.filter = `blur(${blur.blur}px)`;
      ctx.drawImage(imgEl, 0, 0, imageData.width, imageData.height);
      ctx.restore();
    }

    for (const item of texts) {
      ctx.save();
      ctx.font = `600 ${item.fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = item.color;
      ctx.textBaseline = 'top';
      ctx.fillText(item.text, item.x, item.y);
      ctx.restore();
    }
  }, [imageData, blurs, texts]);

  // Pointer drag / resize handling
  useEffect(() => {
    const handlePointerMove = (e) => {
      const interaction = interactionRef.current;
      if (!interaction || !imageData || !displaySize) return;

      const dx = (e.clientX - interaction.startX) / displaySize.scale;
      const dy = (e.clientY - interaction.startY) / displaySize.scale;

      if (interaction.kind === 'text' && interaction.type === 'drag') {
        const nextX = clamp(interaction.origX + dx, 0, Math.max(0, imageData.width - 20));
        const nextY = clamp(interaction.origY + dy, 0, Math.max(0, imageData.height - 20));
        setTexts((prev) =>
          prev.map((t) => (t.id === interaction.id ? { ...t, x: nextX, y: nextY } : t))
        );
        return;
      }

      if (interaction.kind === 'blur' && interaction.type === 'drag') {
        const nextX = clamp(
          interaction.origX + dx,
          0,
          Math.max(0, imageData.width - interaction.origWidth)
        );
        const nextY = clamp(
          interaction.origY + dy,
          0,
          Math.max(0, imageData.height - interaction.origHeight)
        );
        setBlurs((prev) =>
          prev.map((b) => (b.id === interaction.id ? { ...b, x: nextX, y: nextY } : b))
        );
        return;
      }

      if (interaction.kind === 'blur' && interaction.type === 'resize') {
        const { corner, origX, origY, origWidth, origHeight } = interaction;
        const minSize = 24 / displaySize.scale;
        let nextX = origX;
        let nextY = origY;
        let nextW = origWidth;
        let nextH = origHeight;

        if (corner === 'se' || corner === 'ne') {
          nextW = clamp(origWidth + dx, minSize, imageData.width - origX);
        } else {
          const maxLeftMove = origWidth - minSize;
          const clampedDx = clamp(dx, -origX, maxLeftMove);
          nextX = origX + clampedDx;
          nextW = origWidth - clampedDx;
        }

        if (corner === 'se' || corner === 'sw') {
          nextH = clamp(origHeight + dy, minSize, imageData.height - origY);
        } else {
          const maxTopMove = origHeight - minSize;
          const clampedDy = clamp(dy, -origY, maxTopMove);
          nextY = origY + clampedDy;
          nextH = origHeight - clampedDy;
        }

        setBlurs((prev) =>
          prev.map((b) =>
            b.id === interaction.id
              ? { ...b, x: nextX, y: nextY, width: nextW, height: nextH }
              : b
          )
        );
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
  }, [imageData, displaySize]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError('');
    const src = URL.createObjectURL(file);
    try {
      const imgEl = await loadImage(src);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = src;
      imgElementRef.current = imgEl;

      setImageData({
        src,
        name: file.name,
        width: imgEl.naturalWidth,
        height: imgEl.naturalHeight,
      });
      setBlurs([]);
      setTexts([]);
      setSelected(null);
      setFontSize(Math.max(16, Math.round(imgEl.naturalHeight * 0.06)));
    } catch (err) {
      URL.revokeObjectURL(src);
      setError('Could not load this image. Please use a PNG or JPG file.');
      console.error(err);
    }
  };

  const handleAddText = () => {
    if (!imageData || !textInput.trim()) return;

    const newText = {
      id: crypto.randomUUID(),
      text: textInput.trim(),
      color: textColor,
      fontSize,
      x: Math.round(imageData.width * 0.1),
      y: Math.round(imageData.height * 0.1),
    };
    setTexts((prev) => [...prev, newText]);
    setSelected({ kind: 'text', id: newText.id });
  };

  const handleAddBlur = () => {
    if (!imageData) return;

    const width = Math.round(imageData.width * 0.25);
    const height = Math.round(imageData.height * 0.2);
    const newBlur = {
      id: crypto.randomUUID(),
      shape: blurShape,
      blur: blurAmount,
      x: Math.round((imageData.width - width) / 2),
      y: Math.round((imageData.height - height) / 2),
      width,
      height,
    };
    setBlurs((prev) => [...prev, newBlur]);
    setSelected({ kind: 'blur', id: newBlur.id });
  };

  const handleReset = () => {
    setBlurs([]);
    setTexts([]);
    setSelected(null);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageData) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const baseName = imageData.name.replace(/\.[^.]+$/, '');
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}-edited.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  };

  return (
    <main className="workspace" onClick={() => setSelected(null)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        onChange={handleUpload}
        hidden
      />

      {error && <p className="editor__error">{error}</p>}

      {!imageData ? (
        <div className="empty-state bg-remover__empty">
          <p>Upload a PNG or JPG image to add text or blur shapes.</p>
          <button
            type="button"
            className="toolbar__btn toolbar__btn--primary"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload Image
          </button>
        </div>
      ) : (
        <div className="img-editor" onClick={(e) => e.stopPropagation()}>
          <div className="img-editor__controls">
            <div className="img-editor__group">
              <input
                type="text"
                className="img-editor__input"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Enter text..."
              />
              <label className="modal__field">
                <span>Color</span>
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                />
              </label>
              <label className="modal__field">
                <span>Size</span>
                <input
                  type="number"
                  min="10"
                  max="200"
                  className="img-editor__num"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value) || 16)}
                />
              </label>
              <button
                type="button"
                className="toolbar__btn"
                onClick={handleAddText}
              >
                Add Text
              </button>
            </div>

            <div className="img-editor__group">
              <label className="modal__field">
                <span>Shape</span>
                <select
                  className="img-editor__select"
                  value={blurShape}
                  onChange={(e) => setBlurShape(e.target.value)}
                >
                  {BLUR_SHAPES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="modal__field">
                <span>Blur ({blurAmount}px)</span>
                <input
                  type="range"
                  min="2"
                  max="40"
                  value={blurAmount}
                  onChange={(e) => setBlurAmount(Number(e.target.value))}
                />
              </label>
              <button
                type="button"
                className="toolbar__btn"
                onClick={handleAddBlur}
              >
                Add Blur
              </button>
            </div>

            <div className="img-editor__group">
              <button
                type="button"
                className="toolbar__btn"
                onClick={() => fileInputRef.current?.click()}
              >
                Change Image
              </button>
              <button
                type="button"
                className="toolbar__btn"
                disabled={blurs.length === 0 && texts.length === 0}
                onClick={handleReset}
              >
                Reset
              </button>
              <button
                type="button"
                className="toolbar__btn toolbar__btn--primary"
                onClick={handleDownload}
              >
                Download PNG
              </button>
            </div>
          </div>

          <div
            className="img-editor__stage"
            style={{
              width: `${displaySize.width}px`,
              height: `${displaySize.height}px`,
            }}
            onClick={() => setSelected(null)}
          >
            <canvas
              ref={canvasRef}
              className="img-editor__canvas"
              style={{
                width: `${displaySize.width}px`,
                height: `${displaySize.height}px`,
              }}
            />

            {blurs.map((blur) => {
              const isSelected = selected?.kind === 'blur' && selected.id === blur.id;
              return (
                <div
                  key={blur.id}
                  className={`img-editor__overlay ${
                    blur.shape === 'ellipse' ? 'is-ellipse' : ''
                  } ${isSelected ? 'is-selected' : ''}`}
                  style={{
                    left: `${blur.x * displaySize.scale}px`,
                    top: `${blur.y * displaySize.scale}px`,
                    width: `${blur.width * displaySize.scale}px`,
                    height: `${blur.height * displaySize.scale}px`,
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setSelected({ kind: 'blur', id: blur.id });
                    interactionRef.current = {
                      kind: 'blur',
                      type: 'drag',
                      id: blur.id,
                      startX: e.clientX,
                      startY: e.clientY,
                      origX: blur.x,
                      origY: blur.y,
                      origWidth: blur.width,
                      origHeight: blur.height,
                    };
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isSelected && (
                    <>
                      <button
                        type="button"
                        className="placed-image__remove"
                        aria-label="Remove blur"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setBlurs((prev) => prev.filter((b) => b.id !== blur.id));
                          setSelected(null);
                        }}
                      >
                        ×
                      </button>
                      {CORNERS.map((corner) => (
                        <span
                          key={corner}
                          className={`placed-image__handle placed-image__handle--${corner}`}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            interactionRef.current = {
                              kind: 'blur',
                              type: 'resize',
                              corner,
                              id: blur.id,
                              startX: e.clientX,
                              startY: e.clientY,
                              origX: blur.x,
                              origY: blur.y,
                              origWidth: blur.width,
                              origHeight: blur.height,
                            };
                          }}
                        />
                      ))}
                    </>
                  )}
                </div>
              );
            })}

            {texts.map((item) => {
              const isSelected = selected?.kind === 'text' && selected.id === item.id;
              const box = measureTextBox(item);
              return (
                <div
                  key={item.id}
                  className={`img-editor__overlay ${isSelected ? 'is-selected' : ''}`}
                  style={{
                    left: `${item.x * displaySize.scale}px`,
                    top: `${item.y * displaySize.scale}px`,
                    width: `${box.width * displaySize.scale}px`,
                    height: `${box.height * displaySize.scale}px`,
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setSelected({ kind: 'text', id: item.id });
                    interactionRef.current = {
                      kind: 'text',
                      type: 'drag',
                      id: item.id,
                      startX: e.clientX,
                      startY: e.clientY,
                      origX: item.x,
                      origY: item.y,
                    };
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isSelected && (
                    <button
                      type="button"
                      className="placed-image__remove"
                      aria-label="Remove text"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTexts((prev) => prev.filter((t) => t.id !== item.id));
                        setSelected(null);
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
