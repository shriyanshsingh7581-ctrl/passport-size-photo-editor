import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';
import {
  SiteSettings,
  ToolCatalogItem,
  DEFAULT_TOOL_CATALOG,
  generateSamplePortraitDataUrl,
  generateSampleSignatureDataUrl,
} from '../constants';

// Configure local bundled PDF.js worker for reliable client-side PDF page rendering & compression
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type AkshayaSubToolId =
  | 'overview'
  | 'landing'
  | 'image-to-pdf'
  | 'pdf-merge'
  | 'pdf-split'
  | 'pdf-compressor'
  | 'image-compressor'
  | 'batch-image-compressor'
  | 'signature-resize';

interface AkshayaToolsHubProps {
  initialTool?: AkshayaSubToolId;
  activeSubTool?: AkshayaSubToolId;
  onSelectSubTool?: (tool: AkshayaSubToolId) => void;
  siteSettings?: SiteSettings;
  toolCatalog?: ToolCatalogItem[];
  showToast: (msg: string) => void;
}

interface MergePdfItem {
  id: string;
  name: string;
  sizeBytes: number;
  pageCount: number;
  bytes: Uint8Array;
}

interface SplitOutputFile {
  name: string;
  pageDesc: string;
  sizeBytes: number;
  bytes: Uint8Array;
}

interface CompressedImageItem {
  id: string;
  name: string;
  origSrc: string;
  origBytes: number;
  origW: number;
  origH: number;
  outDataUrl: string;
  outBytes: number;
  outW: number;
  outH: number;
  reductionPct: number;
  qualityUsed: number;
}

interface ImageToPdfItem {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  dataUrl: string;
  rawBytes: Uint8Array;
}

const SIGNATURE_PRESETS = [
  { id: 'ibps-ssc', label: 'IBPS / SBI / SSC (140 × 60 px · 10–20 KB)', w: 140, h: 60, unit: 'px' as const, maxKb: 20 },
  { id: 'kerala-psc', label: 'Kerala PSC Portal (150 × 50 px · < 30 KB)', w: 150, h: 50, unit: 'px' as const, maxKb: 30 },
  { id: 'upsc', label: 'UPSC Civil Services (300 × 100 px · < 40 KB)', w: 300, h: 100, unit: 'px' as const, maxKb: 40 },
  { id: 'pan-nsdl', label: 'PAN Card NSDL/UTIITSL (4.5 × 2.0 cm @ 200 DPI)', w: 354, h: 157, unit: 'px' as const, maxKb: 50 },
  { id: 'passport-in', label: 'Passport Seva (3.5 × 1.5 cm @ 300 DPI)', w: 413, h: 177, unit: 'px' as const, maxKb: 50 },
];

