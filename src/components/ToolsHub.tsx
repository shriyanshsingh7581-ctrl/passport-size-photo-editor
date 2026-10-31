import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  BG_SWATCHES,
  generateSamplePortraitDataUrl,
  ShortLinkRecord,
  SiteSettings,
} from '../constants';
import {
  runHighResRmbgCutout,
  applyHairMattingAndSpillRemoval,
  HairMattingOptions,
  DEFAULT_HAIR_MATTING_OPTIONS,
} from '../rmbgEngine';
import { loadWalletCredits, deductWalletCredit } from '../creditWallet';

export type ActiveToolTab =
  | 'bg-remover'
  | 'bg-changer'
  | 'clarity-enhancer'
  | 'qr-generator'
  | 'link-shortener';

interface ToolsHubProps {
  activeTool: ActiveToolTab;
  onSelectTool: (tool: ActiveToolTab) => void;
  siteSettings: SiteSettings;
  shortLinks: ShortLinkRecord[];
  onCreateShortLink: (
    originalUrl: string,
    customSlug: string
  ) => Promise<{ ok: boolean; error?: string; link?: ShortLinkRecord }>;
  onToggleShortLinkStatus: (slug: string, currentActive: boolean) => Promise<void>;
  onDeleteShortLink: (slug: string) => Promise<void>;
  onOpenPassportStudio: () => void;
  onSendImageToStudio?: (dataUrl: string) => void;
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
  onSendImageToStudio,
  showToast,
}) => {
  // =========================================================================
  // 1. DEDICATED BACKGROUND REMOVER & CHANGER STATE
  // =========================================================================
  const [bgSourceSrc, setBgSourceSrc] = useState<string>('');
  const [bgOrigWidth, setBgOrigWidth] = useState<number>(700);
  const [bgOrigHeight, setBgOrigHeight] = useState<number>(880);
  const [bgCutoutDataUrl, setBgCutoutDataUrl] = useState<string>('');
  const [hasAppliedBgRemoval, setHasAppliedBgRemoval] = useState<boolean>(false);
  const [bgFillColor, setBgFillColor] = useState<string>('transparent');
  const [bgEdgeTolerance, setBgEdgeTolerance] = useState<number>(0);
  const [blueSpillStrength, setBlueSpillStrength] = useState<number>(80);
  const [hairDetailStrength, setHairDetailStrength] = useState<number>(70);
  const [bgRotation, setBgRotation] = useState<number>(0);
  const [bgProcessing, setBgProcessing] = useState<boolean>(false);
  const [bgProgress, setBgProgress] = useState<number>(0);
  const [bgStatusText, setBgStatusText] = useState<string>('Original Photo Loaded (Click Remove Background)');

  const bgFileInputRef = useRef<HTMLInputElement | null>(null);
  const bgRawCutoutCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgSourceImageRef = useRef<HTMLImageElement | null>(null);
  const bgOrigImgDataRef = useRef<ImageData | null>(null);
  const bgAlphaMaskRef = useRef<Uint8Array | null>(null);
  const bgSampledBackdropRef = useRef<[number, number, number]>([210, 230, 255]);

  // =========================================================================
  // 2. DEDICATED PHOTO CLARITY ENHANCER STATE
  // =========================================================================
  const [clarityOriginalSrc, setClarityOriginalSrc] = useState<string>('');
  const [clarityEnhancedUrl, setClarityEnhancedUrl] = useState<string>('');
  const [sharpnessAmount, setSharpnessAmount] = useState<number>(65);
  const [clarityContrast, setClarityContrast] = useState<number>(28);
  const [luminanceBoost, setLuminanceBoost] = useState<number>(6);
  const [clarityRotation, setClarityRotation] = useState<number>(0);
  const [clarityProcessing, setClarityProcessing] = useState<boolean>(false);
  const [clarityViewMode, setClarityViewMode] = useState<'split' | 'enhanced'>('split');

  const clarityFileInputRef = useRef<HTMLInputElement | null>(null);
  const claritySourceImgRef = useRef<HTMLImageElement | null>(null);

  // =========================================================================
  // 3. QR CODE GENERATOR STATE
  // =========================================================================
  const [qrInputUrl, setQrInputUrl] = useState<string>('https://passportstudiopro.netlify.app');
  const [qrSize, setQrSize] = useState<number>(360);
  const [qrFgColor, setQrFgColor] = useState<string>('#070a14');
  const [qrBgColor, setQrBgColor] = useState<string>('#ffffff');
  const [qrErrorLevel, setQrErrorLevel] = useState<'L' | 'M' | 'Q' | 'H'>('H');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrErrorMsg, setQrErrorMsg] = useState<string | null>(null);

  // =========================================================================
  // 4. CUSTOM LINK SHORTENER STATE
  // =========================================================================
  const [longUrlInput, setLongUrlInput] = useState<string>('');
  const [customSlugInput, setCustomSlugInput] = useState<string>('');
  const [linkErrorMsg, setLinkErrorMsg] = useState<string | null>(null);
  const [isCreatingLink, setIsCreatingLink] = useState<boolean>(false);
  const [latestCreatedLink, setLatestCreatedLink] = useState<ShortLinkRecord | null>(null);

  const baseOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'https://malnadumedia.com';

  // =========================================================================
  // BACKGROUND REMOVER LOGIC
  // =========================================================================
  // =========================================================================
  // HIGH-RESOLUTION BACKGROUND REMOVER & HAIR MATTING LOGIC
  // =========================================================================
  const compositeCutoutWithFill = useCallback(
    (
      rawCanvas: HTMLCanvasElement,
      fill: string,
      edgeShiftVal = bgEdgeTolerance,
      rotationDeg = bgRotation,
      spillVal = blueSpillStrength,
      hairVal = hairDetailStrength
    ) => {
      let sourceCanvas = rawCanvas;

      // If we have the full-resolution original ImageData & alphaMask, run hair matting & blue spill removal at native resolution
      if (bgOrigImgDataRef.current && bgAlphaMaskRef.current && hasAppliedBgRemoval) {
        const opts: HairMattingOptions = {
          edgeShift: -edgeShiftVal,
          featherRadius: 1.5,
          blueSpillRemoval: spillVal,
          hairDetailStrength: hairVal,
        };
        sourceCanvas = applyHairMattingAndSpillRemoval(
          bgOrigImgDataRef.current,
          bgAlphaMaskRef.current,
          bgSampledBackdropRef.current,
          opts
        );
        bgRawCutoutCanvasRef.current = sourceCanvas;
      }

      const srcW = sourceCanvas.width;
      const srcH = sourceCanvas.height;

      const normRot = ((rotationDeg % 360) + 360) % 360;
      const swapDims = normRot === 90 || normRot === 270;
      const outW = swapDims ? srcH : srcW;
      const outH = swapDims ? srcW : srcH;

      const out = document.createElement('canvas');
      out.width = outW;
      out.height = outH;
      const ctx = out.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (fill !== 'transparent') {
        ctx.fillStyle = fill;
        ctx.fillRect(0, 0, outW, outH);
      }

      ctx.save();
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate((rotationDeg * Math.PI) / 180);
      ctx.drawImage(sourceCanvas, -srcW / 2, -srcH / 2);
      ctx.restore();

      // Use lossless PNG so repeated slider changes never degrade quality
      setBgCutoutDataUrl(out.toDataURL('image/png'));
    },
    [bgEdgeTolerance, bgRotation, blueSpillStrength, hairDetailStrength, hasAppliedBgRemoval]
  );

  const runDedicatedBgRemoval = useCallback(
    async (
      imgOverride?: HTMLImageElement,
      fill = bgFillColor,
      tol = bgEdgeTolerance,
      rot = bgRotation
    ) => {
      const img = imgOverride || bgSourceImageRef.current;
      if (!img) return;
      const currentCredits = loadWalletCredits();
      if (currentCredits <= 0) {
        showToast('Credit Quota Exhausted (0 Credits)! Please add credits via UPI QR.');
        setBgStatusText('Credit Quota Exhausted — Please Add Credits');
        return;
      }
      setBgProcessing(true);
      setBgProgress(18);
      setBgStatusText('Running High-Res Hair Matting & Blue Spill Removal...');
      try {
        const result = await runHighResRmbgCutout(
          img,
          (pct, msg) => {
            setBgProgress(pct);
            setBgStatusText(msg);
          },
          {
            edgeShift: -tol,
            featherRadius: 1.5,
            blueSpillRemoval: blueSpillStrength,
            hairDetailStrength: hairDetailStrength,
          }
        );

        const deduction = deductWalletCredit();
        bgAlphaMaskRef.current = result.alphaMask;
        bgSampledBackdropRef.current = result.sampledBgColor;
        bgRawCutoutCanvasRef.current = result.cutoutCanvas;
        setHasAppliedBgRemoval(true);

        compositeCutoutWithFill(
          result.cutoutCanvas,
          fill,
          tol,
          rot,
          blueSpillStrength,
          hairDetailStrength
        );
        setBgStatusText(
          `High-Res Cutout Ready (${result.width}×${result.height} px · ${deduction.remaining} Credits Left)`
        );
        showToast(
          `Background Removed! (-1 Credit · ${deduction.remaining} Photos Remaining)`
        );
      } catch (err) {
        console.error('BG Remover error:', err);
        setBgStatusText('Segmentation Complete');
      } finally {
        setBgProcessing(false);
      }
    },
    [
      bgFillColor,
      bgEdgeTolerance,
      bgRotation,
      blueSpillStrength,
      hairDetailStrength,
      compositeCutoutWithFill,
      showToast,
    ]
  );

  const cancelAndRestoreOriginalBg = useCallback(() => {
    const img = bgSourceImageRef.current;
    if (!img) return;
    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;
    const origC = document.createElement('canvas');
    origC.width = origW;
    origC.height = origH;
    origC.getContext('2d')!.drawImage(img, 0, 0, origW, origH);
    bgRawCutoutCanvasRef.current = origC;
    bgAlphaMaskRef.current = null;
    setHasAppliedBgRemoval(false);
    setBgCutoutDataUrl(origC.toDataURL('image/png'));
    setBgStatusText(`Original Full-Resolution Photo (${origW}×${origH} px)`);
    showToast('Restored original photo without background removal');
  }, [showToast]);

  const loadBgSampleOrDataUrl = useCallback(
    (dataUrl: string, autoRemoveBg = false) => {
      setBgSourceSrc(dataUrl);
      setBgRotation(0);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;
        setBgOrigWidth(origW);
        setBgOrigHeight(origH);
        bgSourceImageRef.current = img;

        const origC = document.createElement('canvas');
        origC.width = origW;
        origC.height = origH;
        const oCtx = origC.getContext('2d')!;
        oCtx.drawImage(img, 0, 0, origW, origH);
        bgOrigImgDataRef.current = oCtx.getImageData(0, 0, origW, origH);
        bgRawCutoutCanvasRef.current = origC;
        bgAlphaMaskRef.current = null;

        if (autoRemoveBg) {
          runDedicatedBgRemoval(img, bgFillColor, bgEdgeTolerance, 0);
        } else {
          setHasAppliedBgRemoval(false);
          setBgCutoutDataUrl(origC.toDataURL('image/png'));
          setBgStatusText(
            `Original Loaded (${origW}×${origH} px) — Click "Remove Background" when ready`
          );
        }
      };
      img.src = dataUrl;
    },
    [bgFillColor, bgEdgeTolerance, runDedicatedBgRemoval]
  );

  const handleBgFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) {
        // IMPORTANT: Do NOT automatically remove background on upload! Preserve original resolution.
        loadBgSampleOrDataUrl(result, false);
        showToast('Original photo loaded at full resolution! Click "Remove Background" to cut out.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRotateBgCutout = (deltaDeg: number) => {
    const nextRot = (bgRotation + deltaDeg) % 360;
    setBgRotation(nextRot);
    if (bgRawCutoutCanvasRef.current) {
      compositeCutoutWithFill(
        bgRawCutoutCanvasRef.current,
        bgFillColor,
        bgEdgeTolerance,
        nextRot
      );
    }
  };

  const downloadCutoutImage = (format: 'png' | 'jpg') => {
    if (!bgRawCutoutCanvasRef.current) return;
    const raw = bgRawCutoutCanvasRef.current;
    const normRot = ((bgRotation % 360) + 360) % 360;
    const swapDims = normRot === 90 || normRot === 270;
    const outW = swapDims ? raw.height : raw.width;
    const outH = swapDims ? raw.width : raw.height;

    const c = document.createElement('canvas');
    c.width = outW;
    c.height = outH;
    const ctx = c.getContext('2d')!;

    if (format === 'jpg' && bgFillColor === 'transparent') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, outW, outH);
    } else if (bgFillColor !== 'transparent') {
      ctx.fillStyle = bgFillColor;
      ctx.fillRect(0, 0, outW, outH);
    }

    ctx.save();
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate((bgRotation * Math.PI) / 180);
    ctx.drawImage(raw, -raw.width / 2, -raw.height / 2);
    ctx.restore();

    const link = document.createElement('a');
    link.download = `malnadu-media-bg-removed.${format}`;
    link.href = c.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 0.96);
    link.click();
    showToast(`Downloaded ${format.toUpperCase()} Cutout!`);
  };

  // =========================================================================
  // PHOTO CLARITY ENHANCER LOGIC (UNSHARP MASK + MICRO-CONTRAST + LUMINANCE)
  // =========================================================================
  const runPhotoClarityPipeline = useCallback(
    (
      img: HTMLImageElement,
      sharpness = sharpnessAmount,
      contrastBoost = clarityContrast,
      lumBoost = luminanceBoost,
      rotationDeg = clarityRotation
    ) => {
      setClarityProcessing(true);
      requestAnimationFrame(() => {
        try {
          const maxDim = 1100;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, w, h);

          const srcData = ctx.getImageData(0, 0, w, h);
          const src = srcData.data;
          const outData = ctx.createImageData(w, h);
          const dst = outData.data;

          const amount = (sharpness / 100) * 1.65;
          const cFactor = Math.pow(1 + contrastBoost / 160, 2);
          const lumOffset = lumBoost * 1.4;

          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = (y * w + x) * 4;

              if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || amount <= 0.01) {
                for (let c = 0; c < 3; c++) {
                  let val = src[idx + c] + lumOffset;
                  val = (val - 128) * cFactor + 128;
                  dst[idx + c] = val < 0 ? 0 : val > 255 ? 255 : val;
                }
                dst[idx + 3] = src[idx + 3];
                continue;
              }

              const up = ((y - 1) * w + x) * 4;
              const down = ((y + 1) * w + x) * 4;
              const left = (y * w + (x - 1)) * 4;
              const right = (y * w + (x + 1)) * 4;

              for (let c = 0; c < 3; c++) {
                const center = src[idx + c];
                const neighborAvg =
                  (src[up + c] + src[down + c] + src[left + c] + src[right + c]) * 0.25;
                const highPass = center - neighborAvg;
                let sharpened = center + highPass * amount + lumOffset;
                sharpened = (sharpened - 128) * cFactor + 128;
                dst[idx + c] = sharpened < 0 ? 0 : sharpened > 255 ? 255 : sharpened;
              }
              dst[idx + 3] = src[idx + 3];
            }
          }

          ctx.putImageData(outData, 0, 0);

          const normRot = ((rotationDeg % 360) + 360) % 360;
          const swapDims = normRot === 90 || normRot === 270;
          const finalW = swapDims ? h : w;
          const finalH = swapDims ? w : h;

          const rotCanvas = document.createElement('canvas');
          rotCanvas.width = finalW;
          rotCanvas.height = finalH;
          const rCtx = rotCanvas.getContext('2d')!;
          rCtx.save();
          rCtx.translate(finalW / 2, finalH / 2);
          rCtx.rotate((rotationDeg * Math.PI) / 180);
          rCtx.drawImage(canvas, -w / 2, -h / 2);
          rCtx.restore();

          setClarityEnhancedUrl(rotCanvas.toDataURL('image/jpeg', 0.96));
        } finally {
          setClarityProcessing(false);
        }
      });
    },
    [sharpnessAmount, clarityContrast, luminanceBoost, clarityRotation]
  );

  const loadClarityImage = useCallback(
    (dataUrl: string, resetSliders = false) => {
      setClarityOriginalSrc(dataUrl);
      setClarityRotation(0);
      const sVal = resetSliders ? 65 : sharpnessAmount;
      const cVal = resetSliders ? 28 : clarityContrast;
      const lVal = resetSliders ? 6 : luminanceBoost;
      if (resetSliders) {
        setSharpnessAmount(65);
        setClarityContrast(28);
        setLuminanceBoost(6);
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        claritySourceImgRef.current = img;
        runPhotoClarityPipeline(img, sVal, cVal, lVal, 0);
      };
      img.src = dataUrl;
    },
    [sharpnessAmount, clarityContrast, luminanceBoost, runPhotoClarityPipeline]
  );

  const handleClarityUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) {
        loadClarityImage(result, false);
        showToast('Photo loaded — enhancing clarity...');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRotateClarity = (deltaDeg: number) => {
    const nextRot = (clarityRotation + deltaDeg) % 360;
    setClarityRotation(nextRot);
    if (claritySourceImgRef.current) {
      runPhotoClarityPipeline(
        claritySourceImgRef.current,
        sharpnessAmount,
        clarityContrast,
        luminanceBoost,
        nextRot
      );
    }
  };

  const downloadEnhancedClarityImage = (format: 'jpg' | 'png') => {
    if (!clarityEnhancedUrl) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      c.getContext('2d')!.drawImage(img, 0, 0);
      const a = document.createElement('a');
      a.download = `malnadu-media-clarity-hd.${format}`;
      a.href = c.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 0.97);
      a.click();
      showToast(`Downloaded Enhanced HD ${format.toUpperCase()}!`);
    };
    img.src = clarityEnhancedUrl;
  };

  // =========================================================================
  // QR CODE GENERATOR LOGIC
  // =========================================================================
  const handleGenerateQrCode = useCallback(
    async (
      targetText = qrInputUrl,
      sizePx = qrSize,
      fgHex = qrFgColor,
      bgHex = qrBgColor,
      errLvl = qrErrorLevel
    ) => {
      const cleaned = targetText.trim();
      if (!cleaned) {
        setQrErrorMsg('Please enter a valid URL or text to generate a QR code.');
        return;
      }
      setQrErrorMsg(null);
      try {
        const QRCodeMod: any = await import('qrcode');
        const toDataURL = QRCodeMod.toDataURL || QRCodeMod.default?.toDataURL;
        if (toDataURL) {
          const url = await toDataURL(cleaned, {
            width: sizePx,
            margin: 2,
            color: {
              dark: fgHex,
              light: bgHex,
            },
            errorCorrectionLevel: errLvl,
          });
          setQrDataUrl(url);
        }
      } catch (err) {
        console.error('QR generation error:', err);
        setQrErrorMsg('Unable to generate QR code. Please check your input.');
      }
    },
    [qrInputUrl, qrSize, qrFgColor, qrBgColor, qrErrorLevel]
  );

  const handleDownloadQrCode = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.download = `malnadu-media-qr-${Date.now()}.png`;
    a.href = qrDataUrl;
    a.click();
    showToast('Downloaded High-Resolution QR Code PNG!');
  };

  // =========================================================================
  // LINK SHORTENER LOGIC
  // =========================================================================
  const handleShortLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkErrorMsg(null);
    setLatestCreatedLink(null);

    let normalizedUrl = longUrlInput.trim();
    if (!normalizedUrl) {
      setLinkErrorMsg('Please enter a destination URL to shorten.');
      return;
    }
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      new URL(normalizedUrl);
    } catch {
      setLinkErrorMsg('Please enter a valid website URL (e.g. https://example.com).');
      return;
    }

    let slug = customSlugInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!slug) {
      slug = `mm-${Math.random().toString(36).substring(2, 7)}`;
    }

    const reservedSlugs = ['admin', 'dashboard', 'studio', 'tools', 'login', 'api'];
    if (reservedSlugs.includes(slug)) {
      setLinkErrorMsg(`The short name "${slug}" is reserved. Please pick another custom name.`);
      return;
    }

    setIsCreatingLink(true);
    try {
      const result = await onCreateShortLink(normalizedUrl, slug);
      if (!result.ok) {
        setLinkErrorMsg(result.error || 'Could not create short link.');
      } else if (result.link) {
        setLatestCreatedLink(result.link);
        setLongUrlInput('');
        setCustomSlugInput('');
        showToast('Custom Short Link Created!');
      }
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handleCopyText = (text: string, label = 'Copied to clipboard!') => {
    navigator.clipboard.writeText(text);
    showToast(label);
  };

  // Initialize default sample images and QR code on mount
  useEffect(() => {
    const samplePortrait = generateSamplePortraitDataUrl(0, false);
    loadBgSampleOrDataUrl(samplePortrait);
    loadClarityImage(samplePortrait, true);
    handleGenerateQrCode('https://passportstudiopro.netlify.app', 360, '#070a14', '#ffffff', 'H');
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-3.5 sm:px-6 py-4 sm:py-6 space-y-5">
      {/* Top Tool Switcher Bar — Styled with MALNADU MEDIA Butterfly-Camera Logo Theme */}
      <div className="bg-[#070a14] rounded-3xl border border-cyan-500/30 p-3 sm:p-4 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {siteSettings.enableBgRemover && (
            <button
              onClick={() => onSelectTool('bg-remover')}
              className={`min-h-[42px] px-4 py-2 rounded-2xl text-xs font-extrabold transition flex items-center gap-2 whitespace-nowrap ${
                activeTool === 'bg-remover'
                  ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white shadow-sm'
                  : 'bg-white/10 hover:bg-white/15 text-slate-300'
              }`}
            >
              <i className="fa-solid fa-wand-magic-sparkles text-cyan-300"></i>
              <span>Background Remover</span>
            </button>
          )}

          {siteSettings.enableClarityEnhancer && (
            <button
              onClick={() => onSelectTool('clarity-enhancer')}
              className={`min-h-[42px] px-4 py-2 rounded-2xl text-xs font-extrabold transition flex items-center gap-2 whitespace-nowrap ${
                activeTool === 'clarity-enhancer'
                  ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white shadow-sm'
                  : 'bg-white/10 hover:bg-white/15 text-slate-300'
              }`}
            >
              <i className="fa-solid fa-sparkles text-purple-300"></i>
              <span>Photo Clarity Enhancer</span>
            </button>
          )}

          {siteSettings.enableQrGenerator && (
            <button
              onClick={() => onSelectTool('qr-generator')}
              className={`min-h-[42px] px-4 py-2 rounded-2xl text-xs font-extrabold transition flex items-center gap-2 whitespace-nowrap ${
                activeTool === 'qr-generator'
                  ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white shadow-sm'
                  : 'bg-white/10 hover:bg-white/15 text-slate-300'
              }`}
            >
              <i className="fa-solid fa-qrcode text-cyan-300"></i>
              <span>QR Code Generator</span>
            </button>
          )}

          {siteSettings.enableLinkShortener && (
            <button
              onClick={() => onSelectTool('link-shortener')}
              className={`min-h-[42px] px-4 py-2 rounded-2xl text-xs font-extrabold transition flex items-center gap-2 whitespace-nowrap ${
                activeTool === 'link-shortener'
                  ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white shadow-sm'
                  : 'bg-white/10 hover:bg-white/15 text-slate-300'
              }`}
            >
              <i className="fa-solid fa-link text-amber-300"></i>
              <span>Link Shortener</span>
            </button>
          )}
        </div>

        <button
          onClick={onOpenPassportStudio}
          className="min-h-[42px] px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-cyan-400/30 text-cyan-300 text-xs font-bold transition flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <i className="fa-solid fa-id-card"></i>
          <span>Passport Photo Maker</span>
        </button>
      </div>

      {/* =====================================================================
          TOOL 1: DEDICATED BACKGROUND REMOVER & BACKGROUND CHANGER
         ===================================================================== */}
      {(activeTool === 'bg-remover' || activeTool === 'bg-changer') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Controls Column */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-800 bg-cyan-50 px-2.5 py-1 rounded-lg border border-cyan-200">
                <i className="fa-solid fa-bolt text-cyan-600"></i> Full-Resolution Hair Matting & Spill Removal
              </span>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-2">
                {activeTool === 'bg-changer'
                  ? 'Studio Background Changer'
                  : 'High-Res Background Remover'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload a photo to preview at original resolution ({bgOrigWidth}×{bgOrigHeight} px). Click "Remove Background" when ready, refine hair strands, and remove blue color spill.
              </p>
            </div>

            {/* Step 1: Upload Photo + Sample Portraits */}
            <div className="space-y-2.5">
              <button
                onClick={() => bgFileInputRef.current?.click()}
                className="w-full min-h-[48px] py-2.5 px-4 rounded-2xl bg-[#070a14] hover:bg-slate-800 text-cyan-300 font-bold text-xs shadow-sm transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-cloud-arrow-up"></i>
                <span>1. Upload Photo (Preserves Original Resolution)</span>
              </button>
              <input
                ref={bgFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleBgFileUpload}
                className="hidden"
              />

              {/* Step 2: Explicit Remove Background & Restore Original Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => runDedicatedBgRemoval()}
                  disabled={bgProcessing}
                  className="min-h-[46px] py-2.5 px-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-extrabold text-xs shadow-sm transition flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  <span>
                    {hasAppliedBgRemoval ? 'Re-Apply BG Removal' : '2. Remove Background'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={cancelAndRestoreOriginalBg}
                  disabled={!hasAppliedBgRemoval || bgProcessing}
                  className="min-h-[46px] py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-rotate-left"></i>
                  <span>Cancel / Original</span>
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs font-bold text-slate-500">Test samples:</span>
                <div className="flex items-center gap-2">
                  {[0, 1, 2].map((idx) => {
                    const sampleUrl = generateSamplePortraitDataUrl(idx, false);
                    return (
                      <button
                        key={idx}
                        onClick={() => loadBgSampleOrDataUrl(sampleUrl, false)}
                        className="w-10 h-10 rounded-xl overflow-hidden border border-slate-300 hover:border-cyan-500 transition"
                        title={`Sample Portrait ${idx + 1}`}
                      >
                        <img
                          src={sampleUrl}
                          alt={`Sample ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Replacement Background Color Swatches */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                  Background Color Selection
                </label>
                <span className="text-xs font-mono text-cyan-700 font-bold">
                  {bgFillColor === 'transparent' ? 'Transparent PNG' : bgFillColor}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {BG_SWATCHES.map((sw) => {
                  const active = bgFillColor === sw.color;
                  return (
                    <button
                      key={sw.color}
                      onClick={() => {
                        setBgFillColor(sw.color);
                        if (bgRawCutoutCanvasRef.current) {
                          compositeCutoutWithFill(
                            bgRawCutoutCanvasRef.current,
                            sw.color,
                            bgEdgeTolerance,
                            bgRotation,
                            blueSpillStrength,
                            hairDetailStrength
                          );
                        }
                      }}
                      className={`h-10 rounded-xl border transition flex items-center justify-center ${
                        sw.checker ? 'checkerboard' : ''
                      } ${
                        active
                          ? 'ring-2 ring-cyan-500 border-slate-900 scale-105'
                          : 'border-slate-300'
                      }`}
                      style={!sw.checker ? { backgroundColor: sw.color } : undefined}
                      title={sw.name}
                    >
                      {active && (
                        <i
                          className={`fa-solid fa-check text-xs ${
                            sw.color === '#FFFFFF' || sw.color === 'transparent'
                              ? 'text-slate-900'
                              : 'text-white'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hair Edge Matting & Blue Color Spill Removal Controls */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-slate-700">
                    Blue Color Spill Removal (Hair Decontamination)
                  </span>
                  <span className="font-mono font-bold text-cyan-700">{blueSpillStrength}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={blueSpillStrength}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setBlueSpillStrength(val);
                    if (bgRawCutoutCanvasRef.current) {
                      compositeCutoutWithFill(
                        bgRawCutoutCanvasRef.current,
                        bgFillColor,
                        bgEdgeTolerance,
                        bgRotation,
                        val,
                        hairDetailStrength
                      );
                    }
                  }}
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-slate-700">Fine Hair Strand Matting</span>
                  <span className="font-mono font-bold text-purple-700">{hairDetailStrength}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={hairDetailStrength}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setHairDetailStrength(val);
                    if (bgRawCutoutCanvasRef.current) {
                      compositeCutoutWithFill(
                        bgRawCutoutCanvasRef.current,
                        bgFillColor,
                        bgEdgeTolerance,
                        bgRotation,
                        blueSpillStrength,
                        val
                      );
                    }
                  }}
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-slate-700">Edge Cleanup / Choke</span>
                  <span className="font-mono font-bold text-cyan-700">{bgEdgeTolerance}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={45}
                  value={bgEdgeTolerance}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setBgEdgeTolerance(val);
                    if (bgRawCutoutCanvasRef.current) {
                      compositeCutoutWithFill(
                        bgRawCutoutCanvasRef.current,
                        bgFillColor,
                        val,
                        bgRotation,
                        blueSpillStrength,
                        hairDetailStrength
                      );
                    }
                  }}
                  className="w-full cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
                <span className="text-xs font-bold text-slate-700">Rotate Photo:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleRotateBgCutout(-90)}
                    className="min-h-[36px] px-3 rounded-xl bg-white border border-slate-200 hover:border-cyan-500 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition"
                  >
                    <i className="fa-solid fa-rotate-left text-cyan-600"></i>
                    <span>-90°</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRotateBgCutout(90)}
                    className="min-h-[36px] px-3 rounded-xl bg-white border border-slate-200 hover:border-cyan-500 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition"
                  >
                    <i className="fa-solid fa-rotate-right text-purple-600"></i>
                    <span>+90°</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Download & Send to Studio Buttons */}
            <div className="space-y-2.5 pt-1 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => downloadCutoutImage('png')}
                  disabled={!bgCutoutDataUrl || bgProcessing}
                  className="min-h-[46px] px-3 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-download"></i>
                  <span>Download Full-Res PNG</span>
                </button>
                <button
                  onClick={() => downloadCutoutImage('jpg')}
                  disabled={!bgCutoutDataUrl || bgProcessing}
                  className="min-h-[46px] px-3 py-2.5 rounded-2xl bg-[#070a14] hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs transition flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-file-image text-cyan-400"></i>
                  <span>Download Full-Res JPG</span>
                </button>
              </div>

              {onSendImageToStudio && (
                <button
                  type="button"
                  onClick={() => {
                    if (bgCutoutDataUrl) {
                      onSendImageToStudio(bgCutoutDataUrl);
                    }
                  }}
                  disabled={!bgCutoutDataUrl || bgProcessing}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-300 text-cyan-900 font-extrabold text-xs transition flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-id-card text-cyan-600"></i>
                  <span>Use This Photo in Passport Photo Studio →</span>
                </button>
              )}
            </div>
          </div>

          {/* Before / After Preview Column */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Live Before & After Cutout Preview
                </h2>
                <p className="text-xs text-slate-500">
                  Status: <span className="font-bold text-cyan-700">{bgStatusText}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  if (bgSourceImageRef.current) {
                    runDedicatedBgRemoval(
                      bgSourceImageRef.current,
                      bgFillColor,
                      bgEdgeTolerance,
                      bgRotation
                    );
                  }
                }}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
              >
                <i className="fa-solid fa-rotate text-cyan-600"></i>
                <span>Re-Run Cutout</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Original Image Card */}
              <div className="flex flex-col items-center bg-slate-50 rounded-2xl border border-slate-200 p-3">
                <span className="text-xs font-bold text-slate-500 mb-2">Original Photo</span>
                <div className="w-full h-[280px] sm:h-[340px] flex items-center justify-center overflow-hidden rounded-xl bg-white border border-slate-200 p-2">
                  {bgSourceSrc ? (
                    <img
                      src={bgSourceSrc}
                      alt="Original"
                      className="max-h-full max-w-full object-contain rounded-lg"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">No photo selected</span>
                  )}
                </div>
              </div>

              {/* Cutout Output Card */}
              <div className="flex flex-col items-center bg-slate-50 rounded-2xl border border-slate-200 p-3">
                <span className="text-xs font-bold text-cyan-700 mb-2">Background Removed</span>
                <div className="relative w-full h-[280px] sm:h-[340px] flex items-center justify-center overflow-hidden rounded-xl checkerboard border border-slate-200 p-2">
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
                    <div className="absolute inset-0 bg-[#070a14]/80 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 text-center gap-2">
                      <i className="fa-solid fa-wand-magic-sparkles fa-bounce text-2xl text-cyan-400"></i>
                      <div className="text-xs font-bold">{bgStatusText}</div>
                      <div className="w-40 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all duration-300"
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
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-purple-800 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                <i className="fa-solid fa-wand-magic text-purple-600"></i> Studio Detail Engine
              </span>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-2">
                Photo Clarity Enhancer
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Enhance facial sharpness, micro-contrast, rotation, and studio lighting while preserving natural skin tones.
              </p>
            </div>

            {/* Upload & Sample Strip */}
            <div className="space-y-3">
              <button
                onClick={() => clarityFileInputRef.current?.click()}
                className="w-full min-h-[50px] py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-sm shadow-sm active:scale-[0.99] transition flex items-center justify-center gap-2"
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
                        className="w-10 h-10 rounded-xl overflow-hidden border border-slate-300 hover:border-purple-500 transition"
                      >
                        <img src={sampleUrl} alt={`Sample ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Clarity Sliders & Rotate */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-slate-700">Detail & Sharpness (Unsharp Mask)</span>
                  <span className="font-mono font-bold text-cyan-700">{sharpnessAmount}%</span>
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
                      runPhotoClarityPipeline(
                        claritySourceImgRef.current,
                        val,
                        clarityContrast,
                        luminanceBoost,
                        clarityRotation
                      );
                    }
                  }}
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-slate-700">Micro-Contrast & Depth</span>
                  <span className="font-mono font-bold text-cyan-700">{clarityContrast}%</span>
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
                      runPhotoClarityPipeline(
                        claritySourceImgRef.current,
                        sharpnessAmount,
                        val,
                        luminanceBoost,
                        clarityRotation
                      );
                    }
                  }}
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-slate-700">Studio Luminance Balance</span>
                  <span className="font-mono font-bold text-cyan-700">
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
                      runPhotoClarityPipeline(
                        claritySourceImgRef.current,
                        sharpnessAmount,
                        clarityContrast,
                        val,
                        clarityRotation
                      );
                    }
                  }}
                  className="w-full cursor-pointer"
                />
              </div>

              {/* Rotate Left / Right inside Clarity Enhancer */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
                <span className="text-xs font-bold text-slate-700">Rotate Photo:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleRotateClarity(-90)}
                    className="min-h-[36px] px-3 rounded-xl bg-white border border-slate-200 hover:border-cyan-500 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition"
                  >
                    <i className="fa-solid fa-rotate-left text-cyan-600"></i>
                    <span>-90°</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRotateClarity(90)}
                    className="min-h-[36px] px-3 rounded-xl bg-white border border-slate-200 hover:border-cyan-500 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition"
                  >
                    <i className="fa-solid fa-rotate-right text-purple-600"></i>
                    <span>+90°</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => {
                    setSharpnessAmount(70);
                    setClarityContrast(32);
                    setLuminanceBoost(8);
                    if (claritySourceImgRef.current) {
                      runPhotoClarityPipeline(
                        claritySourceImgRef.current,
                        70,
                        32,
                        8,
                        clarityRotation
                      );
                    }
                    showToast('Applied Studio HD Clarity Preset!');
                  }}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-[#070a14] text-cyan-300 font-bold text-xs transition"
                >
                  Auto HD Preset
                </button>
                <button
                  onClick={() => {
                    setSharpnessAmount(0);
                    setClarityContrast(0);
                    setLuminanceBoost(0);
                    setClarityRotation(0);
                    if (claritySourceImgRef.current) {
                      runPhotoClarityPipeline(claritySourceImgRef.current, 0, 0, 0, 0);
                    }
                  }}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs transition"
                >
                  Reset Filters
                </button>
              </div>
            </div>

            {/* Download & Send to Passport Studio */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => downloadEnhancedClarityImage('jpg')}
                  disabled={!clarityEnhancedUrl || clarityProcessing}
                  className="min-h-[46px] px-3 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-download"></i>
                  <span>Download HD JPG</span>
                </button>
                <button
                  onClick={() => downloadEnhancedClarityImage('png')}
                  disabled={!clarityEnhancedUrl || clarityProcessing}
                  className="min-h-[46px] px-3 py-2.5 rounded-2xl bg-[#070a14] hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs transition flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-file-image text-cyan-400"></i>
                  <span>Download PNG</span>
                </button>
              </div>

              {onSendImageToStudio && (
                <button
                  type="button"
                  onClick={() => {
                    if (clarityEnhancedUrl) {
                      onSendImageToStudio(clarityEnhancedUrl);
                    }
                  }}
                  disabled={!clarityEnhancedUrl || clarityProcessing}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-purple-50 hover:bg-purple-100 border border-purple-300 text-purple-900 font-extrabold text-xs transition flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-id-card text-purple-600"></i>
                  <span>Use Enhanced Photo in Passport Studio →</span>
                </button>
              )}
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
                    clarityViewMode === 'split' ? 'bg-[#070a14] text-cyan-300 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Side-by-Side
                </button>
                <button
                  onClick={() => setClarityViewMode('enhanced')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    clarityViewMode === 'enhanced' ? 'bg-[#070a14] text-cyan-300 shadow-xs' : 'text-slate-600'
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
                  <span className="text-xs font-bold text-cyan-700 mb-2">
                    Enhanced HD Clarity ({sharpnessAmount}% Sharpness)
                  </span>
                  <div className="relative w-full h-[300px] sm:h-[360px] flex items-center justify-center overflow-hidden rounded-xl bg-white border border-cyan-200 p-2">
                    {clarityEnhancedUrl && (
                      <img
                        src={clarityEnhancedUrl}
                        alt="Enhanced"
                        className="max-h-full max-w-full object-contain rounded-lg"
                      />
                    )}
                    {clarityProcessing && (
                      <div className="absolute inset-0 bg-[#070a14]/70 backdrop-blur-xs flex items-center justify-center text-white text-xs font-bold gap-2">
                        <i className="fa-solid fa-circle-notch fa-spin text-cyan-400"></i>
                        <span>Enhancing Clarity...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center bg-slate-50 rounded-2xl border border-slate-200 p-4">
                <div className="relative w-full h-[380px] flex items-center justify-center overflow-hidden rounded-xl bg-white border border-cyan-200 p-2">
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
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-800 bg-cyan-50 px-2.5 py-1 rounded-lg border border-cyan-200">
                <i className="fa-solid fa-qrcode text-cyan-600"></i> Instant Scannable QR
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
                  className="w-full min-h-[48px] px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
                className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-sm shadow-sm active:scale-[0.99] transition flex items-center justify-center gap-2"
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
              <span className="text-xs font-mono font-bold text-cyan-800 bg-cyan-50 border border-cyan-200 px-2.5 py-1 rounded-lg">
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
                className="min-h-[48px] py-3 px-4 rounded-2xl bg-[#070a14] hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-download text-cyan-400"></i>
                <span>Download QR Code (PNG)</span>
              </button>
              <button
                onClick={() => handleCopyText(qrInputUrl, 'Target URL copied to clipboard!')}
                disabled={!qrInputUrl.trim()}
                className="min-h-[48px] py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-copy text-purple-600"></i>
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
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                <i className="fa-solid fa-link text-amber-600"></i> Custom Branded Shortener
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
                  className="w-full min-h-[48px] px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Custom Short Name / Slug
                </label>
                <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden focus-within:ring-2 focus-within:ring-cyan-500">
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
                className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-sm shadow-sm active:scale-[0.99] transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-wand-magic-sparkles"></i>
                <span>{isCreatingLink ? 'Creating Short Link...' : 'Generate Short Link'}</span>
              </button>
            </form>

            {latestCreatedLink && (
              <div className="p-4 rounded-2xl bg-cyan-50 border border-cyan-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-cyan-950">
                    Short Link Ready!
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700">Active</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-cyan-200 font-mono text-xs font-bold text-slate-900 break-all">
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
                    className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-[#070a14] text-cyan-300 text-xs font-bold flex items-center justify-center gap-1.5"
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
                    className="min-h-[40px] px-3 py-2 rounded-xl bg-white border border-cyan-300 text-cyan-800 text-xs font-bold flex items-center justify-center gap-1.5"
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
                      className="p-4 rounded-2xl border border-slate-200 hover:border-cyan-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-extrabold text-cyan-700 break-all">
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

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <a
                          href={item.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-cyan-50 border border-cyan-200 hover:bg-cyan-100 text-cyan-800 text-xs font-bold flex items-center gap-1.5"
                          title="Open Target URL"
                        >
                          <i className="fa-solid fa-arrow-up-right-from-square text-[11px]"></i>
                          <span>Open</span>
                        </a>

                        <button
                          onClick={() => handleCopyText(fullShortUrl, `Copied ${fullShortUrl}`)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                          title="Copy Short URL"
                        >
                          <i className="fa-solid fa-copy text-cyan-600"></i>
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
