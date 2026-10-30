import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import {
  SiteSettings,
  ToolCatalogItem,
  DEFAULT_TOOL_CATALOG,
  generateSamplePortraitDataUrl,
  generateSampleSignatureDataUrl,
} from '../constants';

export type AkshayaSubToolId =
  | 'overview'
  | 'landing'
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
}

const SIGNATURE_PRESETS = [
  { id: 'ibps-ssc', label: 'IBPS / SBI / SSC (140 × 60 px)', w: 140, h: 60, unit: 'px' as const },
  { id: 'kerala-psc', label: 'Kerala PSC Portal (150 × 50 px)', w: 150, h: 50, unit: 'px' as const },
  { id: 'upsc', label: 'UPSC Civil Services (300 × 100 px)', w: 300, h: 100, unit: 'px' as const },
  { id: 'pan-nsdl', label: 'PAN Card NSDL/UTIITSL (4.5 × 2.0 cm @ 200 DPI)', w: 354, h: 157, unit: 'px' as const },
  { id: 'passport-in', label: 'Passport Seva (3.5 × 1.5 cm @ 300 DPI)', w: 413, h: 177, unit: 'px' as const },
];

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
  const [isSplitting, setIsSplitting] = useState<boolean>(false);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [splitOutputs, setSplitOutputs] = useState<SplitOutputFile[]>([]);

  const splitFileInputRef = useRef<HTMLInputElement | null>(null);

  // =========================================================================
  // 3. PDF COMPRESSOR STATE
  // =========================================================================
  const [compPdfName, setCompPdfName] = useState<string>('');
  const [compPdfOrigBytes, setCompPdfOrigBytes] = useState<Uint8Array | null>(null);
  const [compPdfOrigSize, setCompPdfOrigSize] = useState<number>(0);
  const [compPdfPageCount, setCompPdfPageCount] = useState<number>(0);
  const [compPdfLevel, setCompPdfLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [isCompressingPdf, setIsCompressingPdf] = useState<boolean>(false);
  const [compPdfOutBytes, setCompPdfOutBytes] = useState<Uint8Array | null>(null);
  const [compPdfOutSize, setCompPdfOutSize] = useState<number>(0);
  const [compPdfNotice, setCompPdfNotice] = useState<string | null>(null);

  const compPdfInputRef = useRef<HTMLInputElement | null>(null);

  // =========================================================================
  // 4. IMAGE COMPRESSOR STATE
  // =========================================================================
  const [rawBatchImages, setRawBatchImages] = useState<
    Array<{ id: string; name: string; src: string; origBytes: number; img: HTMLImageElement }>
  >([]);
  const [imgCompQuality, setImgCompQuality] = useState<number>(72);
  const [imgCompFormat, setImgCompFormat] = useState<'image/jpeg' | 'image/webp' | 'image/png'>('image/jpeg');
  const [imgCompMaxWidth, setImgCompMaxWidth] = useState<number>(0); // 0 = original
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
  const [sigRemoveWhiteBg, setSigRemoveWhiteBg] = useState<boolean>(true);
  const [sigThreshold, setSigThreshold] = useState<number>(215);
  const [sigInkMode, setSigInkMode] = useState<'original' | 'black' | 'blue'>('blue');
  const [sigCropPaddingPct, setSigCropPaddingPct] = useState<number>(8);
  const [sigFormat, setSigFormat] = useState<'image/png' | 'image/jpeg'>('image/png');
  const [sigQuality, setSigQuality] = useState<number>(95);
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
  // HELPER: GENERATE REAL SAMPLE PDF USING PDF-LIB
  // =========================================================================
  const createSamplePdfDocument = async (
    title: string,
    pageCount: number,
    includePaddingMetadata = false
  ): Promise<Uint8Array> => {
    const pdfDoc = await PDFDocument.create();
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    pdfDoc.setTitle(title);
    pdfDoc.setAuthor('MALNADU MEDIA Akshaya Suite');
    if (includePaddingMetadata) {
      pdfDoc.setSubject(' Official Akshaya Document Sample '.repeat(120));
      pdfDoc.setKeywords(Array.from({ length: 150 }, (_, i) => `akshaya-doc-keyword-${i}`));
    }

    for (let i = 1; i <= pageCount; i++) {
      const page = pdfDoc.addPage([595.28, 841.89]); // A4
      page.drawRectangle({
        x: 36,
        y: 36,
        width: 523,
        height: 769,
        borderColor: rgb(0.02, 0.71, 0.83),
        borderWidth: 1.5,
      });

      page.drawText('MALNADU MEDIA — AKSHAYA DOCUMENT SUITE', {
        x: 56,
        y: 765,
        size: 13,
        font: fontBold,
        color: rgb(0.03, 0.04, 0.08),
      });

      page.drawText(`${title} — Page ${i} of ${pageCount}`, {
        x: 56,
        y: 730,
        size: 18,
        font: fontBold,
        color: rgb(0.02, 0.45, 0.65),
      });

      page.drawText(
        `Official digital document generated for PDF Merge, Split, and Compression verification.`,
        {
          x: 56,
          y: 695,
          size: 11,
          font: fontRegular,
          color: rgb(0.3, 0.35, 0.42),
        }
      );

      for (let line = 0; line < 14; line++) {
        page.drawText(
          `Record Line #${line + 1}: Biometric & Citizen Service Application Reference ID #MM-2026-0${i}${line}`,
          {
            x: 56,
            y: 640 - line * 28,
            size: 10,
            font: fontRegular,
            color: rgb(0.2, 0.24, 0.3),
          }
        );
      }
    }

    return await pdfDoc.save({ useObjectStreams: !includePaddingMetadata });
  };

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
  };

  const handleLoadSampleMergePdfs = async () => {
    setMergeError(null);
    const bytes1 = await createSamplePdfDocument('Application_Form_Part_A.pdf', 2);
    const bytes2 = await createSamplePdfDocument('Identity_Annexure_Part_B.pdf', 3);
    setMergeItems([
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
    ]);
    showToast('Loaded 2 sample PDFs ready to merge!');
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

  const handleExecutePdfMerge = async () => {
    if (mergeItems.length < 2) {
      setMergeError('Please upload at least 2 PDF files to merge.');
      return;
    }
    setMergeError(null);
    setIsMerging(true);
    setMergeProgress(15);

    try {
      const mergedPdf = await PDFDocument.create();
      let totalPagesCount = 0;

      for (let i = 0; i < mergeItems.length; i++) {
        const item = mergeItems[i];
        const srcDoc = await PDFDocument.load(item.bytes, { ignoreEncryption: true });
        const indices = srcDoc.getPageIndices();
        const copiedPages = await mergedPdf.copyPages(srcDoc, indices);
        copiedPages.forEach((p) => mergedPdf.addPage(p));
        totalPagesCount += copiedPages.length;
        setMergeProgress(Math.round(((i + 1) / mergeItems.length) * 90));
      }

      const finalBytes = await mergedPdf.save({ useObjectStreams: true });
      const blob = new Blob([finalBytes as unknown as BlobPart], { type: 'application/pdf' });
      if (mergedPdfUrl) URL.revokeObjectURL(mergedPdfUrl);
      const url = URL.createObjectURL(blob);

      setMergedPdfBytes(finalBytes);
      setMergedPdfUrl(url);
      setMergedTotalPages(totalPagesCount);
      setMergeProgress(100);
      showToast(`Merged ${mergeItems.length} PDFs (${totalPagesCount} pages)!`);
    } catch (err) {
      console.error('PDF Merge error:', err);
      setMergeError('Failed to merge PDFs. Ensure none of the files are password-locked.');
    } finally {
      setIsMerging(false);
    }
  };

  const downloadMergedPdf = () => {
    if (!mergedPdfBytes) return;
    const blob = new Blob([mergedPdfBytes as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `malnadu-merged-${Date.now()}.pdf`;
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
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
      setSplitExtractInput(`1${count >= 2 ? ', 2' : ''}`);
      showToast(`Loaded "${file.name}" (${count} pages)`);
    } catch {
      setSplitError('Invalid or corrupted PDF file.');
    }
  };

  const handleLoadSampleSplitPdf = async () => {
    setSplitError(null);
    setSplitOutputs([]);
    const bytes = await createSamplePdfDocument('MultiPage_Citizen_Dossier.pdf', 6);
    setSplitSourceName('MultiPage_Citizen_Dossier.pdf');
    setSplitSourceBytes(bytes);
    setSplitTotalPages(6);
    setSplitRangesInput('1-3, 4-6');
    setSplitExtractInput('1, 3, 5');
    showToast('Loaded 6-page sample PDF for splitting!');
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
          const outBytes = await singleDoc.save();
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
          setSplitError(`Please enter valid page numbers between 1 and ${splitTotalPages}.`);
          setIsSplitting(false);
          return;
        }

        const newDoc = await PDFDocument.create();
        const zeroBased = parts.map((n) => n - 1);
        const copied = await newDoc.copyPages(srcDoc, zeroBased);
        copied.forEach((p) => newDoc.addPage(p));
        const outBytes = await newDoc.save();
        outputs.push({
          name: `${baseName}_extracted_pages_${parts.join('_')}.pdf`,
          pageDesc: `Pages ${parts.join(', ')}`,
          sizeBytes: outBytes.byteLength,
          bytes: outBytes,
        });
      } else {
        // ranges mode e.g. "1-3, 4-6"
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
          const outBytes = await rangeDoc.save();

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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = file.name;
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const downloadAllSplitAsZip = async () => {
    if (splitOutputs.length === 0) return;
    const zip = new JSZip();
    splitOutputs.forEach((f) => {
      zip.file(f.name, f.bytes);
    });
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.download = `malnadu-split-pdfs-${Date.now()}.zip`;
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast('Downloaded ZIP Archive of Split PDFs!');
  };

  // =========================================================================
  // 3. PDF COMPRESSOR HANDLERS
  // =========================================================================
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
      showToast(`Loaded "${file.name}" (${formatBytes(file.size)})`);
    } catch {
      setCompPdfNotice('Invalid or password-protected PDF file.');
    }
  };

  const handleLoadSampleCompressPdf = async () => {
    setCompPdfOutBytes(null);
    setCompPdfNotice(null);
    const bytes = await createSamplePdfDocument('Unoptimized_Scanned_Certificate.pdf', 4, true);
    setCompPdfName('Unoptimized_Scanned_Certificate.pdf');
    setCompPdfOrigBytes(bytes);
    setCompPdfOrigSize(bytes.byteLength);
    setCompPdfPageCount(4);
    showToast('Loaded sample unoptimized PDF!');
  };

  const handleExecutePdfCompression = async () => {
    if (!compPdfOrigBytes) return;
    setIsCompressingPdf(true);
    setCompPdfNotice(null);

    try {
      const srcDoc = await PDFDocument.load(compPdfOrigBytes, { ignoreEncryption: true });
      // Rebuild a clean PDF document copying only active pages (strips orphan objects & bloated XMP streams)
      const cleanDoc = await PDFDocument.create();
      const pages = await cleanDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      pages.forEach((p) => cleanDoc.addPage(p));

      if (compPdfLevel === 'high' || compPdfLevel === 'medium') {
        cleanDoc.setTitle('');
        cleanDoc.setAuthor('');
        cleanDoc.setSubject('');
        cleanDoc.setKeywords([]);
        cleanDoc.setProducer('');
        cleanDoc.setCreator('');
      }

      const compressedBytes = await cleanDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: compPdfLevel === 'high' ? 100 : 50,
      });

      const finalBytes =
        compressedBytes.byteLength < compPdfOrigBytes.byteLength
          ? compressedBytes
          : compressedBytes;

      setCompPdfOutBytes(finalBytes);
      setCompPdfOutSize(finalBytes.byteLength);

      if (finalBytes.byteLength >= compPdfOrigBytes.byteLength * 0.98) {
        setCompPdfNotice(
          'Note: This PDF already uses compact object streams and contains minimal redundant metadata, so further lossless structural reduction is minimal.'
        );
      } else {
        showToast('PDF Compressed Successfully!');
      }
    } catch (err) {
      console.error('PDF Compress error:', err);
      setCompPdfNotice('Could not compress this PDF file.');
    } finally {
      setIsCompressingPdf(false);
    }
  };

  // =========================================================================
  // 4. BATCH IMAGE COMPRESSOR HANDLERS
  // =========================================================================
  const runBatchImageCompression = useCallback(
    (
      items = rawBatchImages,
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
        const results: CompressedImageItem[] = items.map((item) => {
          let targetW = item.img.width;
          let targetH = item.img.height;
          if (maxWidth > 0 && targetW > maxWidth) {
            targetH = Math.round((targetH * maxWidth) / targetW);
            targetW = maxWidth;
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d')!;
          if (format === 'image/jpeg') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, targetW, targetH);
          }
          ctx.drawImage(item.img, 0, 0, targetW, targetH);

          const q = format === 'image/png' ? undefined : quality / 100;
          const outDataUrl = canvas.toDataURL(format, q);
          const b64Len = outDataUrl.split(',')[1]?.length || 0;
          const outBytes = Math.round((b64Len * 3) / 4);
          const reductionPct =
            item.origBytes > 0
              ? Math.max(0, Math.round(((item.origBytes - outBytes) / item.origBytes) * 100))
              : 0;

          return {
            id: item.id,
            name: item.name,
            origSrc: item.src,
            origBytes: item.origBytes,
            origW: item.img.width,
            origH: item.img.height,
            outDataUrl,
            outBytes,
            outW: targetW,
            outH: targetH,
            reductionPct,
          };
        });
        setCompressedImages(results);
        setIsCompressingImgs(false);
      });
    },
    [rawBatchImages, imgCompQuality, imgCompFormat, imgCompMaxWidth]
  );

  useEffect(() => {
    runBatchImageCompression(rawBatchImages, imgCompQuality, imgCompFormat, imgCompMaxWidth);
  }, [rawBatchImages, imgCompQuality, imgCompFormat, imgCompMaxWidth, runBatchImageCompression]);

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
    showToast(`Added ${files.length} image(s) for compression!`);
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `malnadu-compressed-images-${Date.now()}.zip`;
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast('Downloaded Compressed Images ZIP!');
  };

  // =========================================================================
  // 5. SIGNATURE RESIZE & CLEAN HANDLERS
  // =========================================================================
  const renderSignatureOutput = useCallback(() => {
    const img = sigImgRef.current;
    if (!img) return;

    // Convert target dimensions to pixels (@ 300 DPI if mm/cm)
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

    // Step 1: Process source signature (crop margins + optional white background removal)
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
            d[i + 3] = 0; // Transparent background
          } else {
            d[i] = 255;
            d[i + 1] = 255;
            d[i + 2] = 255;
          }
        } else {
          // Ink pixel
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

    // Step 2: Place onto final canvas WITHOUT stretching if sigLockAspect is enabled
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

    const q = sigFormat === 'image/png' ? undefined : sigQuality / 100;
    const dataUrl = finalCanvas.toDataURL(sigFormat, q);
    setSigOutputUrl(dataUrl);
    const b64Len = dataUrl.split(',')[1]?.length || 0;
    setSigOutputBytes(Math.round((b64Len * 3) / 4));
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
    sigQuality,
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

  const akshayaToolsList = toolCatalog.filter(
    (t) => t.category === 'akshaya' && t.enabled
  );

  return (
    <div className="max-w-6xl mx-auto px-3.5 sm:px-6 py-4 sm:py-6 space-y-5">
      {/* Category 2 Header Banner & Sub-Tool Switcher */}
      <div className="bg-[#070a14] text-white rounded-3xl border border-cyan-500/30 p-4 sm:p-6 shadow-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
              CATEGORY 2 · E-GOVERNANCE & CITIZEN DOCUMENT SUITE
            </div>
            <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight mt-1">
              Akshaya Tools — PDF Merge, Split, Compress & Signature Studio
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Client-side PDF processing, batch image compression, and portal-compliant signature resizing for SSC, PSC, PAN, and Passport Seva.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2 border-t border-white/10">
          {[
            { id: 'overview', label: 'All Akshaya Tools', icon: 'fa-grip' },
            { id: 'pdf-merge', label: 'PDF Merge', icon: 'fa-file-pdf' },
            { id: 'pdf-split', label: 'PDF Split', icon: 'fa-scissors' },
            { id: 'pdf-compressor', label: 'PDF Compressor', icon: 'fa-file-zipper' },
            { id: 'image-compressor', label: 'Image Compressor', icon: 'fa-compress' },
            { id: 'signature-resize', label: 'Signature Resize', icon: 'fa-signature' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTool(tab.id as AkshayaSubToolId)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 whitespace-nowrap ${
                activeSubTool === tab.id
                  ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white'
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">PDF Merge</h2>
                <p className="text-xs text-slate-500">
                  Upload multiple PDFs, reorder them, and combine into a single PDF document.
                </p>
              </div>
              <button
                type="button"
                onClick={handleLoadSampleMergePdfs}
                className="px-3 py-1.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-bold"
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
              className="w-full min-h-[50px] py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2"
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
                No PDF files uploaded yet. Click above or click "Load Sample PDFs" to test.
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
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
              className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-[#070a14] text-cyan-300 font-bold text-xs disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-object-group"></i>
              <span>
                {isMerging ? `Merging PDFs (${mergeProgress}%)...` : `Merge ${mergeItems.length} PDFs Now`}
              </span>
            </button>
          </div>

          <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3">
              Merged Document Output
            </h3>

            {mergedPdfBytes ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
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
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2"
                  >
                    <i className="fa-solid fa-download"></i>
                    <span>Download Merged PDF</span>
                  </button>
                </div>

                {mergedPdfUrl && (
                  <iframe
                    src={mergedPdfUrl}
                    title="Merged PDF Preview"
                    className="w-full h-[360px] rounded-2xl border border-slate-200 bg-slate-50"
                  />
                )}
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                Upload at least 2 PDFs and click "Merge PDFs Now" to preview and download your merged document.
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
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">PDF Split & Extract</h2>
                <p className="text-xs text-slate-500">
                  Split by page ranges, extract selected pages, or burst into separate PDFs.
                </p>
              </div>
              <button
                type="button"
                onClick={handleLoadSampleSplitPdf}
                className="px-3 py-1.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-bold"
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
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pages to Extract
                  </label>
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
              className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-[#070a14] text-cyan-300 font-bold text-xs disabled:opacity-50 flex items-center justify-center gap-2"
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
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
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
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#070a14] text-cyan-300 text-xs font-bold shrink-0 flex items-center gap-1.5"
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
          TOOL 3: PDF COMPRESSOR
         ===================================================================== */}
      {activeSubTool === 'pdf-compressor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">PDF Compressor</h2>
                <p className="text-xs text-slate-500">
                  Optimize PDF object streams and strip bloated metadata for online portal uploads.
                </p>
              </div>
              <button
                type="button"
                onClick={handleLoadSampleCompressPdf}
                className="px-3 py-1.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-bold"
              >
                Load Sample PDF
              </button>
            </div>

            <button
              onClick={() => compPdfInputRef.current?.click()}
              className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-file-arrow-up"></i>
              <span>Upload PDF to Compress</span>
            </button>
            <input
              ref={compPdfInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleCompressPdfUpload}
              className="hidden"
            />

            {compPdfOrigBytes && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="text-xs font-extrabold text-slate-900">{compPdfName}</div>
                <div className="text-xs font-mono text-slate-600">
                  Original Size: <span className="font-bold text-slate-900">{formatBytes(compPdfOrigSize)}</span> ·{' '}
                  {compPdfPageCount} pages
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Select Compression Level
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                {[
                  { id: 'low', label: 'Low (High Quality)' },
                  { id: 'medium', label: 'Recommended' },
                  { id: 'high', label: 'Maximum Compact' },
                ].map((lvl) => (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setCompPdfLevel(lvl.id as any)}
                    className={`py-2.5 px-2 rounded-xl border transition ${
                      compPdfLevel === lvl.id
                        ? 'bg-[#070a14] text-cyan-300 border-cyan-500'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleExecutePdfCompression}
              disabled={!compPdfOrigBytes || isCompressingPdf}
              className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-[#070a14] text-cyan-300 font-bold text-xs disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-compress"></i>
              <span>{isCompressingPdf ? 'Compressing PDF...' : 'Compress PDF Now'}</span>
            </button>
          </div>

          <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3">
              Compression Result
            </h3>

            {compPdfNotice && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
                {compPdfNotice}
              </div>
            )}

            {compPdfOutBytes ? (
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <div className="text-[11px] text-slate-500 font-bold">Original</div>
                    <div className="text-sm font-extrabold font-mono text-slate-900 mt-1">
                      {formatBytes(compPdfOrigSize)}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-cyan-200">
                    <div className="text-[11px] text-cyan-700 font-bold">Compressed</div>
                    <div className="text-sm font-extrabold font-mono text-cyan-700 mt-1">
                      {formatBytes(compPdfOutSize)}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="text-[11px] text-emerald-700 font-bold">Saved</div>
                    <div className="text-sm font-extrabold font-mono text-emerald-700 mt-1">
                      {compPdfOrigSize > compPdfOutSize
                        ? `${Math.round(((compPdfOrigSize - compPdfOutSize) / compPdfOrigSize) * 100)}%`
                        : '0%'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const blob = new Blob([compPdfOutBytes as unknown as BlobPart], {
                      type: 'application/pdf',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.download = `compressed-${compPdfName || 'document.pdf'}`;
                    a.href = url;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                    showToast('Downloaded Compressed PDF!');
                  }}
                  className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-xs flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-download"></i>
                  <span>Download Compressed PDF ({formatBytes(compPdfOutSize)})</span>
                </button>
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                Upload a PDF or click "Load Sample PDF" to inspect size reduction.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 4: BATCH IMAGE COMPRESSOR
         ===================================================================== */}
      {activeSubTool === 'image-compressor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Batch Image Compressor</h2>
              <p className="text-xs text-slate-500">
                Compress one or multiple images with real-time file size & percentage reduction telemetry.
              </p>
            </div>

            <button
              onClick={() => imgCompInputRef.current?.click()}
              className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center gap-2"
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
                    <option value="image/jpeg">JPEG (Smallest)</option>
                    <option value="image/webp">WebP (Modern)</option>
                    <option value="image/png">PNG</option>
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
                    <option value={0}>Keep Original Dimensions</option>
                    <option value={1920}>Max 1920 px</option>
                    <option value={1280}>Max 1280 px</option>
                    <option value={800}>Max 800 px (Portal)</option>
                  </select>
                </div>
              </div>
            </div>

            {compressedImages.length > 1 && (
              <button
                onClick={downloadAllCompressedImagesZip}
                className="w-full min-h-[46px] py-2.5 px-4 rounded-2xl bg-[#070a14] text-cyan-300 font-bold text-xs flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-file-zipper"></i>
                <span>Download All ({compressedImages.length}) as ZIP</span>
              </button>
            )}
          </div>

          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                Compressed Batch Results ({compressedImages.length})
              </h3>
              {rawBatchImages.length > 0 && (
                <button
                  onClick={() => setRawBatchImages([])}
                  className="text-xs font-bold text-rose-600"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
              {compressedImages.map((item) => {
                const ext =
                  imgCompFormat === 'image/png'
                    ? 'png'
                    : imgCompFormat === 'image/webp'
                    ? 'webp'
                    : 'jpg';
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={item.outDataUrl}
                        alt={item.name}
                        className="w-14 h-14 object-cover rounded-xl border border-slate-300 bg-white shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-slate-900 truncate">
                          {item.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          {formatBytes(item.origBytes)} →{' '}
                          <span className="font-bold text-cyan-700">{formatBytes(item.outBytes)}</span>{' '}
                          ({item.outW}×{item.outH} px)
                        </div>
                        <div className="text-[11px] font-bold text-emerald-700">
                          Reduced by {item.reductionPct}%
                        </div>
                      </div>
                    </div>

                    <a
                      href={item.outDataUrl}
                      download={`compressed-${item.name.replace(/\.[^.]+$/, '')}.${ext}`}
                      className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#070a14] text-cyan-300 text-xs font-bold flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <i className="fa-solid fa-download"></i>
                      <span>Download</span>
                    </a>
                  </div>
                );
              })}
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
                Resize signatures without distortion, remove paper backgrounds for transparent PNG, or export portal-ready JPGs.
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
                <span>Remove White Paper Background (Transparent)</span>
                <input
                  type="checkbox"
                  checked={sigRemoveWhiteBg}
                  onChange={(e) => setSigRemoveWhiteBg(e.target.checked)}
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
                    <option value="image/png">Transparent PNG</option>
                    <option value="image/jpeg">White Background JPG</option>
                  </select>
                </div>
              </div>
            </div>

            <a
              href={sigOutputUrl}
              download={`malnadu-signature-${sigTargetW}x${sigTargetH}.${
                sigFormat === 'image/png' ? 'png' : 'jpg'
              }`}
              onClick={() => showToast('Downloaded Resized Signature!')}
              className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-[#070a14] text-cyan-300 font-bold text-xs flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-download"></i>
              <span>
                Download Signature ({sigTargetW}×{sigTargetH} {sigUnit} · {formatBytes(sigOutputBytes)})
              </span>
            </a>
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
                  Processed & Resized Signature ({sigFormat === 'image/png' && sigRemoveWhiteBg ? 'Transparent PNG' : 'Solid White Background'})
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
    </div>
  );
};
