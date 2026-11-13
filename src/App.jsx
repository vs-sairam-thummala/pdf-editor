import { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import PdfPage from './components/PdfPage';
import ImageUploadModal from './components/ImageUploadModal';
import BackgroundRemoverPage from './components/BackgroundRemoverPage';
import ImageEditorPage from './components/ImageEditorPage';
import MergePdfPage from './components/MergePdfPage';
import { exportPdfWithImages } from './utils/pdfExport';
import './App.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const RENDER_SCALE = 1.5;
const A4_SIZE = [595.28, 841.89];

function loadImageDimensions(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

export default function App() {
  const [route, setRoute] = useState(() => window.location.pathname);
  const [pdfBytes, setPdfBytes] = useState(null);
  const [fileName, setFileName] = useState('document.pdf');
  const [pages, setPages] = useState([]);
  const [images, setImages] = useState([]);
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [pendingImage, setPendingImage] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');

  const pdfInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const imagesRef = useRef(images);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    const onPopState = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((img) => URL.revokeObjectURL(img.src));
    };
  }, []);

  const navigate = (path) => {
    if (path === route) return;
    window.history.pushState({}, '', path);
    setRoute(path);
  };

  const loadPdfFromBytes = async (bytes, name, { preserveImages = false } = {}) => {
    const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
    const pdfDoc = await loadingTask.promise;

    const loadedPages = [];
    for (let i = 1; i <= pdfDoc.numPages; i += 1) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      loadedPages.push({
        page,
        width: viewport.width,
        height: viewport.height,
      });
    }

    if (!preserveImages) {
      imagesRef.current.forEach((img) => URL.revokeObjectURL(img.src));
      setImages([]);
      setSelectedImageId(null);
      setActivePageIndex(0);
    }

    setPdfBytes(bytes);
    setFileName(name);
    setPages(loadedPages);
    return loadedPages;
  };

  const handleOpenPdf = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError('');
    try {
      const buffer = await file.arrayBuffer();
      await loadPdfFromBytes(new Uint8Array(buffer), file.name);
    } catch (err) {
      setError('Could not open this PDF file.');
      console.error(err);
    }
  };

  const handleCreateBlankPdf = async () => {
    setError('');
    try {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage(A4_SIZE);
      const bytes = new Uint8Array(await pdfDoc.save());
      await loadPdfFromBytes(bytes, 'blank.pdf');
    } catch (err) {
      setError('Could not create a blank PDF.');
      console.error(err);
    }
  };

  const handleAddPage = async () => {
    if (!pdfBytes) return;

    setError('');
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const lastPage = pdfDoc.getPages().at(-1);
      const size = lastPage
        ? [lastPage.getSize().width, lastPage.getSize().height]
        : A4_SIZE;
      pdfDoc.addPage(size);

      const bytes = new Uint8Array(await pdfDoc.save());
      const loadedPages = await loadPdfFromBytes(bytes, fileName, {
        preserveImages: true,
      });
      setActivePageIndex(loadedPages.length - 1);
    } catch (err) {
      setError('Could not add a new page.');
      console.error(err);
    }
  };

  const handleAddImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || pages.length === 0) return;

    setError('');
    const src = URL.createObjectURL(file);

    try {
      const [buffer, dimensions] = await Promise.all([
        file.arrayBuffer(),
        loadImageDimensions(src),
      ]);

      setPendingImage({
        src,
        bytes: new Uint8Array(buffer),
        mimeType: file.type,
        width: dimensions.width,
        height: dimensions.height,
      });
    } catch (err) {
      URL.revokeObjectURL(src);
      setError('Could not load this image. Please use a PNG or JPG file.');
      console.error(err);
    }
  };

  const handleConfirmPendingImage = (finalImage) => {
    if (pages.length === 0) return;

    const pageIndex = Math.min(activePageIndex, pages.length - 1);
    const targetPage = pages[pageIndex];
    const aspectRatio = finalImage.width / finalImage.height;

    let width = Math.min(200, targetPage.width * 0.4);
    let height = width / aspectRatio;
    if (height > targetPage.height * 0.4) {
      height = targetPage.height * 0.4;
      width = height * aspectRatio;
    }

    const newImage = {
      id: crypto.randomUUID(),
      pageIndex,
      src: finalImage.src,
      bytes: finalImage.bytes,
      mimeType: finalImage.mimeType,
      x: (targetPage.width - width) / 2,
      y: (targetPage.height - height) / 2,
      width,
      height,
      aspectRatio,
    };

    setImages((prev) => [...prev, newImage]);
    setSelectedImageId(newImage.id);
    setPendingImage(null);
  };

  const handleChangeImage = useCallback((id, updates) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, ...updates } : img))
    );
  }, []);

  const handleRemoveImage = useCallback((id) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.src);
      return prev.filter((img) => img.id !== id);
    });
    setSelectedImageId((prev) => (prev === id ? null : prev));
  }, []);

  const handleDownloadPdf = async () => {
    if (!pdfBytes || isExporting) return;

    setIsExporting(true);
    setError('');
    try {
      await exportPdfWithImages({
        pdfBytes,
        images,
        pages,
        fileName,
      });
    } catch (err) {
      setError('Failed to export the PDF.');
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const hasPdf = pages.length > 0;
  const isBgRemoverRoute = route === '/remove-background';
  const isImageEditorRoute = route === '/edit-image';
  const isMergePdfRoute = route === '/merge-pdf';
  const isPdfRoute = !isBgRemoverRoute && !isImageEditorRoute && !isMergePdfRoute;

  return (
    <div className="editor">
      <header className="toolbar">
        <nav className="toolbar__nav" aria-label="Primary">
          <a
            href="/"
            className={`toolbar__tab ${isPdfRoute ? 'is-active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
          >
            PDF Editor
          </a>
          <a
            href="/merge-pdf"
            className={`toolbar__tab ${isMergePdfRoute ? 'is-active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              navigate('/merge-pdf');
            }}
          >
            Merge PDFs
          </a>
          <a
            href="/remove-background"
            className={`toolbar__tab ${isBgRemoverRoute ? 'is-active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              navigate('/remove-background');
            }}
          >
            Remove Background
          </a>
          <a
            href="/edit-image"
            className={`toolbar__tab ${isImageEditorRoute ? 'is-active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              navigate('/edit-image');
            }}
          >
            Edit Image
          </a>
        </nav>

        {isPdfRoute && (
          <div className="toolbar__actions">
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleOpenPdf}
              hidden
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,.png,.jpg,.jpeg"
              onChange={handleAddImage}
              hidden
            />

            <button
              type="button"
              className="toolbar__btn toolbar__btn--primary"
              onClick={() => pdfInputRef.current?.click()}
            >
              Open PDF
            </button>

            <button
              type="button"
              className="toolbar__btn"
              onClick={handleCreateBlankPdf}
            >
              Blank PDF
            </button>

            <button
              type="button"
              className="toolbar__btn"
              disabled={!hasPdf}
              onClick={handleAddPage}
            >
              Add Page
            </button>

            <button
              type="button"
              className="toolbar__btn"
              disabled={!hasPdf}
              onClick={() => imageInputRef.current?.click()}
            >
              Add Image
            </button>

            <button
              type="button"
              className="toolbar__btn"
              disabled={!hasPdf || isExporting}
              onClick={handleDownloadPdf}
            >
              {isExporting ? 'Exporting...' : 'Download PDF'}
            </button>
          </div>
        )}
      </header>

      {isBgRemoverRoute ? (
        <BackgroundRemoverPage />
      ) : isImageEditorRoute ? (
        <ImageEditorPage />
      ) : isMergePdfRoute ? (
        <MergePdfPage />
      ) : (
        <>
          {error && <p className="editor__error">{error}</p>}

          <main
            className="workspace"
            onClick={() => setSelectedImageId(null)}
          >
            {!hasPdf ? (
              <div className="empty-state bg-remover__empty">
                <p>Open a PDF from your computer or start with a blank PDF.</p>
                <div className="toolbar__actions">
                  <button
                    type="button"
                    className="toolbar__btn toolbar__btn--primary"
                    onClick={() => pdfInputRef.current?.click()}
                  >
                    Open PDF
                  </button>
                  <button
                    type="button"
                    className="toolbar__btn"
                    onClick={handleCreateBlankPdf}
                  >
                    Blank PDF
                  </button>
                </div>
              </div>
            ) : (
              <div className="pages">
                {pages.map((pageData, index) => (
                  <PdfPage
                    key={index}
                    page={pageData.page}
                    pageIndex={index}
                    scale={RENDER_SCALE}
                    width={pageData.width}
                    height={pageData.height}
                    images={images.filter((img) => img.pageIndex === index)}
                    selectedImageId={selectedImageId}
                    onSelectPage={setActivePageIndex}
                    onSelectImage={setSelectedImageId}
                    onChangeImage={handleChangeImage}
                    onRemoveImage={handleRemoveImage}
                  />
                ))}
              </div>
            )}
          </main>

          {pendingImage && (
            <ImageUploadModal
              image={pendingImage}
              onConfirm={handleConfirmPendingImage}
              onCancel={() => setPendingImage(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
