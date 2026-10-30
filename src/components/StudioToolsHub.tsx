import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  SiteSettings,
  ShortLinkRecord,
  ToolCatalogItem,
  DEFAULT_TOOL_CATALOG,
  generateSamplePortraitDataUrl,
} from '../constants';
import { ToolsHub, ActiveToolTab } from './ToolsHub';
import { InteractivePrintSheetEditor } from './InteractivePrintSheetEditor';

export type StudioSubToolId =
  | 'overview'
  | 'landing'
  | 'passport-editor'
  | 'photo-resize'
  | 'photo-print-sheet'
  | 'print-sheet'
  | 'bg-remover'
  | 'bg-changer'
  | 'clarity-enhancer'
  | 'qr-generator'
  | 'link-shortener';

interface StudioToolsHubProps {
  initialTool?: StudioSubToolId;
  activeSubTool?: StudioSubToolId;
  onSelectSubTool?: (tool: StudioSubToolId) => void;
  siteSettings: SiteSettings;
  toolCatalog?: ToolCatalogItem[];
  shortLinks: ShortLinkRecord[];
  onCreateShortLink: (
    originalUrl: string,
    customSlug: string
  ) => Promise<{ ok: boolean; error?: string; link?: ShortLinkRecord }>;
  onToggleShortLinkStatus: (slug: string, currentActive: boolean) => Promise<void>;
  onDeleteShortLink: (slug: string) => Promise<void>;
  onOpenPassportStudio: () => void;
  onSendImageToStudio: (dataUrl: string) => void;
  currentPassportPreviewUrl?: string;
  showToast: (msg: string) => void;
}

const STUDIO_RESIZE_PRESETS = [
  { id: 'in-pass', label: 'India Passport (35×45 mm)', unit: 'mm' as const, w: 35, h: 45, dpi: 300 },
  { id: 'us-pass', label: 'US / OCI Passport (2×2 inch)', unit: 'inch' as const, w: 2, h: 2, dpi: 300 },
  { id: 'pan-psc', label: 'PAN / Kerala PSC (25×35 mm)', unit: 'mm' as const, w: 25, h: 35, dpi: 300 },
  { id: 'psc-px', label: 'PSC Portal (150×200 px)', unit: 'px' as const, w: 150, h: 200, dpi: 300 },
  { id: '4x6-print', label: '4×6" Studio Print', unit: 'inch' as const, w: 4, h: 6, dpi: 300 },
  { id: '5x7-print', label: '5×7" Portrait Frame', unit: 'inch' as const, w: 5, h: 7, dpi: 300 },
  { id: 'hd-1080', label: 'Full HD (1920×1080 px)', unit: 'px' as const, w: 1920, h: 1080, dpi: 300 },
  { id: 'sq-1080', label: 'Square Studio (1080×1080 px)', unit: 'px' as const, w: 1080, h: 1080, dpi: 300 },
];

