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

export default function ImageUploadModal({ image, onConfirm, onCancel }) {
  const [targetColor, setTargetColor] = useState('#ffffff');
  const [tolerance, setTolerance] = useState(30);
  const [processed, setProcessed] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const processedUrlRef = useRef(null);
  const previewImgRef = useRef(null);

  useEffect(() => {
    return () => {
      if (processedUrlRef.current) {
        URL.revokeObjectURL(processedUrlRef.current);
      }
    };
  }, []);

  const current = processed || image;

  const handleRemoveBackground = async () => {
    setIsProcessing(true);
    try {
      const result = await removeSolidBackground(image.src, targetColor, tolerance);
      if (processedUrlRef.current) {
        URL.revokeObjectURL(processedUrlRef.current);
      }
      processedUrlRef.current = result.src;
      setProcessed(result);
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

  const handleConfirm = () => {
    if (processed) {
      // Transfer ownership of processedUrlRef to parent; revoke original
      processedUrlRef.current = null;
      URL.revokeObjectURL(image.src);
      onConfirm(processed);
    } else {
      onConfirm(image);
    }
  };

  const handleCancel = () => {
    URL.revokeObjectURL(image.src);
    onCancel();
  };

  return (
    <div className="modal-backdrop" onClick={handleCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal__title">Image Preview</h2>

        <div className="modal__preview-wrap">
          <img
            ref={previewImgRef}
            src={current.src}
            alt="Upload preview"
            className="modal__preview-img"
            title="Click anywhere on the image to pick a background color"
            onClick={handlePickColorFromImage}
          />
        </div>

        <p className="modal__hint">
          Click the image or pick a color below to remove a solid background.
        </p>

        <div className="modal__controls">
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
        </div>

        <div className="modal__actions">
          <button type="button" className="toolbar__btn" onClick={handleCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="toolbar__btn toolbar__btn--primary"
            onClick={handleConfirm}
          >
            Add to PDF
          </button>
        </div>
      </div>
    </div>
  );
}

