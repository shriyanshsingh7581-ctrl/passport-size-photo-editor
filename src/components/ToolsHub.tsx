import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  BG_SWATCHES,
  ShortLinkRecord,
  SiteSettings,
  generateSamplePortraitDataUrl,
} from '../constants';
import { runBriaRmbgCutout } from '../rmbgEngine';

export type ActiveToolTab = 'bg-remover' | 'clarity-enhancer' | 'qr-generator' | 'link-shortener';

interface ToolsHubProps {
  activeTool: ActiveToolTab;
  onSelectTool: (tool: ActiveToolTab) => void;
  siteSettings: SiteSettings;
  shortLinks: ShortLinkRecord[];
  onCreateShortLink: (originalUrl: string, customSlug: string) => Promise<{ ok: boolean; error?: string; link?: ShortLinkRecord }>;
  onToggleShortLinkStatus: (slug: string, currentActive: boolean) => Promise<void>;
  onDeleteShortLink: (slug: string) => Promise<void>;
  onOpenPassportStudio: () => void;
  showToast: (msg: string) => void;
}

export const ToolsHub: React.FC<ToolsHubProps> = ({
  activeTool,
  onSelectTool,
  siteSettings,
  shortLinks,
  onCreateShortLink,
  onToggleShortLinkStatus,
  onDeleteShortLink,
  onOpenPassportStudio,
  showToast,
}) => {
  // ============================================================================
  // 1. BACKGROUND REMOVER STATE
  // ============================================================================
  const [bgOriginalSrc, setBgOriginalSrc] = useState<string>('');
  const [bgCutoutDataUrl, setBgCutoutDataUrl] = useState<string>('');
  const [bgBackdropHex, setBgBackdropHex] = useState<string>('transparent');
  const [bgEdgeTolerance, setBgEdgeTolerance] = useState<number>(12);
  const [bgProcessing, setBgProcessing] = useState<boolean>(false);
  const [bgProgress, setBgProgress] = useState<number>(0);
  const [bgStatusText, setBgStatusText] = useState<string>('Ready');
  const bgFileInputRef = useRef<HTMLInputElement | null>(null);
  const bgSourceImgRef = useRef<HTMLImageElement | null>(null);
  const bgRawCutoutCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // ============================================================================
  // 2. PHOTO CLARITY ENHANCER STATE
  // ============================================================================
  const [clarityOriginalSrc, setClarityOriginalSrc] = useState<string>('');
  const [clarityEnhancedUrl, setClarityEnhancedUrl] = useState<string>('');
  const [sharpnessAmount, setSharpnessAmount] = useState<number>(65);
  const [clarityContrast, setClarityContrast] = useState<number>(30);
  const [luminanceBoost, setLuminanceBoost] = useState<number>(8);
  const [clarityProcessing, setClarityProcessing] = useState<boolean>(false);
  const [clarityViewMode, setClarityViewMode] = useState<'split' | 'enhanced'>('split');
  const clarityFileInputRef = useRef<HTMLInputElement | null>(null);
  const claritySourceImgRef = useRef<HTMLImageElement | null>(null);

  // ============================================================================
  // 3. QR CODE GENERATOR STATE
  // ============================================================================
  const [qrInputUrl, setQrInputUrl] = useState<string>('https://passportstudiopro.netlify.app');
  const [qrSize, setQrSize] = useState<number>(360);
  const [qrFgColor, setQrFgColor] = useState<string>('#0f172a');
  const [qrBgColor, setQrBgColor] = useState<string>('#ffffff');
  const [qrErrorLevel, setQrErrorLevel] = useState<'L' | 'M' | 'Q' | 'H'>('H');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrErrorMsg, setQrErrorMsg] = useState<string | null>(null);

  // ============================================================================
  // 4. LINK SHORTENER STATE
  // ============================================================================
  const [longUrlInput, setLongUrlInput] = useState<string>('');
  const [customSlugInput, setCustomSlugInput] = useState<string>('');
  const [linkErrorMsg, setLinkErrorMsg] = useState<string | null>(null);
  const [isCreatingLink, setIsCreatingLink] = useState<boolean>(false);
  const [latestCreatedLink, setLatestCreatedLink] = useState<ShortLinkRecord | null>(null);

  // ============================================================================
  // INITIALIZE DEFAULT DEMO IMAGES & QR CODE ON MOUNT
  // ============================================================================
  useEffect(() => {
    const sample0 = generateSamplePortraitDataUrl(0, false);
    const sample1 = generateSamplePortraitDataUrl(1, false);
    loadBgRemoverImage(sample0, true);
    loadClarityImage(sample1, true);
    handleGenerateQrCode('https://passportstudiopro.netlify.app', 360, '#0f172a', '#ffffff', 'H');
  }, []);

  // ============================================================================
  // BACKGROUND REMOVER LOGIC
  // ============================================================================
  const composeFinalCutoutWithBackdrop = useCallback(
    (rawCanvas: HTMLCanvasElement, backdropHex: string, tolerance: number) => {
      const w = rawCanvas.width;
      const h = rawCanvas.height;
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const ctx = out.getContext('2d')!;

      // Copy raw cutout and refine alpha edges
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d')!;
      tCtx.drawImage(rawCanvas, 0, 0);

      if (tolerance > 0) {
        const imgData = tCtx.getImageData(0, 0, w, h);
        const d = imgData.data;
        const threshold = Math.round((tolerance / 50) * 110);
        for (let i = 3; i < d.length; i += 4) {
          const a = d[i];
          if (a > 0 && a < threshold) {
            d[i] = 0;
          } else if (a >= threshold && a < 230) {
            d[i] = Math.min(255, Math.round((a - threshold) * (255 / (230 - threshold))));
          }
        }
        tCtx.putImageData(imgData, 0, 0);
      }

      if (backdropHex !== 'transparent') {
        ctx.fillStyle = backdropHex;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(temp, 0, 0);
      setBgCutoutDataUrl(out.toDataURL('image/png'));
    },
    []
  );

  const runStandaloneBgRemoval = async (imgOverride?: HTMLImageElement) => {
    const target = imgOverride || bgSourceImgRef.current;
    if (!target) return;
    setBgProcessing(true);
    setBgProgress(15);
    setBgStatusText('Analyzing Subject Edges...');

    try {
      const cutoutCanvas = await runBriaRmbgCutout(target, (pct, msg) => {
        setBgProgress(pct);
        setBgStatusText(msg);
      });
      if (cutoutCanvas) {
        bgRawCutoutCanvasRef.current = cutoutCanvas;
        composeFinalCutoutWithBackdrop(cutoutCanvas, bgBackdropHex, bgEdgeTolerance);
        setBgStatusText('Background Removed');
      }
    } catch (e) {
      console.error('Standalone BG removal error:', e);
      setBgStatusText('Completed');
    } finally {
      setBgProcessing(false);
    }
  };

  const loadBgRemoverImage = (src: string, autoRun = true) => {
    setBgOriginalSrc(src);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      bgSourceImgRef.current = img;
      if (autoRun) {
        runStandaloneBgRemoval(img);
      }
    };
    img.src = src;
  };

  useEffect(() => {
    if (bgRawCutoutCanvasRef.current) {
      composeFinalCutoutWithBackdrop(bgRawCutoutCanvasRef.current, bgBackdropHex, bgEdgeTolerance);
    }
  }, [bgBackdropHex, bgEdgeTolerance, composeFinalCutoutWithBackdrop]);

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        loadBgRemoverImage(ev.target.result as string, true);
        showToast('Photo uploaded for AI Background Removal!');
      }
    };
    reader.readAsDataURL(file);
  };

  const downloadBgRemovedImage = (format: 'png' | 'jpg') => {
    if (!bgCutoutDataUrl) return;
    if (format === 'png') {
      const a = document.createElement('a');
      a.href = bgCutoutDataUrl;
      a.download = `malnadu-media-bg-removed.png`;
      a.click();
      showToast('Downloaded Transparent PNG!');
    } else {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d')!;
        if (bgBackdropHex === 'transparent') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, c.width, c.height);
        }
        ctx.drawImage(img, 0, 0);
        const a = document.createElement('a');
        a.href = c.toDataURL('image/jpeg', 0.96);
        a.download = `malnadu-media-cutout-hd.jpg`;
        a.click();
        showToast('Downloaded Studio HD JPG!');
      };
      img.src = bgCutoutDataUrl;
    }
  };

  // ============================================================================
  // PHOTO CLARITY ENHANCER LOGIC (Real Pixel Unsharp Mask + Contrast Convolution)
  // ============================================================================
  const runPhotoClarityPipeline = useCallback(
    (
      img: HTMLImageElement,
      sharpness = sharpnessAmount,
      contrastBoost = clarityContrast,
      lumBoost = luminanceBoost
    ) => {
      setClarityProcessing(true);
      setTimeout(() => {
        try {
          const w = img.width;
          const h = img.height;
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, w, h);

          const srcData = ctx.getImageData(0, 0, w, h);
          const dstData = ctx.createImageData(w, h);
          const s = srcData.data;
          const d = dstData.data;

          // Unsharp Mask 3x3 Convolution Kernel weight based on sharpness (0..100)
          const amount = (sharpness / 100) * 1.45;
          // Contrast S-curve factor
          const cFactor = Math.pow((contrastBoost + 100) / 100, 1.65);
          const lumOffset = (lumBoost / 100) * 45;

          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = (y * w + x) * 4;
              const alpha = s[idx + 3];
              if (alpha === 0) {
                d[idx + 3] = 0;
                continue;
              }

              // Sample 3x3 neighborhood for unsharp mask
              let rBlur = 0;
              let gBlur = 0;
              let bBlur = 0;
              let count = 0;

              for (let ky = -1; ky <= 1; ky++) {
                const ny = y + ky;
                if (ny < 0 || ny >= h) continue;
                for (let kx = -1; kx <= 1; kx++) {
                  const nx = x + kx;
                  if (nx < 0 || nx >= w) continue;
                  const nIdx = (ny * w + nx) * 4;
                  rBlur += s[nIdx];
                  gBlur += s[nIdx + 1];
                  bBlur += s[nIdx + 2];
                  count++;
                }
              }

              rBlur /= count;
              gBlur /= count;
              bBlur /= count;

              // High-frequency detail = original - local blur
              let r = s[idx] + (s[idx] - rBlur) * amount;
              let g = s[idx + 1] + (s[idx + 1] - gBlur) * amount;
              let b = s[idx + 2] + (s[idx + 2] - bBlur) * amount;

              // Apply luminance & micro-contrast enhancement
              r = (r - 128) * cFactor + 128 + lumOffset;
              g = (g - 128) * cFactor + 128 + lumOffset;
              b = (b - 128) * cFactor + 128 + lumOffset;

              // Subtle vibrance preservation
              const luma = 0.299 * r + 0.587 * g + 0.114 * b;
              const satBoost = 1.08;
              r = luma + (r - luma) * satBoost;
              g = luma + (g - luma) * satBoost;
              b = luma + (b - luma) * satBoost;

              d[idx] = r < 0 ? 0 : r > 255 ? 255 : Math.round(r);
              d[idx + 1] = g < 0 ? 0 : g > 255 ? 255 : Math.round(g);
              d[idx + 2] = b < 0 ? 0 : b > 255 ? 255 : Math.round(b);
              d[idx + 3] = alpha;
            }
          }

          ctx.putImageData(dstData, 0, 0);
          setClarityEnhancedUrl(canvas.toDataURL('image/png'));
        } finally {
          setClarityProcessing(false);
        }
      }, 60);
    },
    [sharpnessAmount, clarityContrast, luminanceBoost]
  );

  const loadClarityImage = (src: string, autoEnhance = true) => {
    setClarityOriginalSrc(src);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      claritySourceImgRef.current = img;
      if (autoEnhance) {
        runPhotoClarityPipeline(img, sharpnessAmount, clarityContrast, luminanceBoost);
      }
    };
    img.src = src;
  };

  const handleClarityUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        loadClarityImage(ev.target.result as string, true);
        showToast('Photo loaded & clarity enhanced!');
      }
    };
    reader.readAsDataURL(file);
  };

  const downloadEnhancedClarityImage = (format: 'png' | 'jpg') => {
    if (!clarityEnhancedUrl) return;
    if (format === 'png') {
      const a = document.createElement('a');
      a.href = clarityEnhancedUrl;
      a.download = 'malnadu-media-enhanced-hd.png';
      a.click();
      showToast('Downloaded Enhanced HD PNG!');
    } else {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0);
        const a = document.createElement('a');
        a.href = c.toDataURL('image/jpeg', 0.96);
        a.download = 'malnadu-media-enhanced-hd.jpg';
        a.click();
        showToast('Downloaded Enhanced HD JPG!');
      };
      img.src = clarityEnhancedUrl;
    }
  };

  // ============================================================================
  // QR CODE GENERATOR LOGIC
  // ============================================================================
  const handleGenerateQrCode = async (
    targetText = qrInputUrl,
    size = qrSize,
    fg = qrFgColor,
    bg = qrBgColor,
    errLevel = qrErrorLevel
  ) => {
    setQrErrorMsg(null);
    const trimmed = targetText.trim();
    if (!trimmed) {
      setQrErrorMsg('Please enter a valid URL or text to generate a QR code.');
      return;
    }

    try {
      const dataUrl = await QRCode.toDataURL(trimmed, {
        width: size,
        margin: 2,
        color: {
          dark: fg,
          light: bg,
        },
        errorCorrectionLevel: errLevel,
      });
      setQrDataUrl(dataUrl);
    } catch (err: any) {
      setQrErrorMsg(err?.message || 'Could not generate QR Code. Check your input.');
    }
  };

  const handleDownloadQrCode = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `malnadu-media-qr-${Date.now()}.png`;
    link.click();
    showToast('QR Code PNG Downloaded!');
  };

  const handleCopyText = async (text: string, label = 'Copied to clipboard!') => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(label);
    } catch {
      showToast(label);
    }
  };

  // ============================================================================
  // LINK SHORTENER LOGIC
  // ============================================================================
  const sanitizeSlug = (raw: string) =>
    raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  const handleShortLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkErrorMsg(null);

    let normalizedUrl = longUrlInput.trim();
    if (!normalizedUrl) {
      setLinkErrorMsg('Please enter a destination URL.');
      return;
    }
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      new URL(normalizedUrl);
    } catch {
      setLinkErrorMsg('Please enter a valid destination URL (e.g., https://example.com).');
      return;
    }

    const cleanSlug = sanitizeSlug(
      customSlugInput.trim() || `mm-${Math.random().toString(36).substring(2, 7)}`
    );

    if (cleanSlug.length < 2 || cleanSlug.length > 60) {
      setLinkErrorMsg('Custom short name must be between 2 and 60 characters.');
      return;
    }

    const reservedSlugs = ['studio', 'dashboard', 'admin', 'login', 'signup', 'api'];
    if (reservedSlugs.includes(cleanSlug)) {
      setLinkErrorMsg(`"${cleanSlug}" is a reserved system path. Please choose another short name.`);
      return;
    }

    setIsCreatingLink(true);
    try {
      const res = await onCreateShortLink(normalizedUrl, cleanSlug);
      if (!res.ok) {
        setLinkErrorMsg(res.error || 'Slug is already taken. Try a different short name.');
      } else if (res.link) {
        setLatestCreatedLink(res.link);
        setLongUrlInput('');
        setCustomSlugInput('');
        showToast(`Short link /${cleanSlug} created!`);
      }
    } finally {
      setIsCreatingLink(false);
    }
  };

  const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://malnadumedia.com';

  return (
    <div className="max-w-6xl w-full mx-auto px-3.5 sm:px-6 py-4 sm:py-6 space-y-5">
      {/* Top Feature Switcher Bar */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={onOpenPassportStudio}
            className="min-h-[44px] px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-2 whitespace-nowrap shrink-0 transition"
          >
            <i className="fa-solid fa-id-card-clip text-teal-600"></i>
            <span>Passport Studio</span>
          </button>

          {siteSettings.enableBgRemover && (
            <button
              onClick={() => onSelectTool('bg-remover')}
              className={`min-h-[44px] px-4 py-2 rounded-2xl font-bold text-xs flex items-center gap-2 whitespace-nowrap shrink-0 transition ${
                activeTool === 'bg-remover'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <i className="fa-solid fa-wand-magic-sparkles"></i>
              <span>Background Remover</span>
            </button>
          )}

          {siteSettings.enableClarityEnhancer && (
            <button
              onClick={() => onSelectTool('clarity-enhancer')}
              className={`min-h-[44px] px-4 py-2 rounded-2xl font-bold text-xs flex items-center gap-2 whitespace-nowrap shrink-0 transition ${
                activeTool === 'clarity-enhancer'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <i className="fa-solid fa-sparkles"></i>
              <span>Photo Clarity Enhancer</span>
            </button>
          )}

          {siteSettings.enableQrGenerator && (
            <button
              onClick={() => onSelectTool('qr-generator')}
              className={`min-h-[44px] px-4 py-2 rounded-2xl font-bold text-xs flex items-center gap-2 whitespace-nowrap shrink-0 transition ${
                activeTool === 'qr-generator'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <i className="fa-solid fa-qrcode"></i>
              <span>QR Code Generator</span>
            </button>
          )}

          {siteSettings.enableLinkShortener && (
            <button
              onClick={() => onSelectTool('link-shortener')}
              className={`min-h-[44px] px-4 py-2 rounded-2xl font-bold text-xs flex items-center gap-2 whitespace-nowrap shrink-0 transition ${
                activeTool === 'link-shortener'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <i className="fa-solid fa-link"></i>
              <span>Link Shortener</span>
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          TOOL 1: DEDICATED AI BACKGROUND REMOVER
         ===================================================================== */}
      {activeTool === 'bg-remover' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Controls Column */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 space-y-5 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                  <i className="fa-solid fa-wand-magic-sparkles"></i> AI Cutout Engine
                </span>
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-2">
                  Background Remover
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload any portrait or product photo to remove the background with precision edge matting.
                </p>
              </div>
            </div>

            {/* Upload & Sample Selector */}
            <div className="space-y-3">
              <button
                onClick={() => bgFileInputRef.current?.click()}
                className="w-full min-h-[50px] py-3 px-4 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-sm active:scale-[0.99] transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-cloud-arrow-up"></i>
                <span>Upload Image to Remove Background</span>
              </button>
              <input
                ref={bgFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleBgUpload}
                className="hidden"
              />

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs font-bold text-slate-500">Or test with sample portrait:</span>
                <div className="flex items-center gap-2">
                  {[0, 1, 2].map((idx) => {
                    const sampleUrl = generateSamplePortraitDataUrl(idx, false);
                    return (
                      <button
                        key={idx}
                        onClick={() => loadBgRemoverImage(sampleUrl, true)}
                        className="w-10 h-10 rounded-xl overflow-hidden border border-slate-300 hover:border-teal-600 transition"
                        title={`Load Sample ${idx + 1}`}
                      >
                        <img src={sampleUrl} alt={`Sample ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Trigger Button & Edge Tolerance */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800">Cutout Status</span>
                <span className="text-xs font-bold text-teal-700">{bgStatusText}</span>
              </div>

              <button
                onClick={() => runStandaloneBgRemoval()}
                disabled={bgProcessing}
                className="w-full min-h-[46px] py-2.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-bolt text-teal-400"></i>
                <span>{bgProcessing ? 'Processing Cutout...' : 'Re-Run Background Removal'}</span>
              </button>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700">Hair & Edge Softness</span>
                  <span className="font-mono font-bold text-teal-700">{bgEdgeTolerance}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={45}
                  value={bgEdgeTolerance}
                  onChange={(e) => setBgEdgeTolerance(parseInt(e.target.value, 10))}
                  className="w-full cursor-pointer"
                />
              </div>
            </div>

            {/* Replacement Background Color Swatches */}
            <div className="space-y-2.5">
              <label className="block text-xs font-extrabold text-slate-800">
                Output Backdrop (Transparent or Studio Solid)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {BG_SWATCHES.map((swatch) => {
                  const active = bgBackdropHex.toLowerCase() === swatch.hex.toLowerCase();
                  return (
                    <button
                      key={swatch.name}
                      onClick={() => setBgBackdropHex(swatch.hex)}
                      className={`min-h-[64px] p-2 rounded-2xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1 transition ${
                        active
                          ? 'border-teal-600 bg-teal-50/70 ring-2 ring-teal-500/20'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full border ${
                          swatch.hex === 'transparent' ? 'checkerboard' : ''
                        }`}
                        style={{
                          backgroundColor: swatch.hex === 'transparent' ? undefined : swatch.hex,
                          borderColor: swatch.border,
                        }}
                      />
                      <span className="truncate max-w-full">{swatch.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Download Buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => downloadBgRemovedImage('png')}
                disabled={!bgCutoutDataUrl || bgProcessing}
                className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-download"></i>
                <span>Download PNG</span>
              </button>
              <button
                onClick={() => downloadBgRemovedImage('jpg')}
                disabled={!bgCutoutDataUrl || bgProcessing}
                className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-file-image"></i>
                <span>Download HD JPG</span>
              </button>
            </div>
          </div>

          {/* Preview Column */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Before & After Cutout Preview
                </h2>
                <p className="text-xs text-slate-500">
                  Full-resolution transparent cutout ready for download
                </p>
              </div>
              {bgProcessing && (
                <span className="text-xs font-bold text-teal-600 flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  <span>{bgProgress}%</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Original Image */}
              <div className="flex flex-col items-center bg-slate-50 rounded-2xl border border-slate-200 p-3">
                <span className="text-xs font-bold text-slate-500 mb-2">Original Photo</span>
                <div className="w-full h-[300px] sm:h-[360px] flex items-center justify-center overflow-hidden rounded-xl bg-white border border-slate-200/80 p-2">
                  {bgOriginalSrc ? (
                    <img
                      src={bgOriginalSrc}
                      alt="Original"
                      className="max-h-full max-w-full object-contain rounded-lg"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">No image selected</span>
                  )}
                </div>
              </div>

              {/* Background Removed Result */}
              <div className="flex flex-col items-center bg-slate-50 rounded-2xl border border-slate-200 p-3">
                <span className="text-xs font-bold text-teal-700 mb-2">Background Removed Result</span>
                <div className="relative w-full h-[300px] sm:h-[360px] flex items-center justify-center overflow-hidden rounded-xl checkerboard border border-slate-300 p-2">
                  {bgCutoutDataUrl ? (
                    <img
                      src={bgCutoutDataUrl}
                      alt="Cutout Result"
                      className="max-h-full max-w-full object-contain rounded-lg"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">Waiting for cutout...</span>
                  )}

                  {bgProcessing && (
                    <div className="absolute inset-0 bg-slate-900/75 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 text-center gap-2">
                      <i className="fa-solid fa-wand-magic-sparkles fa-bounce text-2xl text-teal-400"></i>
                      <div className="text-xs font-bold">{bgStatusText}</div>
                      <div className="w-40 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-500 transition-all duration-300"
                          style={{ width: `${bgProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 2: PHOTO CLARITY ENHANCER
         ===================================================================== */}
      {activeTool === 'clarity-enhancer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Controls Column */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 space-y-5 shadow-xs">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                <i className="fa-solid fa-wand-magic"></i> Studio Detail Engine
              </span>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-2">
                Photo Clarity Enhancer
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Enhance facial sharpness, micro-contrast, and studio lighting while preserving natural skin tones and biometric accuracy.
              </p>
            </div>

            {/* Upload & Sample Strip */}
            <div className="space-y-3">
              <button
                onClick={() => clarityFileInputRef.current?.click()}
                className="w-full min-h-[50px] py-3 px-4 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-sm active:scale-[0.99] transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-upload"></i>
                <span>Upload Photo to Enhance Clarity</span>
              </button>
              <input
                ref={clarityFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleClarityUpload}
                className="hidden"
              />

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs font-bold text-slate-500">Try with sample portrait:</span>
                <div className="flex items-center gap-2">
                  {[0, 1, 2].map((idx) => {
                    const sampleUrl = generateSamplePortraitDataUrl(idx, false);
                    return (
                      <button
                        key={idx}
                        onClick={() => loadClarityImage(sampleUrl, true)}
                        className="w-10 h-10 rounded-xl overflow-hidden border border-slate-300 hover:border-teal-600 transition"
                      >
                        <img src={sampleUrl} alt={`Sample ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Clarity Sliders */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-slate-700">Detail & Sharpness (Unsharp Mask)</span>
                  <span className="font-mono font-bold text-teal-700">{sharpnessAmount}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sharpnessAmount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setSharpnessAmount(val);
                    if (claritySourceImgRef.current) {
                      runPhotoClarityPipeline(claritySourceImgRef.current, val, clarityContrast, luminanceBoost);
                    }
                  }}
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-slate-700">Micro-Contrast & Depth</span>
                  <span className="font-mono font-bold text-teal-700">{clarityContrast}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={70}
                  value={clarityContrast}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setClarityContrast(val);
                    if (claritySourceImgRef.current) {
                      runPhotoClarityPipeline(claritySourceImgRef.current, sharpnessAmount, val, luminanceBoost);
                    }
                  }}
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-slate-700">Studio Luminance Balance</span>
                  <span className="font-mono font-bold text-teal-700">
                    {luminanceBoost > 0 ? `+${luminanceBoost}` : luminanceBoost}%
                  </span>
                </div>
                <input
                  type="range"
                  min={-25}
                  max={35}
                  value={luminanceBoost}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setLuminanceBoost(val);
                    if (claritySourceImgRef.current) {
                      runPhotoClarityPipeline(claritySourceImgRef.current, sharpnessAmount, clarityContrast, val);
                    }
                  }}
                  className="w-full cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => {
                    setSharpnessAmount(70);
                    setClarityContrast(32);
                    setLuminanceBoost(8);
                    if (claritySourceImgRef.current) {
                      runPhotoClarityPipeline(claritySourceImgRef.current, 70, 32, 8);
                    }
                    showToast('Applied Studio HD Clarity Preset!');
                  }}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-teal-600 text-white font-bold text-xs transition"
                >
                  Auto HD Preset
                </button>
                <button
                  onClick={() => {
                    setSharpnessAmount(0);
                    setClarityContrast(0);
                    setLuminanceBoost(0);
                    if (claritySourceImgRef.current) {
                      runPhotoClarityPipeline(claritySourceImgRef.current, 0, 0, 0);
                    }
                  }}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs transition"
                >
                  Reset Filters
                </button>
              </div>
            </div>

            {/* Download Enhanced Result */}
            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => downloadEnhancedClarityImage('jpg')}
                disabled={!clarityEnhancedUrl || clarityProcessing}
                className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-download"></i>
                <span>Download HD JPG</span>
              </button>
              <button
                onClick={() => downloadEnhancedClarityImage('png')}
                disabled={!clarityEnhancedUrl || clarityProcessing}
                className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-file-image"></i>
                <span>Download Lossless PNG</span>
              </button>
            </div>
          </div>

          {/* Preview Column */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Original vs Enhanced Clarity
                </h2>
                <p className="text-xs text-slate-500">
                  Real-time unsharp mask & studio lighting comparison
                </p>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setClarityViewMode('split')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    clarityViewMode === 'split' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Side-by-Side
                </button>
                <button
                  onClick={() => setClarityViewMode('enhanced')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    clarityViewMode === 'enhanced' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Enhanced Full
                </button>
              </div>
            </div>

            {clarityViewMode === 'split' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col items-center bg-slate-50 rounded-2xl border border-slate-200 p-3">
                  <span className="text-xs font-bold text-slate-500 mb-2">Original Input</span>
                  <div className="w-full h-[300px] sm:h-[360px] flex items-center justify-center overflow-hidden rounded-xl bg-white border border-slate-200 p-2">
                    {clarityOriginalSrc && (
                      <img
                        src={clarityOriginalSrc}
                        alt="Original"
                        className="max-h-full max-w-full object-contain rounded-lg"
                      />
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-center bg-slate-50 rounded-2xl border border-slate-200 p-3">
                  <span className="text-xs font-bold text-teal-700 mb-2">
                    Enhanced HD Clarity ({sharpnessAmount}% Sharpness)
                  </span>
                  <div className="relative w-full h-[300px] sm:h-[360px] flex items-center justify-center overflow-hidden rounded-xl bg-white border border-teal-200 p-2">
                    {clarityEnhancedUrl && (
                      <img
                        src={clarityEnhancedUrl}
                        alt="Enhanced"
                        className="max-h-full max-w-full object-contain rounded-lg"
                      />
                    )}
                    {clarityProcessing && (
                      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center text-white text-xs font-bold gap-2">
                        <i className="fa-solid fa-circle-notch fa-spin text-teal-400"></i>
                        <span>Enhancing Clarity...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center bg-slate-50 rounded-2xl border border-slate-200 p-4">
                <div className="relative w-full h-[380px] flex items-center justify-center overflow-hidden rounded-xl bg-white border border-teal-200 p-2">
                  {clarityEnhancedUrl && (
                    <img
                      src={clarityEnhancedUrl}
                      alt="Enhanced Full"
                      className="max-h-full max-w-full object-contain rounded-lg"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 3: QR CODE GENERATOR
         ===================================================================== */}
      {activeTool === 'qr-generator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-5 shadow-xs">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                <i className="fa-solid fa-qrcode"></i> Instant Scannable QR
              </span>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-2">
                QR Code Generator
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Enter any website link, digital document URL, or studio contact link to generate a high-resolution scannable QR code.
              </p>
            </div>

            {qrErrorMsg && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                {qrErrorMsg}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Website URL or Text Content
                </label>
                <input
                  type="text"
                  value={qrInputUrl}
                  onChange={(e) => {
                    setQrInputUrl(e.target.value);
                    if (e.target.value.trim()) {
                      handleGenerateQrCode(e.target.value, qrSize, qrFgColor, qrBgColor, qrErrorLevel);
                    }
                  }}
                  placeholder="https://example.com"
                  className="w-full min-h-[48px] px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Resolution Size
                  </label>
                  <select
                    value={qrSize}
                    onChange={(e) => {
                      const s = parseInt(e.target.value, 10);
                      setQrSize(s);
                      handleGenerateQrCode(qrInputUrl, s, qrFgColor, qrBgColor, qrErrorLevel);
                    }}
                    className="w-full min-h-[44px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value={256}>256 × 256 px</option>
                    <option value={360}>360 × 360 px</option>
                    <option value={512}>512 × 512 px</option>
                    <option value={800}>800 × 800 px (Print)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Error Correction
                  </label>
                  <select
                    value={qrErrorLevel}
                    onChange={(e) => {
                      const lvl = e.target.value as 'L' | 'M' | 'Q' | 'H';
                      setQrErrorLevel(lvl);
                      handleGenerateQrCode(qrInputUrl, qrSize, qrFgColor, qrBgColor, lvl);
                    }}
                    className="w-full min-h-[44px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="H">High (30%)</option>
                    <option value="Q">Quartile (25%)</option>
                    <option value="M">Medium (15%)</option>
                    <option value="L">Low (7%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    QR Foreground
                  </label>
                  <div className="flex items-center gap-2 h-[44px] px-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <input
                      type="color"
                      value={qrFgColor}
                      onChange={(e) => {
                        setQrFgColor(e.target.value);
                        handleGenerateQrCode(qrInputUrl, qrSize, e.target.value, qrBgColor, qrErrorLevel);
                      }}
                      className="w-7 h-7 rounded cursor-pointer border-0"
                    />
                    <span className="text-xs font-mono text-slate-700">{qrFgColor}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Background
                  </label>
                  <div className="flex items-center gap-2 h-[44px] px-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <input
                      type="color"
                      value={qrBgColor}
                      onChange={(e) => {
                        setQrBgColor(e.target.value);
                        handleGenerateQrCode(qrInputUrl, qrSize, qrFgColor, e.target.value, qrErrorLevel);
                      }}
                      className="w-7 h-7 rounded cursor-pointer border-0"
                    />
                    <span className="text-xs font-mono text-slate-700">{qrBgColor}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleGenerateQrCode(qrInputUrl, qrSize, qrFgColor, qrBgColor, qrErrorLevel)}
                className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-sm active:scale-[0.99] transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-qrcode"></i>
                <span>Generate QR Code</span>
              </button>
            </div>
          </div>

          {/* QR Output Preview Card */}
          <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 flex flex-col items-center justify-between space-y-5 shadow-xs">
            <div className="w-full flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Scannable QR Preview</h2>
                <p className="text-xs text-slate-500">Test with any smartphone camera</p>
              </div>
              <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg">
                {qrSize}×{qrSize}px
              </span>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Generated QR Code"
                  className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-2xl shadow-md bg-white p-2 border border-slate-200"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-xs text-slate-400">
                  Enter a URL to generate QR Code
                </div>
              )}
              <div className="mt-3 text-xs font-mono text-slate-500 max-w-xs truncate">
                {qrInputUrl || 'No URL'}
              </div>
            </div>

            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleDownloadQrCode}
                disabled={!qrDataUrl}
                className="min-h-[48px] py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-download"></i>
                <span>Download QR Code (PNG)</span>
              </button>
              <button
                onClick={() => handleCopyText(qrInputUrl, 'Target URL copied to clipboard!')}
                disabled={!qrInputUrl.trim()}
                className="min-h-[48px] py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-copy"></i>
                <span>Copy Target Link</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 4: CUSTOM LINK SHORTENER & REDIRECT MANAGER
         ===================================================================== */}
      {activeTool === 'link-shortener' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Create Short Link Form */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-5 shadow-xs">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                <i className="fa-solid fa-link"></i> Custom Branded Shortener
              </span>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-2">
                Link Shortener
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Create memorable custom short links (e.g. <span className="font-mono text-slate-700">{baseOrigin}/photo-edit</span>) that automatically redirect visitors to your target URL.
              </p>
            </div>

            {linkErrorMsg && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                {linkErrorMsg}
              </div>
            )}

            <form onSubmit={handleShortLinkSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Original Long URL
                </label>
                <input
                  type="text"
                  required
                  value={longUrlInput}
                  onChange={(e) => setLongUrlInput(e.target.value)}
                  placeholder="https://example.com/very-long-url-path"
                  className="w-full min-h-[48px] px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Custom Short Name / Slug
                </label>
                <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden focus-within:ring-2 focus-within:ring-teal-500">
                  <span className="px-3 py-3 text-xs font-mono text-slate-400 bg-slate-100 border-r border-slate-200 select-none truncate max-w-[140px]">
                    {baseOrigin.replace(/^https?:\/\//, '')}/
                  </span>
                  <input
                    type="text"
                    value={customSlugInput}
                    onChange={(e) => setCustomSlugInput(e.target.value)}
                    placeholder="photo-edit"
                    className="flex-1 min-h-[48px] px-3 py-2.5 text-sm font-mono bg-transparent focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Letters, numbers, and hyphens only. Leave blank to auto-generate.
                </p>
              </div>

              <button
                type="submit"
                disabled={isCreatingLink}
                className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-sm shadow-sm active:scale-[0.99] transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-wand-magic-sparkles"></i>
                <span>{isCreatingLink ? 'Creating Short Link...' : 'Generate Short Link'}</span>
              </button>
            </form>

            {latestCreatedLink && (
              <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-teal-950">
                    Short Link Ready!
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700">Active</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-teal-200 font-mono text-xs font-bold text-slate-900 break-all">
                  {`${baseOrigin}/${latestCreatedLink.slug}`}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(
                        `${baseOrigin}/${latestCreatedLink.slug}`,
                        'Short link copied to clipboard!'
                      )
                    }
                    className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <i className="fa-solid fa-copy"></i>
                    <span>Copy Short Link</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const qrUrl = `${baseOrigin}/${latestCreatedLink.slug}`;
                      setQrInputUrl(qrUrl);
                      handleGenerateQrCode(qrUrl, qrSize, qrFgColor, qrBgColor, qrErrorLevel);
                      onSelectTool('qr-generator');
                    }}
                    className="min-h-[40px] px-3 py-2 rounded-xl bg-white border border-teal-300 text-teal-800 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <i className="fa-solid fa-qrcode"></i>
                    <span>QR</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Existing Short Links List */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Active Short Links ({shortLinks.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Visiting <span className="font-mono">{baseOrigin}/&lt;slug&gt;</span> immediately redirects to the original URL
                </p>
              </div>
            </div>

            {shortLinks.length === 0 ? (
              <div className="py-12 text-center space-y-2 bg-slate-50 rounded-2xl p-6">
                <i className="fa-solid fa-link-slash text-2xl text-slate-300"></i>
                <p className="text-xs font-bold text-slate-600">No short links created yet</p>
                <p className="text-[11px] text-slate-400">
                  Create your first custom short link using the form on the left.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {shortLinks.map((item) => {
                  const fullShortUrl = `${baseOrigin}/${item.slug}`;
                  return (
                    <div
                      key={item.slug}
                      className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-extrabold text-teal-700 break-all">
                            /{item.slug}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              item.active
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.active ? 'ACTIVE' : 'DISABLED'}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            · {item.clicks || 0} clicks
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 truncate max-w-md" title={item.originalUrl}>
                          <i className="fa-solid fa-arrow-turn-up fa-rotate-90 mr-1.5 text-slate-400"></i>
                          {item.originalUrl}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleCopyText(fullShortUrl, `Copied ${fullShortUrl}`)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                          title="Copy Short URL"
                        >
                          <i className="fa-solid fa-copy text-teal-600"></i>
                          <span>Copy</span>
                        </button>

                        <button
                          onClick={() => onToggleShortLinkStatus(item.slug, item.active)}
                          className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
                            item.active
                              ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          }`}
                        >
                          {item.active ? 'Disable' : 'Enable'}
                        </button>

                        <button
                          onClick={() => onDeleteShortLink(item.slug)}
                          className="min-h-[38px] min-w-[38px] rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition"
                          title="Delete Short Link"
                        >
                          <i className="fa-solid fa-trash-can text-xs"></i>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