export const StudioToolsHub: React.FC<StudioToolsHubProps> = ({
  initialTool = 'overview',
  activeSubTool: controlledSubTool,
  onSelectSubTool,
  siteSettings,
  toolCatalog,
  shortLinks,
  onCreateShortLink,
  onToggleShortLinkStatus,
  onDeleteShortLink,
  onOpenPassportStudio,
  onSendImageToStudio,
  currentPassportPreviewUrl,
  showToast,
}) => {
  const normalizeSubTool = (val?: StudioSubToolId): StudioSubToolId => {
    if (!val || val === 'landing') return 'overview';
    if (val === 'print-sheet') return 'photo-print-sheet';
    return val;
  };

  const [internalSubTool, setInternalSubTool] = useState<StudioSubToolId>(
    normalizeSubTool(controlledSubTool || initialTool)
  );

  useEffect(() => {
    if (controlledSubTool !== undefined) {
      setInternalSubTool(normalizeSubTool(controlledSubTool));
    }
  }, [controlledSubTool]);

  const setActiveSubTool = (next: StudioSubToolId) => {
    const norm = normalizeSubTool(next);
    setInternalSubTool(norm);
    if (onSelectSubTool) onSelectSubTool(norm);
  };

  const activeSubTool = internalSubTool;

  // =========================================================================
  // PHOTO RESIZE STATE
  // =========================================================================
  const [resizeSrc, setResizeSrc] = useState<string>('');
  const [resizeOrigW, setResizeOrigW] = useState<number>(700);
  const [resizeOrigH, setResizeOrigH] = useState<number>(880);
  const [resizeOrigBytes, setResizeOrigBytes] = useState<number>(0);
  const [resizeUnit, setResizeUnit] = useState<'px' | 'mm' | 'cm' | 'inch'>('mm');
  const [resizeWidthInput, setResizeWidthInput] = useState<string>('35');
  const [resizeHeightInput, setResizeHeightInput] = useState<string>('45');
  const [resizeDpi, setResizeDpi] = useState<number>(300);
  const [maintainAspect, setMaintainAspect] = useState<boolean>(false);
  const [fitMode, setFitMode] = useState<'cover' | 'contain' | 'stretch'>('cover');
  const [padColor] = useState<string>('#FFFFFF');
  const [outputFormat, setOutputFormat] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');
  const [outputQuality, setOutputQuality] = useState<number>(95);
  const [resizedDataUrl, setResizedDataUrl] = useState<string>('');
  const [resizedPxW, setResizedPxW] = useState<number>(413);
  const [resizedPxH, setResizedPxH] = useState<number>(531);
  const [resizedBytes, setResizedBytes] = useState<number>(0);
  const [resizeError, setResizeError] = useState<string | null>(null);

  const resizeFileInputRef = useRef<HTMLInputElement | null>(null);
  const resizeImgRef = useRef<HTMLImageElement | null>(null);

  const convertToPixels = useCallback(
    (val: number, unit: 'px' | 'mm' | 'cm' | 'inch', dpiVal: number) => {
      if (unit === 'px') return Math.round(val);
      if (unit === 'inch') return Math.round(val * dpiVal);
      if (unit === 'cm') return Math.round((val / 2.54) * dpiVal);
      return Math.round((val / 25.4) * dpiVal);
    },
    []
  );

  const runPhotoResizeRender = useCallback(() => {
    const img = resizeImgRef.current;
    if (!img) return;

    const rawW = parseFloat(resizeWidthInput);
    const rawH = parseFloat(resizeHeightInput);
    if (isNaN(rawW) || isNaN(rawH) || rawW <= 0 || rawH <= 0) {
      setResizeError('Please enter valid positive width and height values.');
      return;
    }
    setResizeError(null);

    const targetW = Math.max(16, Math.min(6000, convertToPixels(rawW, resizeUnit, resizeDpi)));
    const targetH = Math.max(16, Math.min(6000, convertToPixels(rawH, resizeUnit, resizeDpi)));

    setResizedPxW(targetW);
    setResizedPxH(targetH);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (outputFormat === 'image/jpeg' || fitMode === 'contain') {
      ctx.fillStyle = padColor;
      ctx.fillRect(0, 0, targetW, targetH);
    }

    if (fitMode === 'stretch') {
      ctx.drawImage(img, 0, 0, targetW, targetH);
    } else if (fitMode === 'contain') {
      const scale = Math.min(targetW / img.width, targetH / img.height);
      const dW = img.width * scale;
      const dH = img.height * scale;
      ctx.drawImage(img, (targetW - dW) / 2, (targetH - dH) / 2, dW, dH);
    } else {
      const scale = Math.max(targetW / img.width, targetH / img.height);
      const dW = img.width * scale;
      const dH = img.height * scale;
      ctx.drawImage(img, (targetW - dW) / 2, (targetH - dH) / 2, dW, dH);
    }

    const q = outputFormat === 'image/png' ? undefined : outputQuality / 100;
    const outUrl = canvas.toDataURL(outputFormat, q);
    setResizedDataUrl(outUrl);

    const base64Len = outUrl.split(',')[1]?.length || 0;
    setResizedBytes(Math.round((base64Len * 3) / 4));
  }, [
    resizeWidthInput,
    resizeHeightInput,
    resizeUnit,
    resizeDpi,
    fitMode,
    padColor,
    outputFormat,
    outputQuality,
    convertToPixels,
  ]);

  const loadResizeImageFromUrl = useCallback((dataUrl: string, byteSize = 0) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      resizeImgRef.current = img;
      setResizeSrc(dataUrl);
      setResizeOrigW(img.naturalWidth || img.width);
      setResizeOrigH(img.naturalHeight || img.height);
      if (byteSize > 0) {
        setResizeOrigBytes(byteSize);
      } else {
        const b64 = dataUrl.split(',')[1]?.length || 0;
        setResizeOrigBytes(Math.round((b64 * 3) / 4));
      }
    };
    img.src = dataUrl;
  }, []);

  useEffect(() => {
    runPhotoResizeRender();
  }, [
    resizeSrc,
    resizeWidthInput,
    resizeHeightInput,
    resizeUnit,
    resizeDpi,
    fitMode,
    padColor,
    outputFormat,
    outputQuality,
    runPhotoResizeRender,
  ]);

  useEffect(() => {
    const sample1 = generateSamplePortraitDataUrl(0, false);
    loadResizeImageFromUrl(sample1);
  }, [loadResizeImageFromUrl]);

  const handleResizeFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setResizeError('Invalid file format. Please upload a JPG, PNG, or WebP image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const res = ev.target?.result as string;
      if (res) {
        loadResizeImageFromUrl(res, file.size);
        showToast('Photo loaded into Photo Resize tool at full resolution!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleWidthChange = (valStr: string) => {
    setResizeWidthInput(valStr);
    if (maintainAspect && resizeOrigW > 0 && resizeOrigH > 0) {
      const wVal = parseFloat(valStr);
      if (!isNaN(wVal) && wVal > 0) {
        const ratio = resizeOrigH / resizeOrigW;
        const nextH =
          resizeUnit === 'px' ? Math.round(wVal * ratio) : Math.round(wVal * ratio * 100) / 100;
        setResizeHeightInput(String(nextH));
      }
    }
  };

  const handleHeightChange = (valStr: string) => {
    setResizeHeightInput(valStr);
    if (maintainAspect && resizeOrigW > 0 && resizeOrigH > 0) {
      const hVal = parseFloat(valStr);
      if (!isNaN(hVal) && hVal > 0) {
        const ratio = resizeOrigW / resizeOrigH;
        const nextW =
          resizeUnit === 'px' ? Math.round(hVal * ratio) : Math.round(hVal * ratio * 100) / 100;
        setResizeWidthInput(String(nextW));
      }
    }
  };

  const downloadResizedPhoto = () => {
    if (!resizedDataUrl) return;
    const ext =
      outputFormat === 'image/png' ? 'png' : outputFormat === 'image/webp' ? 'webp' : 'jpg';
    const a = document.createElement('a');
    a.download = `malnadu-resized-${resizedPxW}x${resizedPxH}.${ext}`;
    a.href = resizedDataUrl;
    a.click();
    showToast(`Downloaded ${resizedPxW}×${resizedPxH}px ${ext.toUpperCase()}!`);
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  };

  const resolvedCatalog =
    toolCatalog && toolCatalog.length > 0
      ? toolCatalog
      : siteSettings.toolCatalog && siteSettings.toolCatalog.length > 0
      ? siteSettings.toolCatalog
      : DEFAULT_TOOL_CATALOG;

  const studioToolsList = resolvedCatalog.filter(
    (t) => t.category === 'studio' && t.enabled
  );

  // If the user selected Background Remover, Background Changer, Clarity Enhancer, QR Generator, or Link Shortener:
  if (
    activeSubTool === 'bg-remover' ||
    activeSubTool === 'bg-changer' ||
    activeSubTool === 'clarity-enhancer' ||
    activeSubTool === 'qr-generator' ||
    activeSubTool === 'link-shortener'
  ) {
    return (
      <div className="space-y-2">
        <div className="max-w-6xl mx-auto px-3.5 sm:px-6 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#070a14] text-white px-4 py-3 rounded-2xl border border-cyan-500/30">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setActiveSubTool('overview')}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-cyan-300 text-xs font-bold flex items-center gap-1.5"
              >
                <i className="fa-solid fa-arrow-left"></i>
                <span>All Studio Tools</span>
              </button>
              <span className="text-xs font-extrabold text-slate-300 hidden sm:inline">
                Category A: Studio Tools
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={onOpenPassportStudio}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-cyan-300"
              >
                Passport Photo Maker
              </button>
              <button
                onClick={() => setActiveSubTool('photo-resize')}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white"
              >
                Photo Resize
              </button>
              <button
                onClick={() => setActiveSubTool('photo-print-sheet')}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white"
              >
                Photo Print Sheet
              </button>
            </div>
          </div>
        </div>
        <ToolsHub
          activeTool={activeSubTool as ActiveToolTab}
          onSelectTool={(t) => setActiveSubTool(t as StudioSubToolId)}
          siteSettings={siteSettings}
          shortLinks={shortLinks}
          onCreateShortLink={onCreateShortLink}
          onToggleShortLinkStatus={onToggleShortLinkStatus}
          onDeleteShortLink={onDeleteShortLink}
          onOpenPassportStudio={onOpenPassportStudio}
          onSendImageToStudio={onSendImageToStudio}
          showToast={showToast}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3.5 sm:px-6 py-4 sm:py-6 space-y-5">
      {/* Studio Tools Category Header & Tool Switcher */}
      <div className="bg-[#070a14] text-white rounded-3xl border border-cyan-500/30 p-4 sm:p-6 shadow-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-cyan-400">
              CATEGORY A · PROFESSIONAL STUDIO TOOLS
            </div>
            <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight mt-1">
              Studio Tools — Passport Maker, Hair Matting, Resize & Free-Position Print Sheets
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              High-resolution passport photo editing, non-destructive retouching, blue color spill decontamination, and object-based print sheets.
            </p>
          </div>
          <button
            onClick={onOpenPassportStudio}
            className="min-h-[42px] px-4 py-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white text-xs font-bold flex items-center gap-2 self-start md:self-auto shrink-0"
          >
            <i className="fa-solid fa-id-card"></i>
            <span>Open Passport Photo Maker</span>
          </button>
        </div>

        {/* Sub-tool Switcher Bar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2 border-t border-white/10">
          <button
            onClick={() => setActiveSubTool('overview')}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 whitespace-nowrap ${
              activeSubTool === 'overview'
                ? 'bg-white text-slate-950'
                : 'bg-white/10 hover:bg-white/15 text-slate-300'
            }`}
          >
            <i className="fa-solid fa-grip"></i>
            <span>All Studio Tools</span>
          </button>

          <button
            onClick={onOpenPassportStudio}
            className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-extrabold bg-white/10 hover:bg-white/15 text-slate-300 transition flex items-center gap-2 whitespace-nowrap"
          >
            <i className="fa-solid fa-id-card text-cyan-300"></i>
            <span>1. Passport Photo Maker</span>
          </button>

          <button
            onClick={() => setActiveSubTool('bg-remover')}
            className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-extrabold bg-white/10 hover:bg-white/15 text-slate-300 transition flex items-center gap-2 whitespace-nowrap"
          >
            <i className="fa-solid fa-wand-magic-sparkles text-cyan-300"></i>
            <span>2. Background Remover</span>
          </button>

          <button
            onClick={() => setActiveSubTool('bg-changer')}
            className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-extrabold bg-white/10 hover:bg-white/15 text-slate-300 transition flex items-center gap-2 whitespace-nowrap"
          >
            <i className="fa-solid fa-palette text-purple-300"></i>
            <span>3. Background Changer</span>
          </button>

          <button
            onClick={() => setActiveSubTool('photo-resize')}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 whitespace-nowrap ${
              activeSubTool === 'photo-resize'
                ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white'
                : 'bg-white/10 hover:bg-white/15 text-slate-300'
            }`}
          >
            <i className="fa-solid fa-maximize text-cyan-300"></i>
            <span>4. Photo Resize</span>
          </button>

          <button
            onClick={() => setActiveSubTool('photo-print-sheet')}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 whitespace-nowrap ${
              activeSubTool === 'photo-print-sheet'
                ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white'
                : 'bg-white/10 hover:bg-white/15 text-slate-300'
            }`}
          >
            <i className="fa-solid fa-table-cells text-amber-300"></i>
            <span>5. Photo Print Sheet (Free Drag & Drop)</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          VIEW 0: STUDIO TOOLS CATEGORY LANDING GRID
         ===================================================================== */}
      {activeSubTool === 'overview' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {studioToolsList.map((tool) => (
            <div
              key={tool.id}
              className="bg-white rounded-3xl border border-slate-200 hover:border-cyan-400 p-5 flex flex-col justify-between gap-4 shadow-xs transition group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-[#070a14] text-cyan-400 border border-cyan-500/30 flex items-center justify-center text-lg shadow-sm group-hover:scale-105 transition">
                    <i className={`fa-solid ${tool.icon.toLowerCase()}`}></i>
                  </div>
                  {tool.badge && (
                    <span className="text-[11px] font-bold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-lg border border-cyan-200">
                      {tool.badge}
                    </span>
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
                onClick={() => {
                  if (tool.id === 'passport-editor') {
                    onOpenPassportStudio();
                  } else {
                    setActiveSubTool(tool.id as StudioSubToolId);
                  }
                }}
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
          TOOL: PHOTO RESIZE
         ===================================================================== */}
      {activeSubTool === 'photo-resize' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Controls Column */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-700">
                STUDIO PRECISION RESIZER
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 mt-0.5">
                Photo Resize Tool
              </h2>
              <p className="text-xs text-slate-500">
                Resize portraits or landscapes in pixels, millimeters, centimeters, or inches with DPI and format control.
              </p>
            </div>

            {resizeError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                {resizeError}
              </div>
            )}

            <div className="space-y-2.5">
              <button
                onClick={() => resizeFileInputRef.current?.click()}
                className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-upload"></i>
                <span>Upload Image (JPG, PNG, WebP)</span>
              </button>
              <input
                ref={resizeFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleResizeFileUpload}
                className="hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Quick Studio & Passport Presets
              </label>
              <select
                onChange={(e) => {
                  const preset = STUDIO_RESIZE_PRESETS.find((p) => p.id === e.target.value);
                  if (preset) {
                    setResizeUnit(preset.unit);
                    setResizeWidthInput(String(preset.w));
                    setResizeHeightInput(String(preset.h));
                    setResizeDpi(preset.dpi);
                  }
                }}
                className="w-full min-h-[44px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-2xl"
              >
                {STUDIO_RESIZE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-700">Target Dimensions</span>
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-[11px] font-bold">
                  {(['px', 'mm', 'cm', 'inch'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setResizeUnit(u)}
                      className={`px-2.5 py-1 rounded-lg uppercase transition ${
                        resizeUnit === u
                          ? 'bg-[#070a14] text-cyan-300'
                          : 'text-slate-600'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Width ({resizeUnit})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={resizeWidthInput}
                    onChange={(e) => handleWidthChange(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-1.5 text-sm font-mono font-bold bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Height ({resizeUnit})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={resizeHeightInput}
                    onChange={(e) => handleHeightChange(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-1.5 text-sm font-mono font-bold bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Print DPI
                  </label>
                  <select
                    value={resizeDpi}
                    onChange={(e) => setResizeDpi(parseInt(e.target.value, 10))}
                    className="w-full min-h-[42px] px-2 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl"
                  >
                    <option value={72}>72 DPI</option>
                    <option value={150}>150 DPI</option>
                    <option value={300}>300 DPI</option>
                    <option value={600}>600 DPI</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center justify-between pt-1 cursor-pointer text-xs font-bold text-slate-700">
                <span>Lock Aspect Ratio (Preserve Proportions)</span>
                <input
                  type="checkbox"
                  checked={maintainAspect}
                  onChange={(e) => setMaintainAspect(e.target.checked)}
                  className="w-4 h-4 accent-cyan-600 rounded"
                />
              </label>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Scaling Mode
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
                  {[
                    { id: 'cover', label: 'Smart Fill' },
                    { id: 'contain', label: 'Fit Inside' },
                    { id: 'stretch', label: 'Exact Stretch' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setFitMode(m.id as any)}
                      className={`py-2 rounded-xl border transition ${
                        fitMode === m.id
                          ? 'bg-[#070a14] text-cyan-300 border-cyan-500'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Output Format
                  </label>
                  <select
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value as any)}
                    className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl"
                  >
                    <option value="image/jpeg">JPG / JPEG</option>
                    <option value="image/png">PNG (Lossless)</option>
                    <option value="image/webp">WebP (Modern)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Quality ({outputQuality}%)
                  </label>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    disabled={outputFormat === 'image/png'}
                    value={outputQuality}
                    onChange={(e) => setOutputQuality(parseInt(e.target.value, 10))}
                    className="w-full mt-2.5 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={downloadResizedPhoto}
                className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-[#070a14] hover:bg-slate-800 text-cyan-300 font-bold text-xs shadow-sm transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-download"></i>
                <span>
                  Download Resized Image ({resizedPxW}×{resizedPxH} px · {formatBytes(resizedBytes)})
                </span>
              </button>
              <button
                onClick={() => resizedDataUrl && onSendImageToStudio(resizedDataUrl)}
                className="w-full min-h-[42px] py-2 px-4 rounded-2xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-900 font-bold text-xs transition"
              >
                Send Resized Image to Passport Studio →
              </button>
            </div>
          </div>

          {/* Preview Column */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Original vs Resized Preview
                </h3>
                <p className="text-xs text-slate-500">
                  Original: {resizeOrigW}×{resizeOrigH} px ({formatBytes(resizeOrigBytes)}) → Output:{' '}
                  <span className="font-mono font-bold text-cyan-700">
                    {resizedPxW}×{resizedPxH} px @ {resizeDpi} DPI ({formatBytes(resizedBytes)})
                  </span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3 flex flex-col items-center">
                <span className="text-xs font-bold text-slate-500 mb-2">
                  Original ({resizeOrigW}×{resizeOrigH} px)
                </span>
                <div className="w-full h-[300px] flex items-center justify-center bg-white rounded-xl border border-slate-200 p-2 overflow-hidden">
                  {resizeSrc && (
                    <img
                      src={resizeSrc}
                      alt="Original"
                      className="max-h-full max-w-full object-contain"
                    />
                  )}
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3 flex flex-col items-center">
                <span className="text-xs font-bold text-cyan-700 mb-2">
                  Resized Output ({resizedPxW}×{resizedPxH} px)
                </span>
                <div className="w-full h-[300px] flex items-center justify-center checkerboard rounded-xl border border-cyan-200 p-2 overflow-hidden">
                  {resizedDataUrl && (
                    <img
                      src={resizedDataUrl}
                      alt="Resized"
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
          TOOL: INTERACTIVE OBJECT-BASED PHOTO PRINT SHEET EDITOR
         ===================================================================== */}
      {activeSubTool === 'photo-print-sheet' && (
        <InteractivePrintSheetEditor
          initialPassportPhotoUrl={currentPassportPreviewUrl}
          initialPhotoWidthMm={35}
          initialPhotoHeightMm={45}
          initialPhotoCount={6}
          showToast={showToast}
        />
      )}
    </div>
  );
};
