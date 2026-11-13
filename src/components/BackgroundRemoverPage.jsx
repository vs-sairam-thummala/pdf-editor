import { useEffect, useRef, useState } from 'react';
import { removeSolidBackground } from '../utils/removeBackground';

function rgbToHex(r, g, b) {
  return (
    '#' +
    [r, g, b]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

export default function BackgroundRemoverPage() {
  const [original, setOriginal] = useState(null);
  const [processed, setProcessed] = useState(null);
  const [targetColor, setTargetColor] = useState('#ffffff');
  const [tolerance, setTolerance] = useState(30);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);
  const previewImgRef = useRef(null);
  const originalUrlRef = useRef(null);
  const processedUrlRef = useRef(null);

  useEffect(() => {
    return () => {
      if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
      if (processedUrlRef.current) URL.revokeObjectURL(processedUrlRef.current);
    };
  }, []);

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError('');
    if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
    if (processedUrlRef.current) {
      URL.revokeObjectURL(processedUrlRef.current);
      processedUrlRef.current = null;
    }

    const src = URL.createObjectURL(file);
    originalUrlRef.current = src;
    setOriginal({ src, name: file.name });
    setProcessed(null);
  };

  const handleRemoveBackground = async () => {
    if (!original) return;

    setIsProcessing(true);
    setError('');
    try {
      const result = await removeSolidBackground(original.src, targetColor, tolerance);
      if (processedUrlRef.current) {
        URL.revokeObjectURL(processedUrlRef.current);
      }
      processedUrlRef.current = result.src;
      setProcessed(result);
    } catch (err) {
      setError('Failed to process this image.');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    if (processedUrlRef.current) {
      URL.revokeObjectURL(processedUrlRef.current);
      processedUrlRef.current = null;
    }
    setProcessed(null);
  };

  const handlePickColorFromImage = (e) => {
    const imgEl = previewImgRef.current;
    if (!imgEl) return;

    const rect = imgEl.getBoundingClientRect();
    const scaleX = imgEl.naturalWidth / rect.width;
    const scaleY = imgEl.naturalHeight / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const canvas = document.createElement('canvas');
    canvas.width = imgEl.naturalWidth;
    canvas.height = imgEl.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, 0, 0);
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    if (pixel[3] > 0) {
      setTargetColor(rgbToHex(pixel[0], pixel[1], pixel[2]));
    }
  };

  const handleDownload = () => {
    const active = processed || original;
    if (!active) return;

    const baseName = original.name.replace(/\.[^.]+$/, '');
    const link = document.createElement('a');
    link.href = active.src;
    link.download = `${baseName}-no-bg.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const current = processed || original;

  return (
    <main className="workspace">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        onChange={handleUpload}
        hidden
      />

      {error && <p className="editor__error">{error}</p>}

      {!current ? (
        <div className="empty-state bg-remover__empty">
          <p>Upload a PNG or JPG image to remove its background.</p>
          <button
            type="button"
            className="toolbar__btn toolbar__btn--primary"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload Image
          </button>
        </div>
      ) : (
        <div className="bg-remover">
          <div className="modal__preview-wrap bg-remover__preview">
            <img
              ref={previewImgRef}
              src={current.src}
              alt="Background removal preview"
              className="modal__preview-img bg-remover__img"
              title="Click anywhere on the image to pick a background color"
              onClick={handlePickColorFromImage}
            />
          </div>

          <p className="modal__hint">
            Click the image or pick a color below to remove a solid background.
          </p>

          <div className="modal__controls">
            <button
              type="button"
              className="toolbar__btn"
              onClick={() => fileInputRef.current?.click()}
            >
              Change Image
            </button>

            <label className="modal__field">
              <span>Color</span>
              <input
                type="color"
                value={targetColor}
                onChange={(e) => setTargetColor(e.target.value)}
              />
            </label>

            <label className="modal__field modal__field--grow">
              <span>Tolerance ({tolerance})</span>
              <input
                type="range"
                min="0"
                max="100"
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
              />
            </label>

            <button
              type="button"
              className="toolbar__btn"
              disabled={isProcessing}
              onClick={handleRemoveBackground}
            >
              {isProcessing ? 'Processing...' : 'Remove Background'}
            </button>

            {processed && (
              <button
                type="button"
                className="toolbar__btn"
                onClick={handleReset}
              >
                Reset
              </button>
            )}

            <button
              type="button"
              className="toolbar__btn toolbar__btn--primary"
              disabled={!processed}
              onClick={handleDownload}
            >
              Download PNG
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