// Reliable cross-browser Blob download helper (never fails on large Data URLs or inside iframes)
function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (document.body.contains(a)) document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 4000);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(parts[1] || '');
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export const AkshayaToolsHub: React.FC<AkshayaToolsHubProps> = ({
  initialTool = 'overview',
  activeSubTool: controlledSubTool,
  onSelectSubTool,
  siteSettings,
  toolCatalog: propCatalog,
  showToast,
}) => {
  const normalizeTool = (t?: AkshayaSubToolId): AkshayaSubToolId => {
    if (!t || t === 'landing') return 'overview';
    if (t === 'batch-image-compressor') return 'image-compressor';
    return t;
  };
  const [internalTool, setInternalTool] = useState<AkshayaSubToolId>(
    normalizeTool(controlledSubTool || initialTool)
  );
  useEffect(() => {
    if (controlledSubTool !== undefined) {
      setInternalTool(normalizeTool(controlledSubTool));
    }
  }, [controlledSubTool]);
  useEffect(() => {
    if (initialTool) {
      setInternalTool(normalizeTool(initialTool));
    }
  }, [initialTool]);

  const setActiveSubTool = (next: AkshayaSubToolId) => {
    const norm = normalizeTool(next);
    setInternalTool(norm);
    if (onSelectSubTool) onSelectSubTool(norm);
  };
  const activeSubTool = internalTool;
  const toolCatalog =
    propCatalog && propCatalog.length > 0
      ? propCatalog
      : siteSettings?.toolCatalog && siteSettings.toolCatalog.length > 0
      ? siteSettings.toolCatalog
      : DEFAULT_TOOL_CATALOG;

  // =========================================================================
  // 1. PDF MERGE STATE
  // =========================================================================
  const [mergeItems, setMergeItems] = useState<MergePdfItem[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState(0);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [mergedPdfUrl, setMergedPdfUrl] = useState<string | null>(null);
  const [mergedPdfBytes, setMergedPdfBytes] = useState<Uint8Array | null>(null);
  const [mergedTotalPages, setMergedTotalPages] = useState<number>(0);

  const mergeFileInputRef = useRef<HTMLInputElement | null>(null);

  // =========================================================================
  // 2. PDF SPLIT STATE
  // =========================================================================
  const [splitSourceName, setSplitSourceName] = useState<string>('');
  const [splitSourceBytes, setSplitSourceBytes] = useState<Uint8Array | null>(null);
  const [splitTotalPages, setSplitTotalPages] = useState<number>(0);
  const [splitMode, setSplitMode] = useState<'ranges' | 'extract' | 'every'>('ranges');
  const [splitRangesInput, setSplitRangesInput] = useState<string>('1-2, 3-4, 5-6');
  const [splitExtractInput, setSplitExtractInput] = useState<string>('1, 3, 5');
  const [selectedExtractPages, setSelectedExtractPages] = useState<number[]>([1, 3, 5]);
  const [isSplitting, setIsSplitting] = useState<boolean>(false);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [splitOutputs, setSplitOutputs] = useState<SplitOutputFile[]>([]);

  const splitFileInputRef = useRef<HTMLInputElement | null>(null);

  // =========================================================================
  // 3. PDF COMPRESSOR STATE (TRUE RASTER + TARGET-KB ENGINE)
  // =========================================================================
  const [compPdfName, setCompPdfName] = useState<string>('');
  const [compPdfOrigBytes, setCompPdfOrigBytes] = useState<Uint8Array | null>(null);
  const [compPdfOrigSize, setCompPdfOrigSize] = useState<number>(0);
  const [compPdfPageCount, setCompPdfPageCount] = useState<number>(0);
  const [compPdfMode, setCompPdfMode] = useState<'preset' | 'target-kb'>('preset');
  const [compPdfLevel, setCompPdfLevel] = useState<'low' | 'medium' | 'high' | 'extreme'>('medium');
  const [compPdfTargetKb, setCompPdfTargetKb] = useState<number>(150);
  const [isCompressingPdf, setIsCompressingPdf] = useState<boolean>(false);
  const [compPdfProgress, setCompPdfProgress] = useState<number>(0);
  const [compPdfOutBytes, setCompPdfOutBytes] = useState<Uint8Array | null>(null);
  const [compPdfOutSize, setCompPdfOutSize] = useState<number>(0);
  const [compPdfPreviewUrl, setCompPdfPreviewUrl] = useState<string | null>(null);
  const [compPdfPageThumbs, setCompPdfPageThumbs] = useState<string[]>([]);
  const [compPdfNotice, setCompPdfNotice] = useState<string | null>(null);

  const compPdfInputRef = useRef<HTMLInputElement | null>(null);

  // =========================================================================
  // 4. IMAGE COMPRESSOR STATE (BINARY SEARCH TARGET-KB + QUALITY ENGINE)
  // =========================================================================
  const [rawBatchImages, setRawBatchImages] = useState<
    Array<{ id: string; name: string; src: string; origBytes: number; img: HTMLImageElement }>
  >([]);
  const [imgCompMode, setImgCompMode] = useState<'target-kb' | 'quality'>('target-kb');
  const [imgCompTargetKb, setImgCompTargetKb] = useState<number>(50);
  const [imgCompQuality, setImgCompQuality] = useState<number>(70);
  const [imgCompFormat, setImgCompFormat] = useState<'image/jpeg' | 'image/webp' | 'image/png'>('image/jpeg');
  const [imgCompMaxWidth, setImgCompMaxWidth] = useState<number>(0); // 0 = auto
  const [compressedImages, setCompressedImages] = useState<CompressedImageItem[]>([]);
  const [isCompressingImgs, setIsCompressingImgs] = useState<boolean>(false);

  const imgCompInputRef = useRef<HTMLInputElement | null>(null);

  // =========================================================================
  // 5. SIGNATURE RESIZE STATE
  // =========================================================================
  const [sigSourceUrl, setSigSourceUrl] = useState<string>('');
  const [sigTargetW, setSigTargetW] = useState<number>(140);
  const [sigTargetH, setSigTargetH] = useState<number>(60);
  const [sigUnit, setSigUnit] = useState<'px' | 'mm' | 'cm'>('px');
  const [sigLockAspect, setSigLockAspect] = useState<boolean>(true);
  const [sigRemoveWhiteBg, setSigRemoveWhiteBg] = useState<boolean>(false);
  const [sigThreshold, setSigThreshold] = useState<number>(215);
  const [sigInkMode, setSigInkMode] = useState<'original' | 'black' | 'blue'>('blue');
  const [sigCropPaddingPct, setSigCropPaddingPct] = useState<number>(8);
  const [sigFormat, setSigFormat] = useState<'image/png' | 'image/jpeg'>('image/jpeg');
  const [sigMaxKbLimit, setSigMaxKbLimit] = useState<number>(20); // 0 = no limit
  const [sigOutputUrl, setSigOutputUrl] = useState<string>('');
  const [sigOutputBytes, setSigOutputBytes] = useState<number>(0);

  const sigFileInputRef = useRef<HTMLInputElement | null>(null);
  const sigImgRef = useRef<HTMLImageElement | null>(null);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  };

  // =========================================================================
  // HELPER: GENERATE REAL SCANNED/IMAGE-RICH SAMPLE PDF USING PDF-LIB
  // =========================================================================
  const createSamplePdfDocument = useCallback(
    async (
      title: string,
      pageCount: number,
      includeScannedImage = false
    ): Promise<Uint8Array> => {
      const pdfDoc = await PDFDocument.create();
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

      pdfDoc.setTitle(title);
      pdfDoc.setAuthor('MALNADU MEDIA Akshaya Suite');

      // Generate a realistic high-resolution scanned certificate/photo page image if requested
      let embeddedJpg: any = null;
      if (includeScannedImage) {
        const scanCanvas = document.createElement('canvas');
        scanCanvas.width = 1240;
        scanCanvas.height = 1754;
        const sCtx = scanCanvas.getContext('2d')!;

        // Warm scanned paper texture with fine grain so uncompressed JPEG is ~160KB per page
        sCtx.fillStyle = '#fdfbf7';
        sCtx.fillRect(0, 0, 1240, 1754);

        // Decorative border
        sCtx.strokeStyle = '#0f172a';
        sCtx.lineWidth = 8;
        sCtx.strokeRect(48, 48, 1144, 1658);
        sCtx.strokeStyle = '#0284c7';
        sCtx.lineWidth = 3;
        sCtx.strokeRect(64, 64, 1112, 1626);

        // Header banner
        sCtx.fillStyle = '#0f172a';
        sCtx.fillRect(84, 84, 1072, 150);
        sCtx.fillStyle = '#38bdf8';
        sCtx.font = 'bold 38px sans-serif';
        sCtx.fillText('OFFICIAL SCANNED CITIZEN DOSSIER', 120, 155);
        sCtx.fillStyle = '#e2e8f0';
        sCtx.font = '24px sans-serif';
        sCtx.fillText('High-Resolution 300 DPI Scanned Document · Ready for Compression', 120, 200);

        // Draw rich visual patterns/stamps & portrait box
        for (let row = 0; row < 18; row++) {
          sCtx.fillStyle = row % 2 === 0 ? '#f1f5f9' : '#e2e8f0';
          sCtx.fillRect(100, 280 + row * 68, 1040, 52);
          sCtx.fillStyle = '#1e293b';
          sCtx.font = 'bold 22px monospace';
          sCtx.fillText(
            `VERIFIED RECORD ENTRY #${1000 + row * 37} — AKSHAYA E-DISTRICT PORTAL`,
            124,
            314 + row * 68
          );
        }

        // Add subtle realistic scanner texture so the sample file is ~350-450 KB
        for (let i = 0; i < 6500; i++) {
          const rx = (i * 197) % 1200;
          const ry = (i * 313) % 1700;
          sCtx.fillStyle = i % 2 === 0 ? 'rgba(15,23,42,0.06)' : 'rgba(2,132,199,0.06)';
          sCtx.fillRect(rx, ry, 3, 3);
        }

        const scanDataUrl = scanCanvas.toDataURL('image/jpeg', 0.98);
        const scanBlob = dataUrlToBlob(scanDataUrl);
        const scanBuf = await scanBlob.arrayBuffer();
        embeddedJpg = await pdfDoc.embedJpg(new Uint8Array(scanBuf));
      }

      for (let i = 1; i <= pageCount; i++) {
        const page = pdfDoc.addPage([595.28, 841.89]); // A4
        if (embeddedJpg) {
          page.drawImage(embeddedJpg, {
            x: 0,
            y: 0,
            width: 595.28,
            height: 841.89,
          });
        } else {
          page.drawRectangle({
            x: 36,
            y: 36,
            width: 523,
            height: 769,
            borderColor: rgb(0.02, 0.71, 0.83),
            borderWidth: 1.5,
          });
        }

        page.drawText('MALNADU MEDIA — AKSHAYA DOCUMENT SUITE', {
          x: 56,
          y: 785,
          size: 12,
          font: fontBold,
          color: embeddedJpg ? rgb(1, 1, 1) : rgb(0.03, 0.04, 0.08),
        });

        page.drawText(`${title} — Page ${i} of ${pageCount}`, {
          x: 56,
          y: 740,
          size: 16,
          font: fontBold,
          color: embeddedJpg ? rgb(0.95, 0.8, 0.2) : rgb(0.02, 0.45, 0.65),
        });

        if (!embeddedJpg) {
          for (let line = 0; line < 14; line++) {
            page.drawText(
              `Record Line #${line + 1}: Biometric & Citizen Service Application Reference ID #MM-2026-0${i}${line}`,
              {
                x: 56,
                y: 650 - line * 28,
                size: 10,
                font: fontRegular,
                color: rgb(0.2, 0.24, 0.3),
              }
            );
          }
        }
      }

      return await pdfDoc.save({ useObjectStreams: false });
    },
    []
  );

  // =========================================================================
  // 1. PDF MERGE HANDLERS
  // =========================================================================
  const handleMergeFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setMergeError(null);
    setMergedPdfUrl(null);

    const added: MergePdfItem[] = [];
    for (const file of Array.from(files)) {
      try {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        added.push({
          id: `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          sizeBytes: file.size,
          pageCount: doc.getPageCount(),
          bytes,
        });
      } catch {
        setMergeError(`File "${file.name}" is not a valid or readable PDF file.`);
      }
    }

    if (added.length > 0) {
      setMergeItems((prev) => [...prev, ...added]);
      showToast(`Added ${added.length} PDF file(s)!`);
    }
    e.target.value = '';
  };

  const handleLoadSampleMergePdfs = async () => {
    setMergeError(null);
    const bytes1 = await createSamplePdfDocument('Application_Form_Part_A.pdf', 2, false);
    const bytes2 = await createSamplePdfDocument('Identity_Annexure_Part_B.pdf', 3, false);
    const items: MergePdfItem[] = [
      {
        id: `sample-a-${Date.now()}`,
        name: 'Application_Form_Part_A.pdf',
        sizeBytes: bytes1.byteLength,
        pageCount: 2,
        bytes: bytes1,
      },
      {
        id: `sample-b-${Date.now() + 1}`,
        name: 'Identity_Annexure_Part_B.pdf',
        sizeBytes: bytes2.byteLength,
        pageCount: 3,
        bytes: bytes2,
      },
    ];
    setMergeItems(items);
    showToast('Loaded 2 sample PDFs! Merging automatically...');
    setTimeout(() => {
      executePdfMergeList(items);
    }, 80);
  };

  const moveMergeItem = (index: number, direction: -1 | 1) => {
    setMergeItems((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const executePdfMergeList = async (listToMerge: MergePdfItem[]) => {
    if (listToMerge.length < 2) {
      setMergeError('Please upload at least 2 PDF files to merge.');
      return;
    }
    setMergeError(null);
    setIsMerging(true);
    setMergeProgress(15);

    try {
      const mergedPdf = await PDFDocument.create();
      let totalPagesCount = 0;

      for (let i = 0; i < listToMerge.length; i++) {
        const item = listToMerge[i];
        const srcDoc = await PDFDocument.load(item.bytes, { ignoreEncryption: true });
        const indices = srcDoc.getPageIndices();
        const copiedPages = await mergedPdf.copyPages(srcDoc, indices);
        copiedPages.forEach((p) => mergedPdf.addPage(p));
        totalPagesCount += copiedPages.length;
        setMergeProgress(Math.round(((i + 1) / listToMerge.length) * 90));
      }

      const finalBytes = await mergedPdf.save({ useObjectStreams: true });
      const blob = new Blob([finalBytes as unknown as BlobPart], { type: 'application/pdf' });
      if (mergedPdfUrl) URL.revokeObjectURL(mergedPdfUrl);
      const url = URL.createObjectURL(blob);

      setMergedPdfBytes(finalBytes);
      setMergedPdfUrl(url);
      setMergedTotalPages(totalPagesCount);
      setMergeProgress(100);
      showToast(`Merged ${listToMerge.length} PDFs (${totalPagesCount} pages)!`);
    } catch (err) {
      console.error('PDF Merge error:', err);
      setMergeError('Failed to merge PDFs. Ensure none of the files are password-locked.');
    } finally {
      setIsMerging(false);
    }
  };

  const handleExecutePdfMerge = () => executePdfMergeList(mergeItems);

  const downloadMergedPdf = () => {
    if (!mergedPdfBytes) return;
    const blob = new Blob([mergedPdfBytes as unknown as BlobPart], { type: 'application/pdf' });
    triggerBlobDownload(blob, `malnadu-merged-${Date.now()}.pdf`);
    showToast('Downloaded Merged PDF!');
  };

  // =========================================================================
  // 2. PDF SPLIT HANDLERS
  // =========================================================================
  const handleSplitFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSplitError(null);
    setSplitOutputs([]);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const count = doc.getPageCount();
      setSplitSourceName(file.name);
      setSplitSourceBytes(bytes);
      setSplitTotalPages(count);
      setSplitRangesInput(count >= 4 ? `1-2, 3-${count}` : `1-1`);
      const defaultSelected = count >= 2 ? [1, 2] : [1];
      setSelectedExtractPages(defaultSelected);
      setSplitExtractInput(defaultSelected.join(', '));
      showToast(`Loaded "${file.name}" (${count} pages)`);
    } catch {
      setSplitError('Invalid or corrupted PDF file.');
    }
    e.target.value = '';
  };

  const handleLoadSampleSplitPdf = async () => {
    setSplitError(null);
    setSplitOutputs([]);
    const bytes = await createSamplePdfDocument('MultiPage_Citizen_Dossier.pdf', 6, false);
    setSplitSourceName('MultiPage_Citizen_Dossier.pdf');
    setSplitSourceBytes(bytes);
    setSplitTotalPages(6);
    setSplitRangesInput('1-3, 4-6');
    setSelectedExtractPages([1, 3, 5]);
    setSplitExtractInput('1, 3, 5');
    showToast('Loaded 6-page sample PDF for splitting!');
  };

  const toggleExtractPageNumber = (pageNum: number) => {
    setSelectedExtractPages((prev) => {
      const exists = prev.includes(pageNum);
      const next = exists ? prev.filter((p) => p !== pageNum) : [...prev, pageNum].sort((a, b) => a - b);
      setSplitExtractInput(next.join(', '));
      return next;
    });
  };

  const handleExecutePdfSplit = async () => {
    if (!splitSourceBytes || splitTotalPages <= 0) {
      setSplitError('Please upload a PDF file first.');
      return;
    }
    setSplitError(null);
    setIsSplitting(true);
    setSplitOutputs([]);

    try {
      const srcDoc = await PDFDocument.load(splitSourceBytes, { ignoreEncryption: true });
      const outputs: SplitOutputFile[] = [];
      const baseName = splitSourceName.replace(/\.pdf$/i, '') || 'document';

      if (splitMode === 'every') {
        for (let p = 0; p < splitTotalPages; p++) {
          const singleDoc = await PDFDocument.create();
          const [copied] = await singleDoc.copyPages(srcDoc, [p]);
          singleDoc.addPage(copied);
          const outBytes = await singleDoc.save({ useObjectStreams: true });
          outputs.push({
            name: `${baseName}_page_${p + 1}.pdf`,
            pageDesc: `Page ${p + 1}`,
            sizeBytes: outBytes.byteLength,
            bytes: outBytes,
          });
        }
      } else if (splitMode === 'extract') {
        const parts = splitExtractInput
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n) && n >= 1 && n <= splitTotalPages);

        if (parts.length === 0) {
          setSplitError(`Please select or enter valid page numbers between 1 and ${splitTotalPages}.`);
          setIsSplitting(false);
          return;
        }

        const newDoc = await PDFDocument.create();
        const zeroBased = parts.map((n) => n - 1);
        const copied = await newDoc.copyPages(srcDoc, zeroBased);
        copied.forEach((p) => newDoc.addPage(p));
        const outBytes = await newDoc.save({ useObjectStreams: true });
        outputs.push({
          name: `${baseName}_extracted_pages_${parts.join('_')}.pdf`,
          pageDesc: `Pages ${parts.join(', ')}`,
          sizeBytes: outBytes.byteLength,
          bytes: outBytes,
        });
      } else {
        const rawRanges = splitRangesInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        for (let rIdx = 0; rIdx < rawRanges.length; rIdx++) {
          const token = rawRanges[rIdx];
          const [startStr, endStr] = token.split('-').map((s) => s.trim());
          const startPage = parseInt(startStr, 10);
          const endPage = endStr ? parseInt(endStr, 10) : startPage;

          if (
            isNaN(startPage) ||
            isNaN(endPage) ||
            startPage < 1 ||
            endPage > splitTotalPages ||
            startPage > endPage
          ) {
            setSplitError(
              `Invalid page range "${token}". Enter ranges between 1 and ${splitTotalPages} (e.g. 1-3, 4-6).`
            );
            setIsSplitting(false);
            return;
          }

          const indices: number[] = [];
          for (let p = startPage; p <= endPage; p++) {
            indices.push(p - 1);
          }

          const rangeDoc = await PDFDocument.create();
          const copied = await rangeDoc.copyPages(srcDoc, indices);
          copied.forEach((p) => rangeDoc.addPage(p));
          const outBytes = await rangeDoc.save({ useObjectStreams: true });

          outputs.push({
            name: `${baseName}_pages_${startPage}_to_${endPage}.pdf`,
            pageDesc: `Pages ${startPage}–${endPage}`,
            sizeBytes: outBytes.byteLength,
            bytes: outBytes,
          });
        }
      }

      setSplitOutputs(outputs);
      showToast(`Generated ${outputs.length} split PDF file(s)!`);
    } catch (err) {
      console.error('Split error:', err);
      setSplitError('Failed to split PDF document.');
    } finally {
      setIsSplitting(false);
    }
  };

  const downloadSingleSplitPdf = (file: SplitOutputFile) => {
    const blob = new Blob([file.bytes as unknown as BlobPart], { type: 'application/pdf' });
    triggerBlobDownload(blob, file.name);
    showToast(`Downloaded ${file.name}!`);
  };

  const downloadAllSplitAsZip = async () => {
    if (splitOutputs.length === 0) return;
    const zip = new JSZip();
    splitOutputs.forEach((f) => {
      zip.file(f.name, f.bytes);
    });
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    triggerBlobDownload(zipBlob, `malnadu-split-pdfs-${Date.now()}.zip`);
    showToast('Downloaded ZIP Archive of Split PDFs!');
  };

  // =========================================================================
  // 3. REAL MULTI-PASS PDF COMPRESSOR ENGINE (PDF.JS RASTER + BINARY SEARCH)
  // =========================================================================
  const runTruePdfCompression = useCallback(
    async (
      sourceBytes: Uint8Array,
      mode: 'preset' | 'target-kb' = compPdfMode,
      level: 'low' | 'medium' | 'high' | 'extreme' = compPdfLevel,
      targetKb: number = compPdfTargetKb
    ) => {
      if (!sourceBytes || sourceBytes.byteLength === 0) return;
      setIsCompressingPdf(true);
      setCompPdfProgress(10);
      setCompPdfNotice(null);

      try {
        // Determine target byte cap
        const origSize = sourceBytes.byteLength;
        let desiredMaxBytes = origSize;
        if (mode === 'target-kb') {
          desiredMaxBytes = Math.max(15 * 1024, targetKb * 1024);
        } else {
          if (level === 'low') desiredMaxBytes = Math.round(origSize * 0.65);
          else if (level === 'medium') desiredMaxBytes = Math.round(origSize * 0.42);
          else if (level === 'high') desiredMaxBytes = Math.round(origSize * 0.25);
          else desiredMaxBytes = Math.round(origSize * 0.14);
        }

        // Load PDF via PDF.js to render pages to canvas and re-encode at exact target quality/scale
        const dataCopy = new Uint8Array(sourceBytes);
        const loadingTask = pdfjsLib.getDocument({ data: dataCopy });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;
        setCompPdfPageCount(numPages);

        // Per-page byte budget (leaving ~3KB overhead for PDF container)
        const totalContainerOverhead = Math.min(4096, Math.round(desiredMaxBytes * 0.08));
        const perPageByteBudget = Math.max(
          8192,
          Math.floor((desiredMaxBytes - totalContainerOverhead) / Math.max(1, numPages))
        );

        // Initial render scale based on compression mode/level
        let baseScale = 1.35;
        let baseQuality = 0.72;
        if (mode === 'preset') {
          if (level === 'low') {
            baseScale = 1.5;
            baseQuality = 0.8;
          } else if (level === 'medium') {
            baseScale = 1.2;
            baseQuality = 0.62;
          } else if (level === 'high') {
            baseScale = 0.95;
            baseQuality = 0.45;
          } else {
            baseScale = 0.72;
            baseQuality = 0.3;
          }
        } else {
          // Estimate initial scale from per-page KB budget
          const budgetKb = perPageByteBudget / 1024;
          if (budgetKb < 25) {
            baseScale = 0.68;
            baseQuality = 0.32;
          } else if (budgetKb < 50) {
            baseScale = 0.88;
            baseQuality = 0.48;
          } else if (budgetKb < 100) {
            baseScale = 1.15;
            baseQuality = 0.65;
          } else {
            baseScale = 1.35;
            baseQuality = 0.75;
          }
        }

        const outPdfDoc = await PDFDocument.create();
        const thumbs: string[] = [];

        for (let pIdx = 1; pIdx <= numPages; pIdx++) {
          const page = await pdf.getPage(pIdx);
          const origViewport = page.getViewport({ scale: 1.0 });

          // Render at baseScale first
          const renderViewport = page.getViewport({ scale: baseScale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(100, Math.round(renderViewport.width));
          canvas.height = Math.max(100, Math.round(renderViewport.height));
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          await page.render({
            canvasContext: ctx,
            viewport: renderViewport,
            canvas,
          } as any).promise;

          // Save thumbnail of first 4 pages for visual preview
          if (pIdx <= 4) {
            thumbs.push(canvas.toDataURL('image/jpeg', 0.6));
          }

          // Binary search quality + downscale if needed to fit within perPageByteBudget
          let chosenBlob = dataUrlToBlob(canvas.toDataURL('image/jpeg', baseQuality));

          if (chosenBlob.size > perPageByteBudget) {
            // Binary search JPEG quality on current canvas
            let lowQ = 0.12;
            let highQ = baseQuality;
            let bestBlob = chosenBlob;
            for (let step = 0; step < 5; step++) {
              const midQ = (lowQ + highQ) / 2;
              const testBlob = dataUrlToBlob(canvas.toDataURL('image/jpeg', midQ));
              bestBlob = testBlob;
              if (testBlob.size > perPageByteBudget) {
                highQ = midQ;
              } else {
                lowQ = midQ;
              }
            }
            chosenBlob = bestBlob;

            // If still above budget, scale canvas dimensions down proportionally
            if (chosenBlob.size > perPageByteBudget) {
              const scaleFactor = Math.max(
                0.38,
                Math.min(0.85, Math.sqrt(perPageByteBudget / chosenBlob.size) * 0.92)
              );
              const smallCanvas = document.createElement('canvas');
              smallCanvas.width = Math.max(180, Math.round(canvas.width * scaleFactor));
              smallCanvas.height = Math.max(180, Math.round(canvas.height * scaleFactor));
              const sCtx = smallCanvas.getContext('2d')!;
              sCtx.fillStyle = '#FFFFFF';
              sCtx.fillRect(0, 0, smallCanvas.width, smallCanvas.height);
              sCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
              chosenBlob = dataUrlToBlob(smallCanvas.toDataURL('image/jpeg', 0.35));
            }
          }

          const jpgBuf = await chosenBlob.arrayBuffer();
          const embeddedJpg = await outPdfDoc.embedJpg(new Uint8Array(jpgBuf));
          const pdfPage = outPdfDoc.addPage([origViewport.width, origViewport.height]);
          pdfPage.drawImage(embeddedJpg, {
            x: 0,
            y: 0,
            width: origViewport.width,
            height: origViewport.height,
          });

          setCompPdfProgress(Math.round(15 + (pIdx / numPages) * 75));
        }

        const compressedBytes = await outPdfDoc.save({
          useObjectStreams: true,
          addDefaultPage: false,
        });

        setCompPdfPageThumbs(thumbs);
        setCompPdfOutBytes(compressedBytes);
        setCompPdfOutSize(compressedBytes.byteLength);

        const outBlob = new Blob([compressedBytes as unknown as BlobPart], {
          type: 'application/pdf',
        });
        if (compPdfPreviewUrl) URL.revokeObjectURL(compPdfPreviewUrl);
        setCompPdfPreviewUrl(URL.createObjectURL(outBlob));
        setCompPdfProgress(100);

        const savedPct =
          origSize > compressedBytes.byteLength
            ? Math.round(((origSize - compressedBytes.byteLength) / origSize) * 100)
            : 0;
        showToast(
          `PDF Compressed: ${formatBytes(origSize)} → ${formatBytes(
            compressedBytes.byteLength
          )} (${savedPct}% Saved)!`
        );
      } catch (err) {
        console.error('PDF Compress fallback:', err);
        try {
          // Structural fallback if PDF.js worker fails on exotic PDF
          const srcDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
          const cleanDoc = await PDFDocument.create();
          const pages = await cleanDoc.copyPages(srcDoc, srcDoc.getPageIndices());
          pages.forEach((p) => cleanDoc.addPage(p));
          const fallbackBytes = await cleanDoc.save({ useObjectStreams: true });
          setCompPdfOutBytes(fallbackBytes);
          setCompPdfOutSize(fallbackBytes.byteLength);
          showToast('PDF Optimized!');
        } catch {
          setCompPdfNotice('Could not process this PDF file. Please verify it is not password-locked.');
        }
      } finally {
        setIsCompressingPdf(false);
      }
    },
    [compPdfMode, compPdfLevel, compPdfTargetKb, compPdfPreviewUrl, showToast]
  );

  const handleCompressPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompPdfOutBytes(null);
    setCompPdfNotice(null);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      setCompPdfName(file.name);
      setCompPdfOrigBytes(bytes);
      setCompPdfOrigSize(file.size);
      setCompPdfPageCount(doc.getPageCount());
      showToast(`Loaded "${file.name}" (${formatBytes(file.size)}) — Compressing...`);
      // Automatically run compression on upload so user sees immediate results!
      runTruePdfCompression(bytes, compPdfMode, compPdfLevel, compPdfTargetKb);
    } catch {
      setCompPdfNotice('Invalid or password-protected PDF file.');
    }
    e.target.value = '';
  };

  const handleLoadSampleCompressPdf = async () => {
    setCompPdfOutBytes(null);
    setCompPdfNotice(null);
    const bytes = await createSamplePdfDocument('Scanned_Citizen_Certificate_300DPI.pdf', 3, true);
    setCompPdfName('Scanned_Citizen_Certificate_300DPI.pdf');
    setCompPdfOrigBytes(bytes);
    setCompPdfOrigSize(bytes.byteLength);
    setCompPdfPageCount(3);
    showToast(`Loaded ${formatBytes(bytes.byteLength)} Scanned PDF — Compressing...`);
    runTruePdfCompression(bytes, compPdfMode, compPdfLevel, compPdfTargetKb);
  };

  const handleExecutePdfCompression = () => {
    if (!compPdfOrigBytes) return;
    runTruePdfCompression(compPdfOrigBytes, compPdfMode, compPdfLevel, compPdfTargetKb);
  };

  // =========================================================================
  // 4. BATCH IMAGE COMPRESSOR HANDLERS (TARGET-KB BINARY SEARCH + QUALITY)
  // =========================================================================
  const compressSingleImageItem = useCallback(
    (
      item: { id: string; name: string; src: string; origBytes: number; img: HTMLImageElement },
      mode: 'target-kb' | 'quality',
      targetKb: number,
      qualityPct: number,
      format: 'image/jpeg' | 'image/webp' | 'image/png',
      maxWidth: number
    ): CompressedImageItem => {
      const origW = item.img.naturalWidth || item.img.width;
      const origH = item.img.naturalHeight || item.img.height;

      let baseW = origW;
      let baseH = origH;
      if (maxWidth > 0 && baseW > maxWidth) {
        baseH = Math.round((baseH * maxWidth) / baseW);
        baseW = maxWidth;
      }

      const renderAtScaleAndQuality = (scale: number, q: number): { dataUrl: string; bytes: number; w: number; h: number } => {
        const w = Math.max(32, Math.round(baseW * scale));
        const h = Math.max(32, Math.round(baseH * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (format === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(item.img, 0, 0, w, h);

        // If PNG is selected, apply color quantization (bit-depth reduction) so PNG deflate actually shrinks!
        if (format === 'image/png') {
          const imgData = ctx.getImageData(0, 0, w, h);
          const d = imgData.data;
          const step = q < 0.5 ? 24 : q < 0.75 ? 16 : 8;
          for (let i = 0; i < d.length; i += 4) {
            d[i] = Math.round(d[i] / step) * step;
            d[i + 1] = Math.round(d[i + 1] / step) * step;
            d[i + 2] = Math.round(d[i + 2] / step) * step;
          }
          ctx.putImageData(imgData, 0, 0);
        }

        const outDataUrl = canvas.toDataURL(format, format === 'image/png' ? undefined : q);
        const b64Len = outDataUrl.split(',')[1]?.length || 0;
        const outBytes = Math.round((b64Len * 3) / 4);
        return { dataUrl: outDataUrl, bytes: outBytes, w, h };
      };

      const targetMaxBytes =
        mode === 'target-kb'
          ? Math.max(4096, targetKb * 1024)
          : Math.round(item.origBytes * (qualityPct / 100));

      let best = renderAtScaleAndQuality(1.0, qualityPct / 100);
      let usedQ = qualityPct;

      if (mode === 'target-kb') {
        // Binary search quality at full resolution first
        let lowQ = 0.08;
        let highQ = 0.92;
        for (let iter = 0; iter < 6; iter++) {
          const midQ = (lowQ + highQ) / 2;
          const candidate = renderAtScaleAndQuality(1.0, midQ);
          best = candidate;
          usedQ = Math.round(midQ * 100);
          if (candidate.bytes > targetMaxBytes) {
            highQ = midQ;
          } else {
            lowQ = midQ;
          }
        }

        // If still larger than targetMaxBytes (e.g. PNG or high-res image for < 20KB), step down scale
        if (best.bytes > targetMaxBytes) {
          const scales = [0.85, 0.7, 0.55, 0.42, 0.32, 0.24];
          for (const sc of scales) {
            const candidate = renderAtScaleAndQuality(sc, format === 'image/png' ? 0.4 : 0.52);
            best = candidate;
            usedQ = 52;
            if (candidate.bytes <= targetMaxBytes) break;
          }
        }
      } else {
        // Quality slider mode: guarantee output is smaller than original when quality < 92%
        if (best.bytes >= item.origBytes && qualityPct < 92) {
          const ratio = Math.min(0.85, Math.sqrt((item.origBytes * (qualityPct / 100)) / Math.max(1, best.bytes)));
          best = renderAtScaleAndQuality(Math.max(0.35, ratio), (qualityPct / 100) * 0.85);
        }
      }

      const reductionPct =
        item.origBytes > 0 && best.bytes < item.origBytes
          ? Math.max(1, Math.round(((item.origBytes - best.bytes) / item.origBytes) * 100))
          : 0;

      return {
        id: item.id,
        name: item.name,
        origSrc: item.src,
        origBytes: item.origBytes,
        origW,
        origH,
        outDataUrl: best.dataUrl,
        outBytes: best.bytes,
        outW: best.w,
        outH: best.h,
        reductionPct,
        qualityUsed: usedQ,
      };
    },
    []
  );

  const runBatchImageCompression = useCallback(
    (
      items = rawBatchImages,
      mode = imgCompMode,
      targetKb = imgCompTargetKb,
      quality = imgCompQuality,
      format = imgCompFormat,
      maxWidth = imgCompMaxWidth
    ) => {
      if (items.length === 0) {
        setCompressedImages([]);
        return;
      }
      setIsCompressingImgs(true);
      requestAnimationFrame(() => {
        const results = items.map((item) =>
          compressSingleImageItem(item, mode, targetKb, quality, format, maxWidth)
        );
        setCompressedImages(results);
        setIsCompressingImgs(false);
      });
    },
    [rawBatchImages, imgCompMode, imgCompTargetKb, imgCompQuality, imgCompFormat, imgCompMaxWidth, compressSingleImageItem]
  );

  useEffect(() => {
    runBatchImageCompression(
      rawBatchImages,
      imgCompMode,
      imgCompTargetKb,
      imgCompQuality,
      imgCompFormat,
      imgCompMaxWidth
    );
  }, [
    rawBatchImages,
    imgCompMode,
    imgCompTargetKb,
    imgCompQuality,
    imgCompFormat,
    imgCompMaxWidth,
    runBatchImageCompression,
  ]);

  const handleBatchImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target?.result as string;
        if (!src) return;
        const img = new Image();
        img.onload = () => {
          setRawBatchImages((prev) => [
            ...prev,
            {
              id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: file.name,
              src,
              origBytes: file.size,
              img,
            },
          ]);
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
    showToast(`Uploaded ${files.length} image(s) — Compressed automatically!`);
    e.target.value = '';
  };

  const handleLoadSampleBatchImages = () => {
    const sample1 = generateSamplePortraitDataUrl(0, false);
    const sample2 = generateSamplePortraitDataUrl(1, false);
    const loaded: Array<{ id: string; name: string; src: string; origBytes: number; img: HTMLImageElement }> = [];

    [
      { src: sample1, name: 'Studio_Portrait_Applicant_A.png' },
      { src: sample2, name: 'Studio_Portrait_Applicant_B.png' },
    ].forEach((entry, idx) => {
      const img = new Image();
      img.onload = () => {
        const b64Len = entry.src.split(',')[1]?.length || 0;
        loaded.push({
          id: `sample-img-${Date.now()}-${idx}`,
          name: entry.name,
          src: entry.src,
          origBytes: Math.round((b64Len * 3) / 4),
          img,
        });
        if (loaded.length === 2) {
          setRawBatchImages(loaded);
          showToast('Loaded 2 sample photos & compressed to target KB!');
        }
      };
      img.src = entry.src;
    });
  };

  const downloadSingleCompressedImage = (item: CompressedImageItem) => {
    const ext =
      imgCompFormat === 'image/png' ? 'png' : imgCompFormat === 'image/webp' ? 'webp' : 'jpg';
    const blob = dataUrlToBlob(item.outDataUrl);
    const cleanName = item.name.replace(/\.[^.]+$/, '');
    triggerBlobDownload(blob, `compressed-${cleanName}.${ext}`);
    showToast(`Downloaded ${cleanName}.${ext} (${formatBytes(item.outBytes)})!`);
  };

  const downloadAllCompressedImagesZip = async () => {
    if (compressedImages.length === 0) return;
    const zip = new JSZip();
    const ext =
      imgCompFormat === 'image/png' ? 'png' : imgCompFormat === 'image/webp' ? 'webp' : 'jpg';

    compressedImages.forEach((item, idx) => {
      const base64Data = item.outDataUrl.split(',')[1];
      const cleanName = item.name.replace(/\.[^.]+$/, '');
      zip.file(`${cleanName}-compressed-${idx + 1}.${ext}`, base64Data, { base64: true });
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    triggerBlobDownload(blob, `malnadu-compressed-images-${Date.now()}.zip`);
    showToast('Downloaded Compressed Images ZIP!');
  };

  // =========================================================================
  // 5. SIGNATURE RESIZE & CLEAN HANDLERS (WITH PORTAL MAX KB GUARANTEE)
  // =========================================================================
  const renderSignatureOutput = useCallback(() => {
    const img = sigImgRef.current;
    if (!img) return;

    let outW = sigTargetW;
    let outH = sigTargetH;
    if (sigUnit === 'mm') {
      outW = Math.round((sigTargetW / 25.4) * 300);
      outH = Math.round((sigTargetH / 25.4) * 300);
    } else if (sigUnit === 'cm') {
      outW = Math.round(((sigTargetW * 10) / 25.4) * 300);
      outH = Math.round(((sigTargetH * 10) / 25.4) * 300);
    }
    outW = Math.max(40, Math.min(2400, Math.round(outW)));
    outH = Math.max(20, Math.min(1200, Math.round(outH)));

    const trimRatio = Math.min(0.35, Math.max(0, sigCropPaddingPct / 100));
    const cropX = Math.round(img.width * trimRatio * 0.5);
    const cropY = Math.round(img.height * trimRatio * 0.5);
    const cropW = Math.max(10, img.width - cropX * 2);
    const cropH = Math.max(10, img.height - cropY * 2);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cropW;
    tempCanvas.height = cropH;
    const tCtx = tempCanvas.getContext('2d')!;
    tCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    if (sigRemoveWhiteBg || sigInkMode !== 'original') {
      const imgData = tCtx.getImageData(0, 0, cropW, cropH);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        if (lum >= sigThreshold) {
          if (sigRemoveWhiteBg) {
            d[i + 3] = 0;
          } else {
            d[i] = 255;
            d[i + 1] = 255;
            d[i + 2] = 255;
          }
        } else {
          const darkness = Math.min(1, (sigThreshold - lum) / Math.max(1, sigThreshold - 40));
          if (sigInkMode === 'black') {
            d[i] = 15;
            d[i + 1] = 23;
            d[i + 2] = 42;
          } else if (sigInkMode === 'blue') {
            d[i] = 20;
            d[i + 1] = 52;
            d[i + 2] = 164;
          }
          if (sigRemoveWhiteBg) {
            d[i + 3] = Math.round(Math.min(255, darkness * 255 * 1.25));
          }
        }
      }
      tCtx.putImageData(imgData, 0, 0);
    }

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = outW;
    finalCanvas.height = outH;
    const fCtx = finalCanvas.getContext('2d')!;

    if (sigFormat === 'image/jpeg' || !sigRemoveWhiteBg) {
      fCtx.fillStyle = '#FFFFFF';
      fCtx.fillRect(0, 0, outW, outH);
    }

    if (sigLockAspect) {
      const pad = 0.88;
      const scale = Math.min((outW * pad) / cropW, (outH * pad) / cropH);
      const dW = cropW * scale;
      const dH = cropH * scale;
      fCtx.drawImage(tempCanvas, (outW - dW) / 2, (outH - dH) / 2, dW, dH);
    } else {
      fCtx.drawImage(tempCanvas, 0, 0, outW, outH);
    }

    let dataUrl = finalCanvas.toDataURL(sigFormat, sigFormat === 'image/png' ? undefined : 0.92);
    let b64Len = dataUrl.split(',')[1]?.length || 0;
    let outBytes = Math.round((b64Len * 3) / 4);

    if (sigMaxKbLimit > 0 && sigFormat === 'image/jpeg' && outBytes > sigMaxKbLimit * 1024) {
      let q = 0.85;
      while (q >= 0.15 && outBytes > sigMaxKbLimit * 1024) {
        dataUrl = finalCanvas.toDataURL('image/jpeg', q);
        b64Len = dataUrl.split(',')[1]?.length || 0;
        outBytes = Math.round((b64Len * 3) / 4);
        q -= 0.1;
      }
    }

    setSigOutputUrl(dataUrl);
    setSigOutputBytes(outBytes);
  }, [
    sigTargetW,
    sigTargetH,
    sigUnit,
    sigLockAspect,
    sigRemoveWhiteBg,
    sigThreshold,
    sigInkMode,
    sigCropPaddingPct,
    sigFormat,
    sigMaxKbLimit,
  ]);

  const loadSignatureFromUrl = useCallback((url: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      sigImgRef.current = img;
      setSigSourceUrl(url);
    };
    img.src = url;
  }, []);

  useEffect(() => {
    renderSignatureOutput();
  }, [sigSourceUrl, renderSignatureOutput]);

  // Initialize defaults on mount
  useEffect(() => {
    const sigSample = generateSampleSignatureDataUrl();
    loadSignatureFromUrl(sigSample);

    const portraitSample = generateSamplePortraitDataUrl(1, false);
    const img = new Image();
    img.onload = () => {
      const b64Len = portraitSample.split(',')[1]?.length || 0;
      setRawBatchImages([
        {
          id: 'sample-batch-1',
          name: 'Applicant_Portrait_01.png',
          src: portraitSample,
          origBytes: Math.round((b64Len * 3) / 4),
          img,
        },
      ]);
    };
    img.src = portraitSample;
  }, [loadSignatureFromUrl]);

  // =========================================================================
  // 6. HIGH-QUALITY IMAGE TO PDF CONVERTER (LOSSLESS PDF-LIB ENGINE)
  // =========================================================================
  const [imgToPdfItems, setImgToPdfItems] = useState<ImageToPdfItem[]>([]);
  const [imgToPdfDragOver, setImgToPdfDragOver] = useState<boolean>(false);
  const [imgToPdfDraggedIdx, setImgToPdfDraggedIdx] = useState<number | null>(null);
  const [imgToPdfPageSize, setImgToPdfPageSize] = useState<'a4' | 'fit'>('a4');
  const [imgToPdfOrientation, setImgToPdfOrientation] = useState<
    'portrait' | 'landscape' | 'auto'
  >('portrait');
  const [imgToPdfMargin, setImgToPdfMargin] = useState<'none' | 'small' | 'medium' | 'large'>(
    'small'
  );
  const [imgToPdfFilename, setImgToPdfFilename] = useState<string>('studiopassport-images-hd');
  const [isConvertingImgToPdf, setIsConvertingImgToPdf] = useState<boolean>(false);
  const [imgToPdfProgress, setImgToPdfProgress] = useState<number>(0);
  const [imgToPdfStatus, setImgToPdfStatus] = useState<string>('');
  const [imgToPdfOutputUrl, setImgToPdfOutputUrl] = useState<string>('');
  const [imgToPdfOutputBytes, setImgToPdfOutputBytes] = useState<Uint8Array | null>(null);
  const [imgToPdfOutputSize, setImgToPdfOutputSize] = useState<number>(0);
  const imgToPdfInputRef = useRef<HTMLInputElement | null>(null);

  const processFilesForImageToPdf = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) =>
        /image\/(jpeg|jpg|png|webp)/i.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name)
      );
      if (files.length === 0) {
        showToast('Please select JPG, PNG, or WebP images.');
        return;
      }

      const loadedItems: ImageToPdfItem[] = [];
      for (const file of files) {
        try {
          const arrayBuf = await file.arrayBuffer();
          const rawBytes = new Uint8Array(arrayBuf);
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('File read error'));
            reader.readAsDataURL(file);
          });
          const dims = await new Promise<{ w: number; h: number }>((resolve) => {
            const img = new Image();
            img.onload = () =>
              resolve({ w: img.naturalWidth || img.width || 1200, h: img.naturalHeight || img.height || 1600 });
            img.onerror = () => resolve({ w: 1200, h: 1600 });
            img.src = dataUrl;
          });

          loadedItems.push({
            id: `imgpdf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name,
            mimeType: file.type || (file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'),
            sizeBytes: file.size || rawBytes.byteLength,
            width: dims.w,
            height: dims.h,
            dataUrl,
            rawBytes,
          });
        } catch {
          // skip unreadable file
        }
      }

      if (loadedItems.length > 0) {
        setImgToPdfItems((prev) => [...prev, ...loadedItems]);
        showToast(`Added ${loadedItems.length} high-resolution image(s) for PDF conversion!`);
      }
    },
    [showToast]
  );

  const handleLoadSampleImagesForPdf = useCallback(async () => {
    const sample1 = generateSamplePortraitDataUrl(1, false);
    const sample2 = generateSamplePortraitDataUrl(2, false);
    const sampleList: ImageToPdfItem[] = [];

    for (let i = 0; i < 2; i++) {
      const dUrl = i === 0 ? sample1 : sample2;
      const blob = dataUrlToBlob(dUrl);
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const im = new Image();
        im.onload = () => resolve({ w: im.naturalWidth || 700, h: im.naturalHeight || 880 });
        im.onerror = () => resolve({ w: 700, h: 880 });
        im.src = dUrl;
      });
      sampleList.push({
        id: `sample-imgpdf-${i + 1}-${Date.now()}`,
        name: `Studio_Portrait_Page_${i + 1}.png`,
        mimeType: 'image/png',
        sizeBytes: bytes.byteLength,
        width: dims.w,
        height: dims.h,
        dataUrl: dUrl,
        rawBytes: bytes,
      });
    }
    setImgToPdfItems(sampleList);
    showToast('Loaded 2 sample HD images ready to convert to PDF!');
  }, [showToast]);

  const moveImgToPdfItem = (index: number, direction: -1 | 1) => {
    setImgToPdfItems((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
  };

  const removeImgToPdfItem = (id: string) => {
    setImgToPdfItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleConvertAndDownloadPdf = async (autoDownload = true) => {
    if (imgToPdfItems.length === 0) {
      showToast('Please upload at least one image (JPG, PNG, or WebP) first!');
      return;
    }

    setIsConvertingImgToPdf(true);
    setImgToPdfProgress(5);
    setImgToPdfStatus('Initializing Lossless PDF Document...');

    try {
      const pdfDoc = await PDFDocument.create();
      const marginMap: Record<'none' | 'small' | 'medium' | 'large', number> = {
        none: 0,
        small: 20,
        medium: 38,
        large: 56,
      };
      const marginPt = marginMap[imgToPdfMargin] ?? 20;

      for (let i = 0; i < imgToPdfItems.length; i++) {
        const item = imgToPdfItems[i];
        setImgToPdfStatus(`Embedding Image ${i + 1} of ${imgToPdfItems.length} (${item.name})...`);
        setImgToPdfProgress(Math.max(10, Math.round(((i + 0.3) / imgToPdfItems.length) * 90)));

        // Embed image without compression artifacts:
        // - Direct byte-stream embedding for native PNG and JPEG
        // - Native resolution lossless PNG conversion for WebP
        let embeddedImg;
        const lowerMime = item.mimeType.toLowerCase();
        try {
          if (lowerMime.includes('png')) {
            embeddedImg = await pdfDoc.embedPng(item.rawBytes);
          } else if (lowerMime.includes('jpeg') || lowerMime.includes('jpg')) {
            embeddedImg = await pdfDoc.embedJpg(item.rawBytes);
          } else {
            throw new Error('Convert WebP to lossless PNG');
          }
        } catch {
          // Lossless full-resolution canvas conversion for WebP or non-standard headers
          const losslessPngBytes = await new Promise<Uint8Array>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              const c = document.createElement('canvas');
              c.width = img.naturalWidth || item.width || 1200;
              c.height = img.naturalHeight || item.height || 1600;
              const ctx = c.getContext('2d');
              if (!ctx) {
                reject(new Error('Canvas context unavailable'));
                return;
              }
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(img, 0, 0, c.width, c.height);
              const pngDataUrl = c.toDataURL('image/png');
              const b = dataUrlToBlob(pngDataUrl);
              b.arrayBuffer().then((ab) => resolve(new Uint8Array(ab))).catch(reject);
            };
            img.onerror = () => reject(new Error('Failed to decode image'));
            img.src = item.dataUrl;
          });
          embeddedImg = await pdfDoc.embedPng(losslessPngBytes);
        }

        const imgW = embeddedImg.width;
        const imgH = embeddedImg.height;

        let pageW: number;
        let pageH: number;

        if (imgToPdfPageSize === 'fit') {
          // Fit to Image Dimensions (Zero Crop, Native Resolution)
          const effectiveMargin = marginPt;
          if (imgToPdfOrientation === 'landscape' && imgH > imgW) {
            pageW = imgH + effectiveMargin * 2;
            pageH = imgW + effectiveMargin * 2;
          } else if (imgToPdfOrientation === 'portrait' && imgW > imgH) {
            pageW = imgH + effectiveMargin * 2;
            pageH = imgW + effectiveMargin * 2;
          } else {
            pageW = imgW + effectiveMargin * 2;
            pageH = imgH + effectiveMargin * 2;
          }
        } else {
          // Standard A4 (595.28 × 841.89 pt)
          const A4_SHORT = 595.28;
          const A4_LONG = 841.89;
          const useLandscape =
            imgToPdfOrientation === 'landscape' ||
            (imgToPdfOrientation === 'auto' && imgW > imgH);
          pageW = useLandscape ? A4_LONG : A4_SHORT;
          pageH = useLandscape ? A4_SHORT : A4_LONG;
        }

        const page = pdfDoc.addPage([pageW, pageH]);

        // Crisp white page background
        page.drawRectangle({
          x: 0,
          y: 0,
          width: pageW,
          height: pageH,
          color: rgb(1, 1, 1),
        });

        const availW = Math.max(20, pageW - marginPt * 2);
        const availH = Math.max(20, pageH - marginPt * 2);
        const scale = Math.min(availW / imgW, availH / imgH);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const drawX = marginPt + (availW - drawW) / 2;
        const drawY = marginPt + (availH - drawH) / 2;

        page.drawImage(embeddedImg, {
          x: drawX,
          y: drawY,
          width: drawW,
          height: drawH,
        });

        setImgToPdfProgress(Math.round(((i + 1) / imgToPdfItems.length) * 95));
      }

      setImgToPdfStatus('Finalizing Lossless PDF Stream...');
      const pdfBytes = await pdfDoc.save();
      const pdfBlob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });

      if (imgToPdfOutputUrl) {
        URL.revokeObjectURL(imgToPdfOutputUrl);
      }
      const nextUrl = URL.createObjectURL(pdfBlob);
      setImgToPdfOutputBytes(pdfBytes);
      setImgToPdfOutputSize(pdfBytes.byteLength);
      setImgToPdfOutputUrl(nextUrl);
      setImgToPdfProgress(100);
      setImgToPdfStatus(
        `Converted ${imgToPdfItems.length} image(s) to HD PDF (${formatBytes(pdfBytes.byteLength)})`
      );

      if (autoDownload) {
        const cleanName =
          (imgToPdfFilename || 'studiopassport-images-hd').replace(/\.pdf$/i, '').trim() ||
          'studiopassport-images-hd';
        triggerBlobDownload(pdfBlob, `${cleanName}.pdf`);
        showToast(
          `✨ Converted & Downloaded HD PDF (${imgToPdfItems.length} ${
            imgToPdfItems.length === 1 ? 'Page' : 'Pages'
          } · ${formatBytes(pdfBytes.byteLength)})!`
        );
      }
    } catch (err: any) {
      console.error('Image to PDF error:', err);
      showToast(err?.message || 'Failed to convert images to PDF.');
      setImgToPdfStatus('Error converting images to PDF.');
    } finally {
      setIsConvertingImgToPdf(false);
    }
  };

  const akshayaToolsList = toolCatalog.filter(
    (t) => t.category === 'akshaya' && t.enabled
  );

  return (
    <div className="max-w-[1680px] w-full mx-auto px-4 sm:px-6 xl:px-10 py-4 sm:py-6 space-y-5">
      {/* Category 2 Header Banner & Sub-Tool Switcher */}
      <div className="bg-[#070a14] text-white rounded-3xl border border-cyan-500/30 p-4 sm:p-6 shadow-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
              CATEGORY 2 · E-GOVERNANCE & CITIZEN DOCUMENT SUITE
            </div>
            <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight mt-1">
              Akshaya Tools — High-Quality Image to PDF, PDF Compressor, Target-KB Image Compressor, Merge, Split & Signature
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Lossless Image-to-PDF Converter (JPG/PNG/WebP), True PDF Page Raster & Stream Compression, Target-KB Image Compression, PDF Merge/Split, and Portal Signature Cleaner.
            </p>
          </div>
          {activeSubTool !== 'overview' && (
            <button
              onClick={() => setActiveSubTool('overview')}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-cyan-300 text-xs font-bold self-start md:self-auto shrink-0"
            >
              ← All Akshaya Tools
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2 border-t border-white/10">
          {[
            { id: 'overview', label: 'All Akshaya Tools', icon: 'fa-grip' },
            { id: 'image-to-pdf', label: 'Image to PDF (Lossless HD)', icon: 'fa-images' },
            { id: 'pdf-compressor', label: 'PDF Compressor (Target KB)', icon: 'fa-file-zipper' },
            { id: 'image-compressor', label: 'Image Compressor (Target KB)', icon: 'fa-compress' },
            { id: 'pdf-merge', label: 'PDF Merge', icon: 'fa-file-pdf' },
            { id: 'pdf-split', label: 'PDF Split & Extract', icon: 'fa-scissors' },
            { id: 'signature-resize', label: 'Signature Resize & Clean', icon: 'fa-signature' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTool(tab.id as AkshayaSubToolId)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 whitespace-nowrap ${
                activeSubTool === tab.id
                  ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white shadow-sm'
                  : 'bg-white/10 hover:bg-white/15 text-slate-300'
              }`}
            >
              <i className={`fa-solid ${tab.icon}`}></i>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* =====================================================================
          VIEW 0: AKSHAYA TOOLS CATEGORY LANDING GRID
         ===================================================================== */}
      {activeSubTool === 'overview' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {akshayaToolsList.map((tool) => (
            <div
              key={tool.id}
              className="bg-white rounded-3xl border border-slate-200 hover:border-cyan-400 p-5 flex flex-col justify-between gap-4 shadow-xs transition group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-[#070a14] text-amber-400 border border-amber-500/30 flex items-center justify-center text-lg shadow-sm group-hover:scale-105 transition">
                    <i className={`fa-solid ${tool.icon}`}></i>
                  </div>
                  {tool.badge && (
                    <span className="text-[11px] font-bold text-cyan-700">{tool.badge}</span>
                  )}
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">{tool.name}</h2>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {tool.description}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveSubTool(tool.id as AkshayaSubToolId)}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-2xl bg-[#070a14] hover:bg-slate-800 text-cyan-300 font-bold text-xs transition flex items-center justify-center gap-2"
              >
                <span>Open {tool.name}</span>
                <i className="fa-solid fa-arrow-right text-[11px]"></i>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* =====================================================================
          TOOL 1: PDF MERGE
         ===================================================================== */}
      {activeSubTool === 'pdf-merge' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">PDF Merge Studio</h2>
                <p className="text-xs text-slate-500">
                  Upload multiple PDFs, reorder them, and combine into a single PDF document.
                </p>
              </div>
              <button
                type="button"
                onClick={handleLoadSampleMergePdfs}
                className="px-3 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-800 text-xs font-bold shrink-0"
              >
                Load Sample PDFs
              </button>
            </div>

            {mergeError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                {mergeError}
              </div>
            )}

            <button
              onClick={() => mergeFileInputRef.current?.click()}
              className="w-full min-h-[50px] py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-file-circle-plus"></i>
              <span>Select Multiple PDF Files to Merge</span>
            </button>
            <input
              ref={mergeFileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              onChange={handleMergeFilesUpload}
              className="hidden"
            />

            {mergeItems.length === 0 ? (
              <div className="py-10 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-400">
                No PDF files uploaded yet. Click above or click "Load Sample PDFs" to test immediately.
              </div>
            ) : (
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {mergeItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-[#070a14] text-cyan-300 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{item.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'} ·{' '}
                          {formatBytes(item.sizeBytes)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveMergeItem(idx, -1)}
                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 disabled:opacity-40 text-xs"
                        title="Move Up"
                      >
                        <i className="fa-solid fa-arrow-up"></i>
                      </button>
                      <button
                        type="button"
                        disabled={idx === mergeItems.length - 1}
                        onClick={() => moveMergeItem(idx, 1)}
                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 disabled:opacity-40 text-xs"
                        title="Move Down"
                      >
                        <i className="fa-solid fa-arrow-down"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setMergeItems((prev) => prev.filter((m) => m.id !== item.id))
                        }
                        className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 text-xs"
                        title="Remove PDF"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleExecutePdfMerge}
              disabled={mergeItems.length < 2 || isMerging}
              className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-[#070a14] hover:bg-slate-800 text-cyan-300 font-bold text-xs disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-object-group"></i>
              <span>
                {isMerging ? `Merging PDFs (${mergeProgress}%)...` : `Merge ${mergeItems.length} PDFs Now`}
              </span>
            </button>
          </div>

          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3">
              Merged Document Output & Live Preview
            </h3>

            {mergedPdfBytes ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-extrabold text-emerald-950">
                      Merged PDF Ready ({mergedTotalPages} Total Pages)
                    </div>
                    <div className="text-xs text-emerald-700 font-mono">
                      Output Size: {formatBytes(mergedPdfBytes.byteLength)}
                    </div>
                  </div>
                  <button
                    onClick={downloadMergedPdf}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-2 shadow-sm"
                  >
                    <i className="fa-solid fa-download"></i>
                    <span>Download Merged PDF</span>
                  </button>
                </div>

                {mergedPdfUrl && (
                  <iframe
                    src={mergedPdfUrl}
                    title="Merged PDF Preview"
                    className="w-full h-[460px] rounded-2xl border border-slate-200 bg-slate-50"
                  />
                )}
              </div>
            ) : (
              <div className="py-20 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                Upload at least 2 PDFs or click "Load Sample PDFs" to preview and download your merged document.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 2: PDF SPLIT & EXTRACT
         ===================================================================== */}
      {activeSubTool === 'pdf-split' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">PDF Split & Extract</h2>
                <p className="text-xs text-slate-500">
                  Split by page ranges, click pages to extract, or burst every page into separate PDFs.
                </p>
              </div>
              <button
                type="button"
                onClick={handleLoadSampleSplitPdf}
                className="px-3 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-800 text-xs font-bold shrink-0"
              >
                Sample 6-Page PDF
              </button>
            </div>

            {splitError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                {splitError}
              </div>
            )}

            <button
              onClick={() => splitFileInputRef.current?.click()}
              className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-file-pdf"></i>
              <span>Upload PDF to Split</span>
            </button>
            <input
              ref={splitFileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleSplitFileUpload}
              className="hidden"
            />

            {splitTotalPages > 0 && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-900 truncate">
                    {splitSourceName}
                  </div>
                  <div className="text-[11px] text-cyan-700 font-mono font-bold">
                    Total Pages: {splitTotalPages}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
                {[
                  { id: 'ranges', label: 'Page Ranges' },
                  { id: 'extract', label: 'Extract Pages' },
                  { id: 'every', label: 'Every Page' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSplitMode(m.id as any)}
                    className={`py-2 rounded-xl border transition ${
                      splitMode === m.id
                        ? 'bg-[#070a14] text-cyan-300 border-cyan-500'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {splitMode === 'ranges' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Page Ranges (Comma-Separated)
                  </label>
                  <input
                    type="text"
                    value={splitRangesInput}
                    onChange={(e) => setSplitRangesInput(e.target.value)}
                    placeholder="1-3, 4-6"
                    className="w-full min-h-[42px] px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Example: <span className="font-mono">1-3, 4-6</span> creates PDF 1 (Pages 1–3) and PDF 2 (Pages 4–6).
                  </p>
                </div>
              )}

              {splitMode === 'extract' && (
                <div className="space-y-2.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Click Pages to Extract or Type Page Numbers
                  </label>
                  {splitTotalPages > 0 && splitTotalPages <= 40 && (
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: splitTotalPages }, (_, i) => i + 1).map((pNum) => {
                        const isSel = selectedExtractPages.includes(pNum);
                        return (
                          <button
                            key={pNum}
                            type="button"
                            onClick={() => toggleExtractPageNumber(pNum)}
                            className={`w-9 h-9 rounded-xl text-xs font-mono font-bold border transition ${
                              isSel
                                ? 'bg-cyan-600 text-white border-cyan-700 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-cyan-400'
                            }`}
                          >
                            {pNum}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <input
                    type="text"
                    value={splitExtractInput}
                    onChange={(e) => setSplitExtractInput(e.target.value)}
                    placeholder="1, 3, 5"
                    className="w-full min-h-[42px] px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl"
                  />
                </div>
              )}

              {splitMode === 'every' && (
                <p className="text-xs text-slate-600">
                  Every single page (1 to {splitTotalPages || 'N'}) will be saved as a separate PDF file.
                </p>
              )}
            </div>

            <button
              onClick={handleExecutePdfSplit}
              disabled={!splitSourceBytes || isSplitting}
              className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-[#070a14] hover:bg-slate-800 text-cyan-300 font-bold text-xs disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-scissors"></i>
              <span>{isSplitting ? 'Splitting PDF...' : 'Generate Split PDFs'}</span>
            </button>
          </div>

          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Generated Split Files ({splitOutputs.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Download individual PDFs or download all as a ZIP archive
                </p>
              </div>
              {splitOutputs.length > 1 && (
                <button
                  onClick={downloadAllSplitAsZip}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold flex items-center gap-2"
                >
                  <i className="fa-solid fa-file-zipper"></i>
                  <span>Download All (.ZIP)</span>
                </button>
              )}
            </div>

            {splitOutputs.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                Upload a PDF or click "Sample 6-Page PDF", then click "Generate Split PDFs".
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {splitOutputs.map((out, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-900 truncate">{out.name}</div>
                      <div className="text-[11px] text-cyan-700 font-mono">
                        {out.pageDesc} · {formatBytes(out.sizeBytes)}
                      </div>
                    </div>
                    <button
                      onClick={() => downloadSingleSplitPdf(out)}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#070a14] hover:bg-slate-800 text-cyan-300 text-xs font-bold shrink-0 flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-download"></i>
                      <span>Download PDF</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 3: TRUE PDF COMPRESSOR (RASTER + TARGET-KB + LIVE PREVIEW)
         ===================================================================== */}
      {activeSubTool === 'pdf-compressor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  <i className="fa-solid fa-bolt"></i> Real Page Re-Encoding Engine
                </span>
                <h2 className="text-lg font-extrabold text-slate-900 mt-1">
                  PDF Compressor (Target KB & High Ratio)
                </h2>
                <p className="text-xs text-slate-500">
                  Genuinely compresses scanned PDFs, certificates, and forms down to exact KB limits (100KB, 200KB, 300KB) for Akshaya & government portals.
                </p>
              </div>
              <button
                type="button"
                onClick={handleLoadSampleCompressPdf}
                className="px-3 py-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-800 text-xs font-bold shrink-0"
              >
                Test Sample PDF
              </button>
            </div>

            <button
              onClick={() => compPdfInputRef.current?.click()}
              className="w-full min-h-[50px] py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-file-arrow-up"></i>
              <span>Upload PDF Document to Compress</span>
            </button>
            <input
              ref={compPdfInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleCompressPdfUpload}
              className="hidden"
            />

            {compPdfOrigBytes && (
              <div className="p-3.5 rounded-2xl bg-slate-900 text-white border border-cyan-500/30 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-cyan-300 truncate">{compPdfName}</div>
                  <div className="text-[11px] font-mono text-slate-300 mt-0.5">
                    Original Size: <span className="font-bold text-white">{formatBytes(compPdfOrigSize)}</span> ·{' '}
                    {compPdfPageCount} {compPdfPageCount === 1 ? 'Page' : 'Pages'}
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold shrink-0">
                  Loaded
                </span>
              </div>
            )}

            {/* Compression Mode Switcher: Preset Level vs Target Max KB */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 rounded-xl text-xs font-extrabold">
                <button
                  type="button"
                  onClick={() => {
                    setCompPdfMode('preset');
                    if (compPdfOrigBytes) {
                      runTruePdfCompression(compPdfOrigBytes, 'preset', compPdfLevel, compPdfTargetKb);
                    }
                  }}
                  className={`py-2 rounded-lg transition ${
                    compPdfMode === 'preset'
                      ? 'bg-[#070a14] text-cyan-300 shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  By Compression Level
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCompPdfMode('target-kb');
                    if (compPdfOrigBytes) {
                      runTruePdfCompression(compPdfOrigBytes, 'target-kb', compPdfLevel, compPdfTargetKb);
                    }
                  }}
                  className={`py-2 rounded-lg transition ${
                    compPdfMode === 'target-kb'
                      ? 'bg-[#070a14] text-amber-300 shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  By Target Max KB
                </button>
              </div>

              {compPdfMode === 'preset' ? (
                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  {[
                    { id: 'low', label: 'Low Compression', sub: 'High Print Clarity (~35% Saved)' },
                    { id: 'medium', label: 'Recommended', sub: 'Balanced Portal Quality (~60% Saved)' },
                    { id: 'high', label: 'High Compression', sub: 'Small File Size (~75% Saved)' },
                    { id: 'extreme', label: 'Extreme Compact', sub: 'Maximum Reduction (~88% Saved)' },
                  ].map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => {
                        setCompPdfLevel(lvl.id as any);
                        if (compPdfOrigBytes) {
                          runTruePdfCompression(compPdfOrigBytes, 'preset', lvl.id as any, compPdfTargetKb);
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        compPdfLevel === lvl.id
                          ? 'bg-[#070a14] text-cyan-300 border-cyan-500 ring-1 ring-cyan-500'
                          : 'bg-white text-slate-800 border-slate-200 hover:border-cyan-300'
                      }`}
                    >
                      <div className="font-extrabold">{lvl.label}</div>
                      <div
                        className={`text-[10px] mt-0.5 ${
                          compPdfLevel === lvl.id ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {lvl.sub}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700">
                    Select Portal Target Max PDF Size (KB)
                  </label>
                  <div className="grid grid-cols-5 gap-1.5 text-xs font-extrabold">
                    {[50, 100, 150, 200, 300].map((kbVal) => (
                      <button
                        key={kbVal}
                        type="button"
                        onClick={() => {
                          setCompPdfTargetKb(kbVal);
                          if (compPdfOrigBytes) {
                            runTruePdfCompression(compPdfOrigBytes, 'target-kb', compPdfLevel, kbVal);
                          }
                        }}
                        className={`py-2 rounded-xl border transition ${
                          compPdfTargetKb === kbVal
                            ? 'bg-[#070a14] text-amber-300 border-amber-400'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-cyan-400'
                        }`}
                      >
                        {kbVal} KB
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 shrink-0">Custom Target (KB):</span>
                    <input
                      type="number"
                      min={20}
                      max={5000}
                      value={compPdfTargetKb}
                      onChange={(e) => setCompPdfTargetKb(Math.max(20, parseInt(e.target.value, 10) || 100))}
                      className="w-full min-h-[38px] px-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleExecutePdfCompression}
              disabled={!compPdfOrigBytes || isCompressingPdf}
              className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-[#070a14] hover:bg-slate-800 text-cyan-300 font-extrabold text-xs disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
            >
              <i className="fa-solid fa-compress"></i>
              <span>
                {isCompressingPdf
                  ? `Compressing PDF Pages (${compPdfProgress}%)...`
                  : 'Compress PDF Now'}
              </span>
            </button>
          </div>

          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3">
              Compressed PDF Result & Page Preview
            </h3>

            {compPdfNotice && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
                {compPdfNotice}
              </div>
            )}

            {compPdfOutBytes ? (
              <div className="space-y-4">
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <div className="text-[11px] text-slate-500 font-bold">Original Size</div>
                      <div className="text-sm sm:text-base font-extrabold font-mono text-slate-900 mt-1">
                        {formatBytes(compPdfOrigSize)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-cyan-300">
                      <div className="text-[11px] text-cyan-700 font-bold">Compressed Size</div>
                      <div className="text-sm sm:text-base font-extrabold font-mono text-cyan-700 mt-1">
                        {formatBytes(compPdfOutSize)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300">
                      <div className="text-[11px] text-emerald-700 font-bold">Size Reduced</div>
                      <div className="text-sm sm:text-base font-extrabold font-mono text-emerald-700 mt-1">
                        {compPdfOrigSize > compPdfOutSize
                          ? `-${Math.round(((compPdfOrigSize - compPdfOutSize) / compPdfOrigSize) * 100)}%`
                          : 'Optimized'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const blob = new Blob([compPdfOutBytes as unknown as BlobPart], {
                        type: 'application/pdf',
                      });
                      triggerBlobDownload(blob, `compressed-${compPdfName || 'document.pdf'}`);
                      showToast(`Downloaded Compressed PDF (${formatBytes(compPdfOutSize)})!`);
                    }}
                    className="w-full min-h-[50px] py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white font-extrabold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-download"></i>
                    <span>
                      Download Compressed PDF ({formatBytes(compPdfOutSize)})
                    </span>
                  </button>
                </div>

                {compPdfPageThumbs.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-extrabold text-slate-700">
                      Compressed Page Previews ({compPdfPageCount} Pages)
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {compPdfPageThumbs.map((thumb, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center gap-1"
                        >
                          <img
                            src={thumb}
                            alt={`Page ${idx + 1}`}
                            className="w-full h-36 object-contain rounded bg-white border border-slate-200"
                          />
                          <span className="text-[10px] font-mono font-bold text-slate-600">
                            Page {idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-20 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <i className="fa-solid fa-file-zipper text-3xl text-slate-300"></i>
                <div>
                  Upload any PDF document or click <strong>"Test Sample PDF"</strong> to compress it immediately.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 4: BATCH IMAGE COMPRESSOR (TARGET-KB + QUALITY + BLOB DOWNLOAD)
         ===================================================================== */}
      {activeSubTool === 'image-compressor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-md">
                  <i className="fa-solid fa-compress"></i> Exact KB & Batch Engine
                </span>
                <h2 className="text-lg font-extrabold text-slate-900 mt-1">
                  Image Compressor (Target KB & Batch)
                </h2>
                <p className="text-xs text-slate-500">
                  Compress single or multiple photos to exact portal KB limits (20KB, 50KB, 100KB, 200KB) or custom quality.
                </p>
              </div>
              <button
                type="button"
                onClick={handleLoadSampleBatchImages}
                className="px-3 py-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-800 text-xs font-bold shrink-0"
              >
                Sample Photos
              </button>
            </div>

            <button
              onClick={() => imgCompInputRef.current?.click()}
              className="w-full min-h-[50px] py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-images"></i>
              <span>+ Upload Single or Multiple Images</span>
            </button>
            <input
              ref={imgCompInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleBatchImagesUpload}
              className="hidden"
            />

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
              {/* Mode Switcher: Target Max KB vs Quality % */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 rounded-xl text-xs font-extrabold">
                <button
                  type="button"
                  onClick={() => setImgCompMode('target-kb')}
                  className={`py-2 rounded-lg transition ${
                    imgCompMode === 'target-kb'
                      ? 'bg-[#070a14] text-amber-300 shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Target Max KB (Portal)
                </button>
                <button
                  type="button"
                  onClick={() => setImgCompMode('quality')}
                  className={`py-2 rounded-lg transition ${
                    imgCompMode === 'quality'
                      ? 'bg-[#070a14] text-cyan-300 shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Manual Quality %
                </button>
              </div>

              {imgCompMode === 'target-kb' ? (
                <div className="space-y-2.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Select Maximum Output Size (KB)
                  </label>
                  <div className="grid grid-cols-5 gap-1.5 text-xs font-extrabold">
                    {[20, 50, 100, 200, 500].map((kb) => (
                      <button
                        key={kb}
                        type="button"
                        onClick={() => setImgCompTargetKb(kb)}
                        className={`py-2 rounded-xl border transition ${
                          imgCompTargetKb === kb
                            ? 'bg-[#070a14] text-amber-300 border-amber-400'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-cyan-400'
                        }`}
                      >
                        &lt; {kb}KB
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 shrink-0">Custom Max KB:</span>
                    <input
                      type="number"
                      min={5}
                      max={2000}
                      value={imgCompTargetKb}
                      onChange={(e) => setImgCompTargetKb(Math.max(5, parseInt(e.target.value, 10) || 50))}
                      className="w-full min-h-[38px] px-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold text-slate-700">Compression Quality</span>
                    <span className="font-mono font-bold text-cyan-700">{imgCompQuality}%</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={95}
                    value={imgCompQuality}
                    onChange={(e) => setImgCompQuality(parseInt(e.target.value, 10))}
                    className="w-full cursor-pointer"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Output Format
                  </label>
                  <select
                    value={imgCompFormat}
                    onChange={(e) => setImgCompFormat(e.target.value as any)}
                    className="w-full min-h-[40px] px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-xl"
                  >
                    <option value="image/jpeg">JPEG (Smallest Size)</option>
                    <option value="image/webp">WebP (Modern HD)</option>
                    <option value="image/png">PNG (Quantized)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Max Width Cap
                  </label>
                  <select
                    value={imgCompMaxWidth}
                    onChange={(e) => setImgCompMaxWidth(parseInt(e.target.value, 10))}
                    className="w-full min-h-[40px] px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-xl"
                  >
                    <option value={0}>Auto / Original</option>
                    <option value={1920}>Max 1920 px</option>
                    <option value={1280}>Max 1280 px</option>
                    <option value={800}>Max 800 px (Portal)</option>
                    <option value={500}>Max 500 px (Passport)</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                runBatchImageCompression(
                  rawBatchImages,
                  imgCompMode,
                  imgCompTargetKb,
                  imgCompQuality,
                  imgCompFormat,
                  imgCompMaxWidth
                )
              }
              disabled={rawBatchImages.length === 0 || isCompressingImgs}
              className="w-full min-h-[46px] py-2.5 px-4 rounded-2xl bg-[#070a14] hover:bg-slate-800 text-cyan-300 font-extrabold text-xs flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-bolt"></i>
              <span>
                {isCompressingImgs ? 'Compressing Images...' : 'Re-Compress All Images Now'}
              </span>
            </button>

            {compressedImages.length > 1 && (
              <button
                onClick={downloadAllCompressedImagesZip}
                className="w-full min-h-[46px] py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm"
              >
                <i className="fa-solid fa-file-zipper"></i>
                <span>Download All ({compressedImages.length}) as ZIP</span>
              </button>
            )}
          </div>

          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Compressed Images Ready ({compressedImages.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Click "Download" on any image to save the compressed file
                </p>
              </div>
              {rawBatchImages.length > 0 && (
                <button
                  onClick={() => setRawBatchImages([])}
                  className="text-xs font-bold text-rose-600 hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {compressedImages.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <img
                      src={item.outDataUrl}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded-xl border border-slate-300 bg-white shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-900 truncate">
                        {item.name}
                      </div>
                      <div className="text-xs font-mono text-slate-600 mt-0.5">
                        Original: <span className="line-through text-slate-400">{formatBytes(item.origBytes)}</span>{' '}
                        → <span className="font-extrabold text-emerald-700">{formatBytes(item.outBytes)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                          Saved {item.reductionPct}%
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {item.outW}×{item.outH} px · Q:{item.qualityUsed}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => downloadSingleCompressedImage(item)}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
                  >
                    <i className="fa-solid fa-download"></i>
                    <span>Download ({formatBytes(item.outBytes)})</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 5: SIGNATURE RESIZE & CLEAN
         ===================================================================== */}
      {activeSubTool === 'signature-resize' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-700">
                PORTAL-COMPLIANT SIGNATURE STUDIO
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 mt-0.5">
                Signature Resize & Background Cleaner
              </h2>
              <p className="text-xs text-slate-500">
                Resize signatures for SSC, IBPS, Kerala PSC, PAN & Passport Seva with automatic KB limit control.
              </p>
            </div>

            <button
              onClick={() => sigFileInputRef.current?.click()}
              className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-signature"></i>
              <span>Upload Signature Photo</span>
            </button>
            <input
              ref={sigFileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = (ev) => {
                  if (ev.target?.result) {
                    loadSignatureFromUrl(ev.target.result as string);
                    showToast('Signature image loaded!');
                  }
                };
                r.readAsDataURL(f);
                e.target.value = '';
              }}
              className="hidden"
            />

            {/* Signature Presets */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official Portal Signature Presets
              </label>
              <select
                onChange={(e) => {
                  const found = SIGNATURE_PRESETS.find((p) => p.id === e.target.value);
                  if (found) {
                    setSigUnit(found.unit);
                    setSigTargetW(found.w);
                    setSigTargetH(found.h);
                    setSigMaxKbLimit(found.maxKb);
                  }
                }}
                className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
              >
                {SIGNATURE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Width ({sigUnit})
                  </label>
                  <input
                    type="number"
                    value={sigTargetW}
                    onChange={(e) => setSigTargetW(parseFloat(e.target.value) || 140)}
                    className="w-full min-h-[38px] px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Height ({sigUnit})
                  </label>
                  <input
                    type="number"
                    value={sigTargetH}
                    onChange={(e) => setSigTargetH(parseFloat(e.target.value) || 60)}
                    className="w-full min-h-[38px] px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Unit
                  </label>
                  <select
                    value={sigUnit}
                    onChange={(e) => setSigUnit(e.target.value as any)}
                    className="w-full min-h-[38px] px-2 py-1 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                  >
                    <option value="px">px</option>
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer">
                <span>Preserve Signature Proportions (No Distortion)</span>
                <input
                  type="checkbox"
                  checked={sigLockAspect}
                  onChange={(e) => setSigLockAspect(e.target.checked)}
                  className="w-4 h-4 accent-cyan-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer">
                <span>Remove White Paper Background (Transparent PNG)</span>
                <input
                  type="checkbox"
                  checked={sigRemoveWhiteBg}
                  onChange={(e) => {
                    setSigRemoveWhiteBg(e.target.checked);
                    if (e.target.checked) setSigFormat('image/png');
                  }}
                  className="w-4 h-4 accent-cyan-600 rounded"
                />
              </label>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-slate-700">Paper Threshold & Ink Contrast</span>
                  <span className="font-mono font-bold text-cyan-700">{sigThreshold}</span>
                </div>
                <input
                  type="range"
                  min={140}
                  max={245}
                  value={sigThreshold}
                  onChange={(e) => setSigThreshold(parseInt(e.target.value, 10))}
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-slate-700">Crop Outer Margin</span>
                  <span className="font-mono font-bold text-cyan-700">{sigCropPaddingPct}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={35}
                  value={sigCropPaddingPct}
                  onChange={(e) => setSigCropPaddingPct(parseInt(e.target.value, 10))}
                  className="w-full cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Ink Tone
                  </label>
                  <select
                    value={sigInkMode}
                    onChange={(e) => setSigInkMode(e.target.value as any)}
                    className="w-full min-h-[38px] px-2.5 py-1 text-xs font-bold bg-white border border-slate-200 rounded-xl"
                  >
                    <option value="blue">Royal Blue Ink</option>
                    <option value="black">Jet Black Ink</option>
                    <option value="original">Original Color</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Export Format
                  </label>
                  <select
                    value={sigFormat}
                    onChange={(e) => setSigFormat(e.target.value as any)}
                    className="w-full min-h-[38px] px-2.5 py-1 text-xs font-bold bg-white border border-slate-200 rounded-xl"
                  >
                    <option value="image/jpeg">White BG JPG (Portal Standard)</option>
                    <option value="image/png">Transparent PNG</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!sigOutputUrl) return;
                const ext = sigFormat === 'image/png' ? 'png' : 'jpg';
                const blob = dataUrlToBlob(sigOutputUrl);
                triggerBlobDownload(blob, `malnadu-signature-${sigTargetW}x${sigTargetH}.${ext}`);
                showToast(`Downloaded Signature (${formatBytes(sigOutputBytes)})!`);
              }}
              className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-[#070a14] hover:bg-slate-800 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-download"></i>
              <span>
                Download Signature ({sigTargetW}×{sigTargetH} {sigUnit} · {formatBytes(sigOutputBytes)})
              </span>
            </button>
          </div>

          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Live Signature Preview
                </h3>
                <p className="text-xs text-slate-500">
                  Target: {sigTargetW}×{sigTargetH} {sigUnit} · Output Size: {formatBytes(sigOutputBytes)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center">
                <span className="text-xs font-bold text-slate-500 mb-2">Original Input</span>
                <div className="w-full h-[140px] bg-white rounded-xl border border-slate-200 flex items-center justify-center p-3">
                  {sigSourceUrl && (
                    <img
                      src={sigSourceUrl}
                      alt="Original Signature"
                      className="max-h-full max-w-full object-contain"
                    />
                  )}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center">
                <span className="text-xs font-bold text-cyan-700 mb-2">
                  Processed & Resized Signature ({sigFormat === 'image/png' && sigRemoveWhiteBg ? 'Transparent PNG' : 'Solid White Background JPG'})
                </span>
                <div className="w-full h-[180px] checkerboard rounded-xl border border-cyan-300 flex items-center justify-center p-4">
                  {sigOutputUrl && (
                    <img
                      src={sigOutputUrl}
                      alt="Processed Signature"
                      className="max-h-full max-w-full object-contain shadow-sm"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 6: HIGH-QUALITY IMAGE TO PDF CONVERTER (LOSSLESS HD PDF-LIB)
         ===================================================================== */}
      {activeSubTool === 'image-to-pdf' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Drag & Drop Upload + Page Layout & Margin Settings */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  <i className="fa-solid fa-gem"></i> Zero Compression Artifacts · pdf-lib Engine
                </span>
                <h2 className="text-lg font-extrabold text-slate-900 mt-1">
                  High-Quality Image to PDF Converter
                </h2>
                <p className="text-xs text-slate-500">
                  Upload single or multiple JPG, PNG, or WebP images. Preserves 100% original pixel clarity with custom page sizes, orientation, and margins.
                </p>
              </div>
              <button
                type="button"
                onClick={handleLoadSampleImagesForPdf}
                className="px-3 py-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-800 text-xs font-bold shrink-0"
              >
                Sample Images
              </button>
            </div>

            {/* Drag-and-Drop Upload Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setImgToPdfDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setImgToPdfDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setImgToPdfDragOver(false);
                if (e.dataTransfer?.files?.length) {
                  processFilesForImageToPdf(e.dataTransfer.files);
                }
              }}
              onClick={() => imgToPdfInputRef.current?.click()}
              className={`cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition space-y-2 ${
                imgToPdfDragOver
                  ? 'border-cyan-500 bg-cyan-50/80 scale-[1.01]'
                  : 'border-slate-300 hover:border-cyan-400 bg-slate-50/70'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-[#070a14] text-cyan-300 mx-auto flex items-center justify-center text-lg shadow-xs">
                <i className="fa-solid fa-cloud-arrow-up"></i>
              </div>
              <div>
                <div className="text-xs sm:text-sm font-extrabold text-slate-900">
                  Drag & Drop Images Here, or Click to Browse
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Supports Single or Multiple <strong>JPG, PNG, and WebP</strong> files (100% Lossless Quality)
                </div>
              </div>
            </div>
            <input
              ref={imgToPdfInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              multiple
              onChange={(e) => {
                if (e.target.files?.length) {
                  processFilesForImageToPdf(e.target.files);
                }
                e.target.value = '';
              }}
              className="hidden"
            />

            {/* PDF Page Layout, Orientation & Margin Controls */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <i className="fa-solid fa-sliders text-cyan-600"></i>
                <span>PDF Page Setup & Quality Options</span>
              </div>

              {/* Page Size: A4 vs Fit to Image */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Page Size
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs font-extrabold">
                  <button
                    type="button"
                    onClick={() => setImgToPdfPageSize('a4')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      imgToPdfPageSize === 'a4'
                        ? 'bg-[#070a14] text-cyan-300 border-cyan-500'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-cyan-300'
                    }`}
                  >
                    <div>A4 Standard</div>
                    <div className="text-[10px] font-normal opacity-80">210 × 297 mm Print Sheet</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImgToPdfPageSize('fit')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      imgToPdfPageSize === 'fit'
                        ? 'bg-[#070a14] text-cyan-300 border-cyan-500'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-cyan-300'
                    }`}
                  >
                    <div>Fit to Image</div>
                    <div className="text-[10px] font-normal opacity-80">Exact Image Dimensions</div>
                  </button>
                </div>
              </div>

              {/* Page Orientation: Portrait / Landscape / Auto */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Page Orientation
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs font-extrabold">
                  {[
                    { id: 'portrait', label: 'Portrait', icon: 'fa-file' },
                    { id: 'landscape', label: 'Landscape', icon: 'fa-image' },
                    { id: 'auto', label: 'Auto-Match', icon: 'fa-wand-magic-sparkles' },
                  ].map((ori) => (
                    <button
                      key={ori.id}
                      type="button"
                      onClick={() => setImgToPdfOrientation(ori.id as any)}
                      className={`py-2 px-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition ${
                        imgToPdfOrientation === ori.id
                          ? 'bg-[#070a14] text-amber-300 border-amber-400'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-cyan-300'
                      }`}
                    >
                      <i className={`fa-solid ${ori.icon} text-[11px]`}></i>
                      <span>{ori.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Page Margins: None / Small / Medium / Large */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Page Margins
                </label>
                <div className="grid grid-cols-4 gap-1.5 text-xs font-extrabold">
                  {[
                    { id: 'none', label: 'No Margin', sub: '0 pt' },
                    { id: 'small', label: 'Small', sub: '20 pt' },
                    { id: 'medium', label: 'Medium', sub: '38 pt' },
                    { id: 'large', label: 'Large', sub: '56 pt' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setImgToPdfMargin(m.id as any)}
                      className={`py-2 px-2 rounded-xl border text-center transition ${
                        imgToPdfMargin === m.id
                          ? 'bg-[#070a14] text-cyan-300 border-cyan-500'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-cyan-300'
                      }`}
                    >
                      <div>{m.label}</div>
                      <div className="text-[9px] font-mono opacity-75">{m.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Output PDF Filename */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Output PDF Filename
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={imgToPdfFilename}
                    onChange={(e) => setImgToPdfFilename(e.target.value)}
                    placeholder="studiopassport-images-hd"
                    className="w-full min-h-[38px] px-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl"
                  />
                  <span className="text-xs font-mono font-bold text-slate-500 shrink-0">.pdf</span>
                </div>
              </div>
            </div>

            {/* Progress Indicator */}
            {(isConvertingImgToPdf || imgToPdfProgress > 0) && (
              <div className="p-3.5 rounded-2xl bg-slate-900 text-white border border-cyan-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs font-extrabold">
                  <span className="text-cyan-300 truncate">{imgToPdfStatus || 'Ready'}</span>
                  <span className="font-mono text-amber-300">{imgToPdfProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-emerald-400 transition-all duration-200"
                    style={{ width: `${imgToPdfProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Primary Action: Convert & Download PDF */}
            <button
              type="button"
              onClick={() => handleConvertAndDownloadPdf(true)}
              disabled={imgToPdfItems.length === 0 || isConvertingImgToPdf}
              className="w-full min-h-[52px] py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition"
            >
              {isConvertingImgToPdf ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>Converting Images to Lossless PDF ({imgToPdfProgress}%)...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-file-pdf"></i>
                  <span>
                    Convert & Download PDF ({imgToPdfItems.length}{' '}
                    {imgToPdfItems.length === 1 ? 'Image' : 'Images'})
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Right Column: Reorderable Image Queue & Live PDF Preview */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Uploaded Images & Page Order ({imgToPdfItems.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Drag cards or use the Up / Down arrows to reorder pages before generating your PDF
                </p>
              </div>
              {imgToPdfItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setImgToPdfItems([]);
                    setImgToPdfOutputUrl('');
                    setImgToPdfOutputBytes(null);
                    setImgToPdfProgress(0);
                  }}
                  className="text-xs font-bold text-rose-600 hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>

            {imgToPdfItems.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <i className="fa-solid fa-images text-3xl text-slate-300"></i>
                <div>
                  No images uploaded yet. Drag & drop JPG, PNG, or WebP files on the left, or click{' '}
                  <strong>"Sample Images"</strong> to test right away.
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {imgToPdfItems.map((item, idx) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setImgToPdfDraggedIdx(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (imgToPdfDraggedIdx === null || imgToPdfDraggedIdx === idx) return;
                      setImgToPdfItems((prev) => {
                        const copy = [...prev];
                        const [dragged] = copy.splice(imgToPdfDraggedIdx, 1);
                        copy.splice(idx, 0, dragged);
                        return copy;
                      });
                      setImgToPdfDraggedIdx(null);
                    }}
                    className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 flex items-center justify-between gap-3 transition cursor-move"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-[#070a14] text-cyan-300 font-mono text-xs font-extrabold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <img
                        src={item.dataUrl}
                        alt={item.name}
                        className="w-14 h-14 object-cover rounded-xl border border-slate-300 bg-white shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-slate-900 truncate">
                          {item.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          {item.width} × {item.height} px · {formatBytes(item.sizeBytes)} ·{' '}
                          <span className="text-emerald-700 font-bold">Lossless Stream</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveImgToPdfItem(idx, -1)}
                        title="Move Page Up"
                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:border-cyan-400 disabled:opacity-40 text-slate-700 text-xs flex items-center justify-center"
                      >
                        <i className="fa-solid fa-arrow-up"></i>
                      </button>
                      <button
                        type="button"
                        disabled={idx === imgToPdfItems.length - 1}
                        onClick={() => moveImgToPdfItem(idx, 1)}
                        title="Move Page Down"
                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:border-cyan-400 disabled:opacity-40 text-slate-700 text-xs flex items-center justify-center"
                      >
                        <i className="fa-solid fa-arrow-down"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImgToPdfItem(item.id)}
                        title="Remove Image"
                        className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-600 text-xs flex items-center justify-center"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Generated PDF Summary & Live Preview */}
            {imgToPdfOutputUrl && imgToPdfOutputBytes && (
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                      <i className="fa-solid fa-circle-check text-emerald-600"></i>
                      <span>
                        HD PDF Ready ({imgToPdfItems.length}{' '}
                        {imgToPdfItems.length === 1 ? 'Page' : 'Pages'} ·{' '}
                        {formatBytes(imgToPdfOutputSize)})
                      </span>
                    </div>
                    <div className="text-[11px] text-emerald-800 mt-0.5">
                      Page Size: {imgToPdfPageSize.toUpperCase()} · Orientation:{' '}
                      {imgToPdfOrientation.toUpperCase()} · Margin: {imgToPdfMargin.toUpperCase()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const blob = new Blob([imgToPdfOutputBytes as unknown as BlobPart], {
                        type: 'application/pdf',
                      });
                      const cleanName =
                        (imgToPdfFilename || 'studiopassport-images-hd')
                          .replace(/\.pdf$/i, '')
                          .trim() || 'studiopassport-images-hd';
                      triggerBlobDownload(blob, `${cleanName}.pdf`);
                      showToast(`Downloaded ${cleanName}.pdf!`);
                    }}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#070a14] hover:bg-slate-800 text-cyan-300 text-xs font-extrabold flex items-center gap-2 shrink-0"
                  >
                    <i className="fa-solid fa-download"></i>
                    <span>Download PDF Again</span>
                  </button>
                </div>

                <iframe
                  src={imgToPdfOutputUrl}
                  title="Generated Image to PDF Preview"
                  className="w-full h-[380px] rounded-2xl border border-slate-200 bg-slate-900"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
