import { useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';

export default function MergePdfPage() {
  const [files, setFiles] = useState([]);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState('');
  const [dragIndex, setDragIndex] = useState(null);

  const fileInputRef = useRef(null);

  const handleAddFiles = async (e) => {
    const selected = Array.from(e.target.files || []);
    e.target.value = '';
    if (selected.length === 0) return;

    setError('');
    const loaded = [];

    for (const file of selected) {
      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const doc = await PDFDocument.load(bytes);
        loaded.push({
          id: crypto.randomUUID(),
          name: file.name,
          pageCount: doc.getPageCount(),
          bytes,
        });
      } catch (err) {
        setError(`Could not read "${file.name}". Make sure it is a valid PDF.`);
        console.error(err);
      }
    }

    if (loaded.length > 0) {
      setFiles((prev) => [...prev, ...loaded]);
    }
  };

  const moveItem = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= files.length || fromIndex === toIndex) return;
    setFiles((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const removeItem = (id) => {
    setFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const handleMerge = async () => {
    if (files.length < 2 || isMerging) return;

    setIsMerging(true);
    setError('');
    try {
      const mergedPdf = await PDFDocument.create();
      for (const item of files) {
        const srcDoc = await PDFDocument.load(item.bytes);
        const copiedPages = await mergedPdf.copyPages(
          srcDoc,
          srcDoc.getPageIndices()
        );
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([mergedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = 'merged.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError('Failed to merge PDFs.');
      console.error(err);
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <main className="workspace">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        onChange={handleAddFiles}
        hidden
      />

      {error && <p className="editor__error">{error}</p>}

      {files.length === 0 ? (
        <div className="empty-state bg-remover__empty">
          <p>Upload multiple PDF files, arrange their order, and merge them.</p>
          <button
            type="button"
            className="toolbar__btn toolbar__btn--primary"
            onClick={() => fileInputRef.current?.click()}
          >
            Select PDFs
          </button>
        </div>
      ) : (
        <div className="merge-pdf">
          <div className="merge-pdf__header">
            <span className="merge-pdf__count">
              {files.length} {files.length === 1 ? 'file' : 'files'} selected
            </span>
            <div className="toolbar__actions">
              <button
                type="button"
                className="toolbar__btn"
                onClick={() => fileInputRef.current?.click()}
              >
                Add PDFs
              </button>
              <button
                type="button"
                className="toolbar__btn"
                onClick={() => setFiles([])}
              >
                Clear
              </button>
              <button
                type="button"
                className="toolbar__btn toolbar__btn--primary"
                disabled={files.length < 2 || isMerging}
                onClick={handleMerge}
              >
                {isMerging ? 'Merging...' : 'Merge & Download'}
              </button>
            </div>
          </div>

          <p className="modal__hint">
            Drag items or use the arrows to set the merge order.
            {files.length < 2 ? ' Add at least 2 PDFs to merge.' : ''}
          </p>

          <ul className="merge-pdf__list">
            {files.map((item, index) => (
              <li
                key={item.id}
                className={`merge-pdf__item ${dragIndex === index ? 'is-dragging' : ''}`}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) {
                    moveItem(dragIndex, index);
                  }
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
              >
                <span className="merge-pdf__index">{index + 1}.</span>
                <div className="merge-pdf__info">
                  <span className="merge-pdf__name">{item.name}</span>
                  <span className="merge-pdf__pages">
                    {item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'}
                  </span>
                </div>

                <div className="merge-pdf__item-actions">
                  <button
                    type="button"
                    className="toolbar__btn merge-pdf__icon-btn"
                    disabled={index === 0}
                    title="Move up"
                    aria-label="Move up"
                    onClick={() => moveItem(index, index - 1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="toolbar__btn merge-pdf__icon-btn"
                    disabled={index === files.length - 1}
                    title="Move down"
                    aria-label="Move down"
                    onClick={() => moveItem(index, index + 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="toolbar__btn merge-pdf__icon-btn"
                    title="Remove"
                    aria-label="Remove"
                    onClick={() => removeItem(item.id)}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}

