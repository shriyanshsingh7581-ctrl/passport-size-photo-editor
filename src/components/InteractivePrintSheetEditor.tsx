import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { COUNTRY_PRESETS, generateSamplePortraitDataUrl } from '../constants';

export interface SheetPhotoObject {
  id: string;
  name: string;
  src: string;
  imgElement: HTMLImageElement;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotation: number;
  aspectLocked: boolean;
  zIndex: number;
  locked: boolean;
}

interface SerializedState {
  objects: Array<Omit<SheetPhotoObject, 'imgElement'>>;
}

export interface PaperSizeSpec {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  defaultOrientation: 'portrait' | 'landscape';
}

export const SHEET_PAPER_SIZES: PaperSizeSpec[] = [
  {
    id: '6x4',
    name: '6 × 4 inches (Studio 4R Landscape)',
    widthMm: 152.4,
    heightMm: 101.6,
    defaultOrientation: 'landscape',
  },
  {
    id: '4x6',
    name: '4 × 6 inches (Studio 4R Portrait)',
    widthMm: 101.6,
    heightMm: 152.4,
    defaultOrientation: 'portrait',
  },
  {
    id: '5x7',
    name: '5 × 7 inches (Studio 5R)',
    widthMm: 127.0,
    heightMm: 177.8,
    defaultOrientation: 'portrait',
  },
  {
    id: 'a4',
    name: 'A4 Sheet (210 × 297 mm)',
    widthMm: 210.0,
    heightMm: 297.0,
    defaultOrientation: 'portrait',
  },
  {
    id: 'a5',
    name: 'A5 Sheet (148 × 210 mm)',
    widthMm: 148.0,
    heightMm: 210.0,
    defaultOrientation: 'portrait',
  },
  {
    id: 'custom',
    name: 'Custom Paper Size',
    widthMm: 152.4,
    heightMm: 101.6,
    defaultOrientation: 'landscape',
  },
];

interface InteractivePrintSheetEditorProps {
  /** Optional current processed passport photo from Passport Studio */
  initialPassportPhotoUrl?: string;
  initialPhotoWidthMm?: number;
  initialPhotoHeightMm?: number;
  initialPhotoCount?: number;
  showToast: (msg: string) => void;
}

export const InteractivePrintSheetEditor: React.FC<InteractivePrintSheetEditorProps> = ({
  initialPassportPhotoUrl,
  initialPhotoWidthMm = 35,
  initialPhotoHeightMm = 45,
  initialPhotoCount = 6,
  showToast,
}) => {
  // Paper & Print Settings
  const [paperSizeId, setPaperSizeId] = useState<string>('6x4');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [customPaperUnit, setCustomPaperUnit] = useState<'inch' | 'mm' | 'cm' | 'px'>('inch');
  const [customPaperWInput, setCustomPaperWInput] = useState<string>('6');
  const [customPaperHInput, setCustomPaperHInput] = useState<string>('4');

  const [dpi, setDpi] = useState<number>(300);
  const [marginMm, setMarginMm] = useState<number>(5);
  const [gapXMm, setGapXMm] = useState<number>(3);
  const [gapYMm, setGapYMm] = useState<number>(3);
  const [defaultPhotoWidthMm, setDefaultPhotoWidthMm] = useState<number>(initialPhotoWidthMm);
  const [defaultPhotoHeightMm, setDefaultPhotoHeightMm] = useState<number>(initialPhotoHeightMm);
  const [defaultPhotoQty, setDefaultPhotoQty] = useState<number>(initialPhotoCount);
  const [sheetBgColor, setSheetBgColor] = useState<string>('#FFFFFF');
  const [showCutMarks, setShowCutMarks] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [snapToGuides, setSnapToGuides] = useState<boolean>(true);
  const [coordUnit, setCoordUnit] = useState<'mm' | 'px'>('mm');
  const [layoutMode, setLayoutMode] = useState<'auto' | 'manual'>('auto');
  const [viewportZoom, setViewportZoom] = useState<number>(100);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Objects & Selection State
  const [photoObjects, setPhotoObjects] = useState<SheetPhotoObject[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Active alignment guide lines in mm
  const [activeGuides, setActiveGuides] = useState<{
    verticalMm: number[];
    horizontalMm: number[];
  }>({ verticalMm: [], horizontalMm: [] });

  // Undo / Redo History
  const [history, setHistory] = useState<Array<Array<Omit<SheetPhotoObject, 'imgElement'>>>>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Drag / Resize / Rotate Interaction State
  const interactionRef = useRef<{
    mode: 'none' | 'move' | 'resize-br' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'rotate';
    targetId: string | null;
    startMouseMmX: number;
    startMouseMmY: number;
    initialObjects: Map<
      string,
      { xMm: number; yMm: number; widthMm: number; heightMm: number; rotation: number }
    >;
  }>({
    mode: 'none',
    targetId: null,
    startMouseMmX: 0,
    startMouseMmY: 0,
    initialObjects: new Map(),
  });

  // Compute physical sheet dimensions in mm
  const getPhysicalSheetDimensionsMm = useCallback(() => {
    let baseW = 152.4;
    let baseH = 101.6;

    if (paperSizeId === 'custom') {
      const rawW = parseFloat(customPaperWInput) || 6;
      const rawH = parseFloat(customPaperHInput) || 4;
      if (customPaperUnit === 'inch') {
        baseW = rawW * 25.4;
        baseH = rawH * 25.4;
      } else if (customPaperUnit === 'cm') {
        baseW = rawW * 10;
        baseH = rawH * 10;
      } else if (customPaperUnit === 'px') {
        baseW = (rawW / dpi) * 25.4;
        baseH = (rawH / dpi) * 25.4;
      } else {
        baseW = rawW;
        baseH = rawH;
      }
    } else {
      const found = SHEET_PAPER_SIZES.find((p) => p.id === paperSizeId) || SHEET_PAPER_SIZES[0];
      baseW = found.widthMm;
      baseH = found.heightMm;
    }

    const minDim = Math.min(baseW, baseH);
    const maxDim = Math.max(baseW, baseH);

    if (orientation === 'landscape') {
      return { sheetWMm: maxDim, sheetHMm: minDim };
    }
    return { sheetWMm: minDim, sheetHMm: maxDim };
  }, [paperSizeId, orientation, customPaperUnit, customPaperWInput, customPaperHInput, dpi]);

  const { sheetWMm, sheetHMm } = getPhysicalSheetDimensionsMm();

  const mmToExportPx = useCallback(
    (mm: number) => Math.round((mm / 25.4) * dpi),
    [dpi]
  );
  const exportPxToMm = useCallback(
    (px: number) => (px / dpi) * 25.4,
    [dpi]
  );

  // Push snapshot to Undo/Redo history
  const pushHistorySnapshot = useCallback((objs: SheetPhotoObject[]) => {
    const serialized = objs.map(({ imgElement, ...rest }) => ({ ...rest }));
    setHistory((prev) => {
      const sliced = prev.slice(0, historyIdx + 1);
      const next = [...sliced, serialized].slice(-30);
      setHistoryIdx(next.length - 1);
      return next;
    });
  }, [historyIdx]);

  // Automatic Grid Arrangement calculator
  const computeAutoArrangedObjects = useCallback(
    (
      objs: SheetPhotoObject[],
      targetSheetWMm = sheetWMm,
      targetSheetHMm = sheetHMm,
      mMm = marginMm,
      gxMm = gapXMm,
      gyMm = gapYMm
    ): SheetPhotoObject[] => {
      if (objs.length === 0) return [];
      const sorted = [...objs].sort((a, b) => a.zIndex - b.zIndex);

      const sampleW = sorted[0]?.widthMm || defaultPhotoWidthMm;
      const availW = Math.max(sampleW, targetSheetWMm - mMm * 2);
      const cols = Math.max(1, Math.floor((availW + gxMm) / (sampleW + gxMm)));

      return sorted.map((obj, idx) => {
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        const remainingInRow = Math.min(cols, sorted.length - r * cols);
        const rowTotalW = remainingInRow * obj.widthMm + Math.max(0, remainingInRow - 1) * gxMm;
        const startX = Math.max(mMm, (targetSheetWMm - rowTotalW) / 2);

        const nextX = Math.round((startX + c * (obj.widthMm + gxMm)) * 100) / 100;
        const nextY = Math.round((mMm + r * (obj.heightMm + gyMm)) * 100) / 100;

        return {
          ...obj,
          xMm: Math.min(Math.max(0, nextX), Math.max(0, targetSheetWMm - obj.widthMm)),
          yMm: Math.min(Math.max(0, nextY), Math.max(0, targetSheetHMm - obj.heightMm)),
          rotation: 0,
        };
      });
    },
    [sheetWMm, sheetHMm, marginMm, gapXMm, gapYMm, defaultPhotoWidthMm]
  );

  // Add one or more copies of an image to the sheet
  const addImageCopiesToSheet = useCallback(
    (
      dataUrl: string,
      name: string,
      copiesCount: number,
      wMm = defaultPhotoWidthMm,
      hMm = defaultPhotoHeightMm,
      replaceExisting = false
    ) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCacheRef.current.set(dataUrl, img);
        setPhotoObjects((prev) => {
          const baseList = replaceExisting ? [] : [...prev];
          const maxZ = baseList.reduce((acc, item) => Math.max(acc, item.zIndex), 0);

          const newItems: SheetPhotoObject[] = [];
          for (let i = 0; i < copiesCount; i++) {
            newItems.push({
              id: `photo-obj-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
              name: copiesCount > 1 ? `${name} (#${baseList.length + i + 1})` : name,
              src: dataUrl,
              imgElement: img,
              xMm: marginMm,
              yMm: marginMm,
              widthMm: wMm,
              heightMm: hMm,
              rotation: 0,
              aspectLocked: true,
              zIndex: maxZ + i + 1,
              locked: false,
            });
          }

          const combined = [...baseList, ...newItems];
          const arranged = computeAutoArrangedObjects(combined);
          if (arranged.length > 0) {
            setSelectedIds([arranged[0].id]);
          }
          pushHistorySnapshot(arranged);
          return arranged;
        });
      };
      img.src = dataUrl;
    },
    [
      defaultPhotoWidthMm,
      defaultPhotoHeightMm,
      marginMm,
      computeAutoArrangedObjects,
      pushHistorySnapshot,
    ]
  );

  // Initialize sheet with either the active Passport Studio photo or default sample
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const initialSrc = initialPassportPhotoUrl || generateSamplePortraitDataUrl(0, false);
    addImageCopiesToSheet(
      initialSrc,
      'Passport Photo',
      initialPhotoCount,
      initialPhotoWidthMm,
      initialPhotoHeightMm,
      true
    );
  }, [
    initialPassportPhotoUrl,
    initialPhotoCount,
    initialPhotoWidthMm,
    initialPhotoHeightMm,
    addImageCopiesToSheet,
  ]);

  // Handle orientation change without losing manual photo positions
  const handleOrientationChange = (nextOrientation: 'landscape' | 'portrait') => {
    if (nextOrientation === orientation) return;
    setOrientation(nextOrientation);

    const nextWMm = nextOrientation === 'landscape' ? Math.max(sheetWMm, sheetHMm) : Math.min(sheetWMm, sheetHMm);
    const nextHMm = nextOrientation === 'landscape' ? Math.min(sheetWMm, sheetHMm) : Math.max(sheetWMm, sheetHMm);

    setPhotoObjects((prev) => {
      if (layoutMode === 'auto') {
        const reArranged = computeAutoArrangedObjects(prev, nextWMm, nextHMm);
        pushHistorySnapshot(reArranged);
        return reArranged;
      }
      // In Manual mode, preserve positions and clamp safely inside new orientation bounds
      const clamped = prev.map((obj) => ({
        ...obj,
        xMm: Math.max(0, Math.min(obj.xMm, Math.max(0, nextWMm - obj.widthMm))),
        yMm: Math.max(0, Math.min(obj.yMm, Math.max(0, nextHMm - obj.heightMm))),
      }));
      pushHistorySnapshot(clamped);
      return clamped;
    });
    showToast(`Switched sheet to ${nextOrientation.toUpperCase()} (photos preserved)`);
  };

  // Handle paper size change while preserving existing photographs
  const handlePaperSizeChange = (nextPaperId: string) => {
    setPaperSizeId(nextPaperId);
    const found = SHEET_PAPER_SIZES.find((p) => p.id === nextPaperId);
    const nextOrient = found ? found.defaultOrientation : orientation;
    setOrientation(nextOrient);

    if (found && nextPaperId !== 'custom') {
      const nextW = nextOrient === 'landscape' ? Math.max(found.widthMm, found.heightMm) : Math.min(found.widthMm, found.heightMm);
      const nextH = nextOrient === 'landscape' ? Math.min(found.widthMm, found.heightMm) : Math.max(found.widthMm, found.heightMm);

      setPhotoObjects((prev) => {
        if (layoutMode === 'auto') {
          const arranged = computeAutoArrangedObjects(prev, nextW, nextH);
          pushHistorySnapshot(arranged);
          return arranged;
        }
        const clamped = prev.map((obj) => ({
          ...obj,
          xMm: Math.max(0, Math.min(obj.xMm, Math.max(0, nextW - obj.widthMm))),
          yMm: Math.max(0, Math.min(obj.yMm, Math.max(0, nextH - obj.heightMm))),
        }));
        pushHistorySnapshot(clamped);
        return clamped;
      });
    }
  };

  // Trigger Auto Arrangement explicitly
  const handleAutoArrangeLayout = () => {
    setLayoutMode('auto');
    setPhotoObjects((prev) => {
      const arranged = computeAutoArrangedObjects(prev);
      pushHistorySnapshot(arranged);
      return arranged;
    });
    showToast('Photos automatically arranged on sheet!');
  };

  // Undo & Redo handlers
  const handleUndo = () => {
    if (historyIdx <= 0) return;
    const prevIdx = historyIdx - 1;
    const snapshot = history[prevIdx];
    if (!snapshot) return;
    setHistoryIdx(prevIdx);
    setPhotoObjects((current) =>
      snapshot
        .map((item) => {
          const cachedImg =
            imageCacheRef.current.get(item.src) ||
            current.find((c) => c.id === item.id)?.imgElement;
          if (!cachedImg) return null;
          return { ...item, imgElement: cachedImg };
        })
        .filter(Boolean) as SheetPhotoObject[]
    );
  };

  const handleRedo = () => {
    if (historyIdx >= history.length - 1) return;
    const nextIdx = historyIdx + 1;
    const snapshot = history[nextIdx];
    if (!snapshot) return;
    setHistoryIdx(nextIdx);
    setPhotoObjects((current) =>
      snapshot
        .map((item) => {
          const cachedImg =
            imageCacheRef.current.get(item.src) ||
            current.find((c) => c.id === item.id)?.imgElement;
          if (!cachedImg) return null;
          return { ...item, imgElement: cachedImg };
        })
        .filter(Boolean) as SheetPhotoObject[]
    );
  };

  // Upload new photo(s) from device
  const handleFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file, idx) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl) {
          addImageCopiesToSheet(
            dataUrl,
            file.name.replace(/\.[^.]+$/, ''),
            files.length === 1 ? defaultPhotoQty : 1,
            defaultPhotoWidthMm,
            defaultPhotoHeightMm,
            false
          );
        }
      };
      reader.readAsDataURL(file);
    });
    showToast(`Added ${files.length} photo(s) to Print Sheet!`);
    e.target.value = '';
  };

  // Primary selected photo object
  const selectedPhoto =
    photoObjects.find((o) => o.id === selectedIds[0]) || null;

  // Update properties of selected photo(s)
  const updateSelectedPhotoProps = (
    updater: (obj: SheetPhotoObject) => SheetPhotoObject,
    recordHistory = true
  ) => {
    if (selectedIds.length === 0) return;
    setLayoutMode('manual');
    setPhotoObjects((prev) => {
      const next = prev.map((obj) => (selectedIds.includes(obj.id) ? updater(obj) : obj));
      if (recordHistory) pushHistorySnapshot(next);
      return next;
    });
  };

  // Quick Corner Placement Helper (Top-Left, Top-Right, Bottom-Left, Bottom-Right, Center)
  const moveSelectedToPresetPosition = (
    pos: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
  ) => {
    if (!selectedPhoto || selectedPhoto.locked) {
      if (selectedPhoto?.locked) showToast('Photo position is locked. Unlock it first.');
      return;
    }
    const pad = marginMm;
    let targetX = selectedPhoto.xMm;
    let targetY = selectedPhoto.yMm;

    if (pos === 'top-left') {
      targetX = pad;
      targetY = pad;
    } else if (pos === 'top-right') {
      targetX = Math.max(0, sheetWMm - selectedPhoto.widthMm - pad);
      targetY = pad;
    } else if (pos === 'bottom-left') {
      targetX = pad;
      targetY = Math.max(0, sheetHMm - selectedPhoto.heightMm - pad);
    } else if (pos === 'bottom-right') {
      targetX = Math.max(0, sheetWMm - selectedPhoto.widthMm - pad);
      targetY = Math.max(0, sheetHMm - selectedPhoto.heightMm - pad);
    } else if (pos === 'center') {
      targetX = Math.max(0, (sheetWMm - selectedPhoto.widthMm) / 2);
      targetY = Math.max(0, (sheetHMm - selectedPhoto.heightMm) / 2);
    }

    updateSelectedPhotoProps((obj) => ({
      ...obj,
      xMm: Math.round(targetX * 100) / 100,
      yMm: Math.round(targetY * 100) / 100,
    }));
    showToast(`Moved ${selectedPhoto.name} to ${pos.replace('-', ' ')}`);
  };

  // Duplicate, Delete, Layer Order, Lock/Unlock
  const handleDuplicateSelected = () => {
    if (selectedIds.length === 0) return;
    setLayoutMode('manual');
    setPhotoObjects((prev) => {
      const maxZ = prev.reduce((acc, o) => Math.max(acc, o.zIndex), 0);
      const clones: SheetPhotoObject[] = [];
      selectedIds.forEach((id, idx) => {
        const orig = prev.find((o) => o.id === id);
        if (orig) {
          clones.push({
            ...orig,
            id: `photo-obj-${Date.now()}-dup-${idx}`,
            name: `${orig.name} (Copy)`,
            xMm: Math.min(sheetWMm - orig.widthMm, orig.xMm + 6),
            yMm: Math.min(sheetHMm - orig.heightMm, orig.yMm + 6),
            zIndex: maxZ + idx + 1,
            locked: false,
          });
        }
      });
      const next = [...prev, ...clones];
      setSelectedIds(clones.map((c) => c.id));
      pushHistorySnapshot(next);
      return next;
    });
    showToast('Duplicated selected photo');
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    setPhotoObjects((prev) => {
      const next = prev.filter((o) => !selectedIds.includes(o.id));
      pushHistorySnapshot(next);
      return next;
    });
    setSelectedIds([]);
    showToast('Deleted selected photo from sheet');
  };

  const handleBringForward = () => {
    if (!selectedPhoto) return;
    setPhotoObjects((prev) => {
      const maxZ = prev.reduce((acc, o) => Math.max(acc, o.zIndex), 0);
      const next = prev.map((o) =>
        o.id === selectedPhoto.id ? { ...o, zIndex: maxZ + 1 } : o
      );
      pushHistorySnapshot(next);
      return next;
    });
  };

  const handleSendBackward = () => {
    if (!selectedPhoto) return;
    setPhotoObjects((prev) => {
      const minZ = prev.reduce((acc, o) => Math.min(acc, o.zIndex), 9999);
      const next = prev.map((o) =>
        o.id === selectedPhoto.id ? { ...o, zIndex: Math.max(1, minZ - 1) } : o
      );
      pushHistorySnapshot(next);
      return next;
    });
  };

  // =========================================================================
  // RENDER SHEET (SHARED FOR DISPLAY PREVIEW & HIGH-RES PRINT EXPORT)
  // =========================================================================
  const renderSheetToTargetCanvas = useCallback(
    (
      canvas: HTMLCanvasElement,
      targetPxPerMm: number,
      isInteractiveDisplay: boolean
    ) => {
      const canvasW = Math.max(100, Math.round(sheetWMm * targetPxPerMm));
      const canvasH = Math.max(100, Math.round(sheetHMm * targetPxPerMm));
      canvas.width = canvasW;
      canvas.height = canvasH;

      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // 1. Fill Paper Background
      ctx.fillStyle = sheetBgColor || '#FFFFFF';
      ctx.fillRect(0, 0, canvasW, canvasH);

      // 2. Optional Grid & Margin Guides (only on interactive display canvas)
      if (isInteractiveDisplay && showGrid) {
        ctx.save();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.lineWidth = 1;
        const stepMm = 10; // 10mm (1cm) grid
        for (let xMm = stepMm; xMm < sheetWMm; xMm += stepMm) {
          const xPx = Math.round(xMm * targetPxPerMm);
          ctx.beginPath();
          ctx.moveTo(xPx, 0);
          ctx.lineTo(xPx, canvasH);
          ctx.stroke();
        }
        for (let yMm = stepMm; yMm < sheetHMm; yMm += stepMm) {
          const yPx = Math.round(yMm * targetPxPerMm);
          ctx.beginPath();
          ctx.moveTo(0, yPx);
          ctx.lineTo(canvasW, yPx);
          ctx.stroke();
        }

        // Safe Margin Box
        if (marginMm > 0) {
          const mPx = marginMm * targetPxPerMm;
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.38)';
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(mPx, mPx, canvasW - mPx * 2, canvasH - mPx * 2);
        }
        ctx.restore();
      }

      // 3. Draw every Photo Object sorted by zIndex
      const sorted = [...photoObjects].sort((a, b) => a.zIndex - b.zIndex);

      sorted.forEach((obj, index) => {
        const xPx = obj.xMm * targetPxPerMm;
        const yPx = obj.yMm * targetPxPerMm;
        const wPx = obj.widthMm * targetPxPerMm;
        const hPx = obj.heightMm * targetPxPerMm;
        const cx = xPx + wPx / 2;
        const cy = yPx + hPx / 2;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((obj.rotation * Math.PI) / 180);

        // Draw photo using full-resolution source image
        ctx.beginPath();
        ctx.rect(-wPx / 2, -hPx / 2, wPx, hPx);
        ctx.clip();

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-wPx / 2, -hPx / 2, wPx, hPx);

        const img = obj.imgElement;
        if (img && img.width > 0 && img.height > 0) {
          const scale = Math.max(wPx / img.width, hPx / img.height);
          const dW = img.width * scale;
          const dH = img.height * scale;
          ctx.drawImage(img, -dW / 2, -dH / 2, dW, dH);
        }
        ctx.restore();

        // Cut Marks border
        if (showCutMarks) {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate((obj.rotation * Math.PI) / 180);
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = Math.max(1, targetPxPerMm * 0.18);
          ctx.strokeRect(-wPx / 2, -hPx / 2, wPx, hPx);
          ctx.restore();
        }

        // Interactive Selection Border, Handles & Badge (only on display canvas)
        if (isInteractiveDisplay) {
          const isSelected = selectedIds.includes(obj.id);
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate((obj.rotation * Math.PI) / 180);

          // Small Photo Number Badge in top-left corner of photo
          ctx.fillStyle = isSelected ? '#06b6d4' : 'rgba(7, 10, 20, 0.72)';
          ctx.beginPath();
          ctx.roundRect(-wPx / 2 + 4, -hPx / 2 + 4, 24, 18, 5);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`#${index + 1}`, -wPx / 2 + 16, -hPx / 2 + 13);

          if (obj.locked) {
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.roundRect(wPx / 2 - 22, -hPx / 2 + 4, 18, 18, 5);
            ctx.fill();
            ctx.fillStyle = '#070a14';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText('L', wPx / 2 - 13, -hPx / 2 + 13);
          }

          if (isSelected) {
            ctx.strokeStyle = obj.locked ? '#f59e0b' : '#06b6d4';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(-wPx / 2, -hPx / 2, wPx, hPx);

            if (!obj.locked) {
              // 4 Corner Resize Handles
              const handleR = 6;
              const corners = [
                [-wPx / 2, -hPx / 2],
                [wPx / 2, -hPx / 2],
                [-wPx / 2, hPx / 2],
                [wPx / 2, hPx / 2],
              ];
              corners.forEach(([hx, hy]) => {
                ctx.fillStyle = '#FFFFFF';
                ctx.strokeStyle = '#06b6d4';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(hx, hy, handleR, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
              });

              // Top Rotation Handle Stem & Knob
              ctx.beginPath();
              ctx.moveTo(0, -hPx / 2);
              ctx.lineTo(0, -hPx / 2 - 18);
              ctx.strokeStyle = '#a855f7';
              ctx.lineWidth = 2;
              ctx.stroke();

              ctx.fillStyle = '#a855f7';
              ctx.strokeStyle = '#FFFFFF';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(0, -hPx / 2 - 18, 6.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
          }
          ctx.restore();
        }
      });

      // 4. Draw Active Snap / Alignment Guides
      if (isInteractiveDisplay) {
        ctx.save();
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        activeGuides.verticalMm.forEach((xMm) => {
          const xPx = xMm * targetPxPerMm;
          ctx.beginPath();
          ctx.moveTo(xPx, 0);
          ctx.lineTo(xPx, canvasH);
          ctx.stroke();
        });
        activeGuides.horizontalMm.forEach((yMm) => {
          const yPx = yMm * targetPxPerMm;
          ctx.beginPath();
          ctx.moveTo(0, yPx);
          ctx.lineTo(canvasW, yPx);
          ctx.stroke();
        });
        ctx.restore();
      }
    },
    [
      sheetWMm,
      sheetHMm,
      sheetBgColor,
      showGrid,
      marginMm,
      photoObjects,
      showCutMarks,
      selectedIds,
      activeGuides,
    ]
  );

  // Display scale (pixels per millimeter on interactive screen canvas)
  const displayPxPerMm = 4.2 * (viewportZoom / 100);

  useEffect(() => {
    if (displayCanvasRef.current) {
      renderSheetToTargetCanvas(displayCanvasRef.current, displayPxPerMm, true);
    }
  }, [renderSheetToTargetCanvas, displayPxPerMm]);

  // =========================================================================
  // POINTER / TOUCH HIT-TESTING & DRAG / RESIZE / ROTATE HANDLERS
  // =========================================================================
  const getPointerSheetMm = (clientX: number, clientY: number) => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return { xMm: 0, yMm: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = sheetWMm / Math.max(1, rect.width);
    const scaleY = sheetHMm / Math.max(1, rect.height);
    return {
      xMm: (clientX - rect.left) * scaleX,
      yMm: (clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (clientX: number, clientY: number, shiftKey = false) => {
    const { xMm, yMm } = getPointerSheetMm(clientX, clientY);
    const handleHitRadiusMm = 3.2;

    // 1. If a single unlocked photo is already selected, check its Rotation & Corner Resize handles first
    if (selectedPhoto && !selectedPhoto.locked) {
      const cx = selectedPhoto.xMm + selectedPhoto.widthMm / 2;
      const cy = selectedPhoto.yMm + selectedPhoto.heightMm / 2;
      const rad = (-selectedPhoto.rotation * Math.PI) / 180;
      const dx = xMm - cx;
      const dy = yMm - cy;
      // Rotate pointer into object's local unrotated space
      const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
      const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

      const hw = selectedPhoto.widthMm / 2;
      const hh = selectedPhoto.heightMm / 2;

      // Top rotation handle is at (0, -hh - 18 / displayPxPerMm)
      const rotHandleOffsetMm = 18 / displayPxPerMm;
      if (
        Math.hypot(localX - 0, localY - (-hh - rotHandleOffsetMm)) <=
        handleHitRadiusMm * 1.2
      ) {
        interactionRef.current = {
          mode: 'rotate',
          targetId: selectedPhoto.id,
          startMouseMmX: xMm,
          startMouseMmY: yMm,
          initialObjects: new Map([
            [
              selectedPhoto.id,
              {
                xMm: selectedPhoto.xMm,
                yMm: selectedPhoto.yMm,
                widthMm: selectedPhoto.widthMm,
                heightMm: selectedPhoto.heightMm,
                rotation: selectedPhoto.rotation,
              },
            ],
          ]),
        };
        return;
      }

      // Bottom-Right resize handle
      if (Math.hypot(localX - hw, localY - hh) <= handleHitRadiusMm) {
        interactionRef.current = {
          mode: 'resize-br',
          targetId: selectedPhoto.id,
          startMouseMmX: xMm,
          startMouseMmY: yMm,
          initialObjects: new Map([
            [
              selectedPhoto.id,
              {
                xMm: selectedPhoto.xMm,
                yMm: selectedPhoto.yMm,
                widthMm: selectedPhoto.widthMm,
                heightMm: selectedPhoto.heightMm,
                rotation: selectedPhoto.rotation,
              },
            ],
          ]),
        };
        return;
      }

      // Top-Left resize handle
      if (Math.hypot(localX - -hw, localY - -hh) <= handleHitRadiusMm) {
        interactionRef.current = {
          mode: 'resize-tl',
          targetId: selectedPhoto.id,
          startMouseMmX: xMm,
          startMouseMmY: yMm,
          initialObjects: new Map([
            [
              selectedPhoto.id,
              {
                xMm: selectedPhoto.xMm,
                yMm: selectedPhoto.yMm,
                widthMm: selectedPhoto.widthMm,
                heightMm: selectedPhoto.heightMm,
                rotation: selectedPhoto.rotation,
              },
            ],
          ]),
        };
        return;
      }
    }

    // 2. Hit-test photo bodies from top-most zIndex to bottom-most
    const topDown = [...photoObjects].sort((a, b) => b.zIndex - a.zIndex);
    const hitObj = topDown.find((obj) => {
      const cx = obj.xMm + obj.widthMm / 2;
      const cy = obj.yMm + obj.heightMm / 2;
      const rad = (-obj.rotation * Math.PI) / 180;
      const dx = xMm - cx;
      const dy = yMm - cy;
      const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
      const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
      return (
        Math.abs(localX) <= obj.widthMm / 2 && Math.abs(localY) <= obj.heightMm / 2
      );
    });

    if (!hitObj) {
      setSelectedIds([]);
      interactionRef.current.mode = 'none';
      return;
    }

    let nextSelectedIds = selectedIds;
    if (shiftKey) {
      nextSelectedIds = selectedIds.includes(hitObj.id)
        ? selectedIds.filter((id) => id !== hitObj.id)
        : [...selectedIds, hitObj.id];
      setSelectedIds(nextSelectedIds);
    } else if (!selectedIds.includes(hitObj.id)) {
      nextSelectedIds = [hitObj.id];
      setSelectedIds(nextSelectedIds);
    }

    if (hitObj.locked) {
      interactionRef.current.mode = 'none';
      return;
    }

    // Prepare move interaction for selected unlocked objects
    const initMap = new Map<
      string,
      { xMm: number; yMm: number; widthMm: number; heightMm: number; rotation: number }
    >();
    photoObjects.forEach((o) => {
      if (nextSelectedIds.includes(o.id) && !o.locked) {
        initMap.set(o.id, {
          xMm: o.xMm,
          yMm: o.yMm,
          widthMm: o.widthMm,
          heightMm: o.heightMm,
          rotation: o.rotation,
        });
      }
    });

    interactionRef.current = {
      mode: 'move',
      targetId: hitObj.id,
      startMouseMmX: xMm,
      startMouseMmY: yMm,
      initialObjects: initMap,
    };
  };

  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      const inter = interactionRef.current;
      if (inter.mode === 'none' || !inter.targetId) return;

      const { xMm, yMm } = getPointerSheetMm(clientX, clientY);
      const dxMm = xMm - inter.startMouseMmX;
      const dyMm = yMm - inter.startMouseMmY;

      setLayoutMode('manual');

      if (inter.mode === 'move') {
        const snapThresholdMm = 1.6;
        const vGuides: number[] = [];
        const hGuides: number[] = [];

        setPhotoObjects((prev) =>
          prev.map((obj) => {
            const init = inter.initialObjects.get(obj.id);
            if (!init) return obj;

            let nextX = Math.max(0, Math.min(sheetWMm - obj.widthMm, init.xMm + dxMm));
            let nextY = Math.max(0, Math.min(sheetHMm - obj.heightMm, init.yMm + dyMm));

            // Smart Snapping to Margins, Sheet Center, and Other Photos
            if (snapToGuides && inter.initialObjects.size === 1) {
              const candidateVerticals = [
                marginMm,
                sheetWMm - marginMm - obj.widthMm,
                (sheetWMm - obj.widthMm) / 2,
              ];
              const candidateHorizontals = [
                marginMm,
                sheetHMm - marginMm - obj.heightMm,
                (sheetHMm - obj.heightMm) / 2,
              ];

              prev.forEach((other) => {
                if (other.id === obj.id) return;
                candidateVerticals.push(other.xMm, other.xMm + other.widthMm + gapXMm, other.xMm - obj.widthMm - gapXMm);
                candidateHorizontals.push(other.yMm, other.yMm + other.heightMm + gapYMm, other.yMm - obj.heightMm - gapYMm);
              });

              for (const snapX of candidateVerticals) {
                if (Math.abs(nextX - snapX) <= snapThresholdMm) {
                  nextX = snapX;
                  vGuides.push(snapX);
                  break;
                }
              }
              for (const snapY of candidateHorizontals) {
                if (Math.abs(nextY - snapY) <= snapThresholdMm) {
                  nextY = snapY;
                  hGuides.push(snapY);
                  break;
                }
              }
            }

            return {
              ...obj,
              xMm: Math.round(nextX * 100) / 100,
              yMm: Math.round(nextY * 100) / 100,
            };
          })
        );
        setActiveGuides({ verticalMm: vGuides, horizontalMm: hGuides });
      } else if (inter.mode === 'resize-br' || inter.mode === 'resize-tl') {
        const init = inter.initialObjects.get(inter.targetId);
        if (!init) return;
        const aspect = init.widthMm / Math.max(1, init.heightMm);

        setPhotoObjects((prev) =>
          prev.map((obj) => {
            if (obj.id !== inter.targetId) return obj;
            let nextW =
              inter.mode === 'resize-br'
                ? Math.max(12, Math.min(sheetWMm, init.widthMm + dxMm))
                : Math.max(12, Math.min(sheetWMm, init.widthMm - dxMm));
            let nextH = obj.aspectLocked
              ? nextW / aspect
              : inter.mode === 'resize-br'
              ? Math.max(12, Math.min(sheetHMm, init.heightMm + dyMm))
              : Math.max(12, Math.min(sheetHMm, init.heightMm - dyMm));

            const nextX =
              inter.mode === 'resize-tl'
                ? init.xMm + (init.widthMm - nextW)
                : init.xMm;
            const nextY =
              inter.mode === 'resize-tl'
                ? init.yMm + (init.heightMm - nextH)
                : init.yMm;

            return {
              ...obj,
              xMm: Math.round(nextX * 100) / 100,
              yMm: Math.round(nextY * 100) / 100,
              widthMm: Math.round(nextW * 100) / 100,
              heightMm: Math.round(nextH * 100) / 100,
            };
          })
        );
      } else if (inter.mode === 'rotate') {
        const init = inter.initialObjects.get(inter.targetId);
        if (!init) return;
        const cx = init.xMm + init.widthMm / 2;
        const cy = init.yMm + init.heightMm / 2;
        const angleRad = Math.atan2(yMm - cy, xMm - cx);
        let deg = Math.round(((angleRad * 180) / Math.PI + 90) * 10) / 10;
        if (deg > 180) deg -= 360;
        if (deg < -180) deg += 360;
        // Snap near 0, 90, -90, 180
        for (const snapAngle of [0, 90, -90, 180, -180]) {
          if (Math.abs(deg - snapAngle) <= 4) {
            deg = snapAngle;
            break;
          }
        }
        setPhotoObjects((prev) =>
          prev.map((obj) => (obj.id === inter.targetId ? { ...obj, rotation: deg } : obj))
        );
      }
    },
    [sheetWMm, sheetHMm, snapToGuides, marginMm, gapXMm, gapYMm]
  );

  const handlePointerUp = useCallback(() => {
    if (interactionRef.current.mode !== 'none') {
      interactionRef.current.mode = 'none';
      setActiveGuides({ verticalMm: [], horizontalMm: [] });
      pushHistorySnapshot(photoObjects);
    }
  }, [photoObjects, pushHistorySnapshot]);

  useEffect(() => {
    const onWinMouseMove = (e: MouseEvent) => {
      if (interactionRef.current.mode !== 'none') {
        handlePointerMove(e.clientX, e.clientY);
      }
    };
    const onWinMouseUp = () => handlePointerUp();
    window.addEventListener('mousemove', onWinMouseMove);
    window.addEventListener('mouseup', onWinMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWinMouseMove);
      window.removeEventListener('mouseup', onWinMouseUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  // =========================================================================
  // HIGH-RESOLUTION PRINT-READY EXPORT (PNG, JPG, PDF AT SELECTED DPI)
  // =========================================================================
  const exportHighResRasterSheet = (format: 'png' | 'jpg') => {
    const exportCanvas = document.createElement('canvas');
    const targetPxPerMm = dpi / 25.4;
    renderSheetToTargetCanvas(exportCanvas, targetPxPerMm, false);

    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    const dataUrl = exportCanvas.toDataURL(mime, format === 'jpg' ? 0.98 : undefined);
    const a = document.createElement('a');
    a.download = `malnadu-sheet-${paperSizeId}-${orientation}-${exportCanvas.width}x${exportCanvas.height}px-${dpi}dpi.${format}`;
    a.href = dataUrl;
    a.click();
    showToast(
      `Exported ${exportCanvas.width}×${exportCanvas.height} px (${dpi} DPI) ${format.toUpperCase()} Print Sheet!`
    );
  };

  const exportHighResPdfSheet = async () => {
    setIsExportingPdf(true);
    try {
      const exportCanvas = document.createElement('canvas');
      const targetPxPerMm = dpi / 25.4;
      renderSheetToTargetCanvas(exportCanvas, targetPxPerMm, false);

      const pngDataUrl = exportCanvas.toDataURL('image/png');
      // 1 inch = 72 PDF points = 25.4 mm
      const pageWPoints = (sheetWMm / 25.4) * 72;
      const pageHPoints = (sheetHMm / 25.4) * 72;

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([pageWPoints, pageHPoints]);
      const pngEmbed = await pdfDoc.embedPng(pngDataUrl);
      page.drawImage(pngEmbed, {
        x: 0,
        y: 0,
        width: pageWPoints,
        height: pageHPoints,
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = `malnadu-print-sheet-${paperSizeId}-${orientation}-${dpi}dpi.pdf`;
      a.href = url;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      showToast(
        `Exported Print-Ready PDF (${Math.round(sheetWMm)}×${Math.round(sheetHMm)} mm @ ${dpi} DPI)!`
      );
    } catch (err) {
      console.error('PDF export error:', err);
      showToast('Failed to generate PDF print sheet.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const exportWpx = mmToExportPx(sheetWMm);
  const exportHpx = mmToExportPx(sheetHMm);

  return (
    <div className="space-y-4">
      {/* Top Status & Mode Bar */}
      <div className="bg-[#070a14] text-white rounded-3xl border border-cyan-500/30 p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white shrink-0">
            <i className="fa-solid fa-up-down-left-right"></i>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-extrabold">
                Interactive Print Sheet Canvas Editor
              </h3>
              <span
                className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase ${
                  layoutMode === 'manual'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                }`}
              >
                {layoutMode === 'manual' ? 'Manual Free Positioning' : 'Automatic Grid Layout'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Click or tap any photograph on the sheet to drag, move to corners, resize, rotate, or lock independently.
            </p>
          </div>
        </div>

        {/* Layout Mode Switcher & Re-Arrange Action */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-white/10 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={handleAutoArrangeLayout}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                layoutMode === 'auto'
                  ? 'bg-cyan-500 text-slate-950 font-extrabold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-table-cells"></i>
              <span>Auto Layout</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('manual')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                layoutMode === 'manual'
                  ? 'bg-amber-400 text-slate-950 font-extrabold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-hand-pointer"></i>
              <span>Manual Free Move</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleAutoArrangeLayout}
            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-cyan-300 text-xs font-bold flex items-center gap-1.5"
            title="Re-arrange all photos neatly on the sheet"
          >
            <i className="fa-solid fa-arrows-rotate"></i>
            <span>Reset / Re-Arrange Grid</span>
          </button>
        </div>
      </div>

      {/* 3-COLUMN PROFESSIONAL STUDIO LAYOUT (Left: Sheet & Upload, Center: Interactive Canvas, Right: Selected Photo Inspector) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT PANEL: UPLOAD, PAPER SIZE, ORIENTATION & SHEET SETTINGS */}
        <div className="order-2 lg:order-1 lg:col-span-3 bg-white rounded-3xl border border-slate-200 p-4 space-y-4 shadow-xs">
          <div className="space-y-2">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-700">
              1. Add Photographs
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full min-h-[44px] py-2.5 px-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-plus"></i>
              <span>Upload Photo(s) to Sheet</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFilesUpload}
              className="hidden"
            />

            {/* Quick Add / Set Exact Quantity Buttons (3, 4, 6, 8, 9, 12 Photos) */}
            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                <span>Quick Set Photo Count:</span>
                <span className="font-mono text-cyan-700">{photoObjects.length} on sheet</span>
              </div>
              <div className="grid grid-cols-6 gap-1">
                {[1, 2, 3, 4, 6, 8, 9, 12].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => {
                      const srcToUse =
                        selectedPhoto?.src ||
                        photoObjects[0]?.src ||
                        initialPassportPhotoUrl ||
                        generateSamplePortraitDataUrl(0, false);
                      addImageCopiesToSheet(
                        srcToUse,
                        'Passport Photo',
                        cnt,
                        defaultPhotoWidthMm,
                        defaultPhotoHeightMm,
                        true
                      );
                      setDefaultPhotoQty(cnt);
                      showToast(`Placed ${cnt} independent photo(s) on sheet!`);
                    }}
                    className={`py-1.5 rounded-lg text-xs font-extrabold transition ${
                      photoObjects.length === cnt
                        ? 'bg-[#070a14] text-cyan-300'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-cyan-50'
                    }`}
                  >
                    {cnt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Paper Size & Orientation */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-700">
              2. Paper Size & Orientation
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Select Sheet Size
              </label>
              <select
                value={paperSizeId}
                onChange={(e) => handlePaperSizeChange(e.target.value)}
                className="w-full min-h-[40px] px-2.5 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
              >
                {SHEET_PAPER_SIZES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {paperSizeId === 'custom' && (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600">Custom Paper Unit</span>
                  <select
                    value={customPaperUnit}
                    onChange={(e) => setCustomPaperUnit(e.target.value as any)}
                    className="px-2 py-1 text-[11px] font-bold bg-white border border-slate-200 rounded-lg"
                  >
                    <option value="inch">Inches (in)</option>
                    <option value="mm">Millimeters (mm)</option>
                    <option value="cm">Centimeters (cm)</option>
                    <option value="px">Pixels (px)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500">
                      Width ({customPaperUnit})
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={customPaperWInput}
                      onChange={(e) => setCustomPaperWInput(e.target.value)}
                      className="w-full min-h-[36px] px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500">
                      Height ({customPaperUnit})
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={customPaperHInput}
                      onChange={(e) => setCustomPaperHInput(e.target.value)}
                      className="w-full min-h-[36px] px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => handleOrientationChange('portrait')}
                className={`min-h-[36px] rounded-lg transition flex items-center justify-center gap-1.5 ${
                  orientation === 'portrait'
                    ? 'bg-[#070a14] text-cyan-300 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                <i className="fa-solid fa-file-image"></i>
                <span>Portrait</span>
              </button>
              <button
                type="button"
                onClick={() => handleOrientationChange('landscape')}
                className={`min-h-[36px] rounded-lg transition flex items-center justify-center gap-1.5 ${
                  orientation === 'landscape'
                    ? 'bg-[#070a14] text-cyan-300 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                <i className="fa-solid fa-image"></i>
                <span>Landscape</span>
              </button>
            </div>
          </div>

          {/* Print DPI, Margins, Spacing & Default Photo Dimensions */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-700">
              3. Print DPI, Margins & Spacing
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                  Print Resolution
                </label>
                <select
                  value={dpi}
                  onChange={(e) => setDpi(parseInt(e.target.value, 10))}
                  className="w-full min-h-[36px] px-2 py-1 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value={150}>150 DPI</option>
                  <option value={200}>200 DPI</option>
                  <option value={300}>300 DPI (Pro)</option>
                  <option value={600}>600 DPI (Ultra)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                  Sheet BG Color
                </label>
                <div className="flex items-center gap-1.5 h-[36px] px-2 bg-slate-50 border border-slate-200 rounded-xl">
                  <input
                    type="color"
                    value={sheetBgColor}
                    onChange={(e) => setSheetBgColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0"
                  />
                  <span className="text-[11px] font-mono font-bold text-slate-700">
                    {sheetBgColor.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                  Margin (mm)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={marginMm}
                  onChange={(e) => setMarginMm(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full min-h-[34px] px-2 py-1 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                  H-Gap (mm)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={gapXMm}
                  onChange={(e) => setGapXMm(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full min-h-[34px] px-2 py-1 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                  V-Gap (mm)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={gapYMm}
                  onChange={(e) => setGapYMm(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full min-h-[34px] px-2 py-1 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                  Default Photo W (mm)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={defaultPhotoWidthMm}
                  onChange={(e) => {
                    const v = Math.max(10, parseFloat(e.target.value) || 35);
                    setDefaultPhotoWidthMm(v);
                  }}
                  className="w-full min-h-[34px] px-2 py-1 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                  Default Photo H (mm)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={defaultPhotoHeightMm}
                  onChange={(e) => {
                    const v = Math.max(10, parseFloat(e.target.value) || 45);
                    setDefaultPhotoHeightMm(v);
                  }}
                  className="w-full min-h-[34px] px-2 py-1 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>

        {/* CENTER PANEL: INTERACTIVE SHEET CANVAS & BOTTOM TOOLBAR */}
        <div className="order-1 lg:order-2 lg:col-span-6 bg-white rounded-3xl border border-slate-200 p-4 space-y-3 shadow-xs">
          {/* Canvas Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div className="text-xs font-bold text-slate-700 flex items-center gap-2 flex-wrap">
              <span className="font-mono font-extrabold text-slate-900">
                {Math.round(sheetWMm * 10) / 10} × {Math.round(sheetHMm * 10) / 10} mm
              </span>
              <span className="text-slate-400">·</span>
              <span className="font-mono text-cyan-700">
                {exportWpx} × {exportHpx} px @ {dpi} DPI
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setShowGrid((g) => !g)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                  showGrid
                    ? 'bg-cyan-50 border-cyan-300 text-cyan-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setSnapToGuides((s) => !s)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                  snapToGuides
                    ? 'bg-purple-50 border-purple-300 text-purple-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                Snap Guides
              </button>
              <button
                type="button"
                onClick={() => setShowCutMarks((c) => !c)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                  showCutMarks
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                Cut Marks
              </button>
            </div>
          </div>

          {/* Interactive Sheet Canvas Container */}
          <div className="w-full min-h-[340px] sm:min-h-[430px] rounded-2xl bg-slate-900/90 border border-slate-800 p-3 sm:p-5 flex items-center justify-center overflow-auto select-none touch-none">
            <canvas
              ref={displayCanvasRef}
              onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY, e.shiftKey)}
              onTouchStart={(e) => {
                if (e.touches.length === 1) {
                  handlePointerDown(e.touches[0].clientX, e.touches[0].clientY, false);
                }
              }}
              onTouchMove={(e) => {
                if (e.touches.length === 1 && interactionRef.current.mode !== 'none') {
                  e.preventDefault();
                  handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
                }
              }}
              onTouchEnd={() => handlePointerUp()}
              className="max-w-full max-h-[410px] w-auto h-auto shadow-2xl rounded bg-white cursor-move"
            />
          </div>

          {/* Quick Photo Selector Strip */}
          {photoObjects.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              <span className="text-[11px] font-bold text-slate-500 shrink-0">
                Select Photo:
              </span>
              {photoObjects.map((obj, i) => {
                const isSel = selectedIds.includes(obj.id);
                return (
                  <button
                    key={obj.id}
                    type="button"
                    onClick={() => setSelectedIds([obj.id])}
                    className={`px-2.5 py-1 rounded-xl text-xs font-extrabold transition shrink-0 flex items-center gap-1 ${
                      isSel
                        ? 'bg-[#070a14] text-cyan-300 shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>#{i + 1}</span>
                    {obj.locked && <i className="fa-solid fa-lock text-[10px] text-amber-400"></i>}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSelectedIds(photoObjects.map((o) => o.id))}
                className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0"
              >
                Select All
              </button>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0"
                >
                  Deselect
                </button>
              )}
            </div>
          )}

          {/* BOTTOM TOOLBAR: UNDO, REDO, ZOOM, RESET & HIGH-RES DOWNLOADS */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleUndo}
                disabled={historyIdx <= 0}
                className="min-h-[38px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-bold flex items-center gap-1"
                title="Undo"
              >
                <i className="fa-solid fa-rotate-left"></i>
                <span>Undo</span>
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={historyIdx >= history.length - 1}
                className="min-h-[38px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-bold flex items-center gap-1"
                title="Redo"
              >
                <i className="fa-solid fa-rotate-right"></i>
                <span>Redo</span>
              </button>

              <div className="flex items-center bg-slate-100 rounded-xl px-1.5 py-0.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setViewportZoom((z) => Math.max(60, z - 15))}
                  className="px-2 py-1 text-slate-700"
                >
                  -
                </button>
                <span className="font-mono text-[11px] px-1">{viewportZoom}%</span>
                <button
                  type="button"
                  onClick={() => setViewportZoom((z) => Math.min(180, z + 15))}
                  className="px-2 py-1 text-slate-700"
                >
                  +
                </button>
              </div>
            </div>

            {/* Print-Ready Export Buttons (PNG, JPG, PDF) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => exportHighResRasterSheet('png')}
                disabled={photoObjects.length === 0}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#070a14] hover:bg-slate-800 text-cyan-300 text-xs font-extrabold flex items-center gap-1.5 disabled:opacity-40"
              >
                <i className="fa-solid fa-download"></i>
                <span>PNG ({dpi} DPI)</span>
              </button>
              <button
                type="button"
                onClick={() => exportHighResRasterSheet('jpg')}
                disabled={photoObjects.length === 0}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs disabled:opacity-40"
              >
                <i className="fa-solid fa-file-image"></i>
                <span>JPG ({dpi} DPI)</span>
              </button>
              <button
                type="button"
                onClick={exportHighResPdfSheet}
                disabled={photoObjects.length === 0 || isExportingPdf}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs disabled:opacity-40"
              >
                <i className="fa-solid fa-file-pdf"></i>
                <span>{isExportingPdf ? 'Building...' : 'PDF Sheet'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: SELECTED PHOTO PROPERTIES INSPECTOR (X, Y, WIDTH, HEIGHT, ROTATION, CORNERS, LAYERS) */}
        <div className="order-3 lg:col-span-3 bg-white rounded-3xl border border-slate-200 p-4 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700">
                Selected Photo Inspector
              </div>
              <h4 className="text-sm font-extrabold text-slate-900 truncate max-w-[170px]">
                {selectedPhoto ? selectedPhoto.name : 'No Photo Selected'}
              </h4>
            </div>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setCoordUnit('mm')}
                className={`px-2 py-1 rounded-md ${
                  coordUnit === 'mm' ? 'bg-[#070a14] text-cyan-300' : 'text-slate-600'
                }`}
              >
                mm
              </button>
              <button
                type="button"
                onClick={() => setCoordUnit('px')}
                className={`px-2 py-1 rounded-md ${
                  coordUnit === 'px' ? 'bg-[#070a14] text-cyan-300' : 'text-slate-600'
                }`}
              >
                px
              </button>
            </div>
          </div>

          {!selectedPhoto ? (
            <div className="py-10 text-center space-y-2 text-slate-400">
              <i className="fa-solid fa-arrow-pointer text-2xl"></i>
              <p className="text-xs font-bold text-slate-600">
                Click or tap any photograph on the sheet to inspect and position it.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Quick Corner & Center Placement Buttons */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600">
                  Quick Corner & Sheet Placement
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => moveSelectedToPresetPosition('top-left')}
                    className="py-1.5 px-2 rounded-xl bg-slate-50 hover:bg-cyan-50 border border-slate-200 text-slate-700"
                  >
                    ↖ Top-Left
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSelectedToPresetPosition('center')}
                    className="py-1.5 px-2 rounded-xl bg-slate-50 hover:bg-cyan-50 border border-slate-200 text-slate-700"
                  >
                    ┼ Center
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSelectedToPresetPosition('top-right')}
                    className="py-1.5 px-2 rounded-xl bg-slate-50 hover:bg-cyan-50 border border-slate-200 text-slate-700"
                  >
                    ↗ Top-Right
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSelectedToPresetPosition('bottom-left')}
                    className="py-1.5 px-2 rounded-xl bg-slate-50 hover:bg-cyan-50 border border-slate-200 text-slate-700"
                  >
                    ↙ Bot-Left
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateSelectedPhotoProps((o) => ({ ...o, locked: !o.locked }))
                    }
                    className={`py-1.5 px-2 rounded-xl border font-extrabold ${
                      selectedPhoto.locked
                        ? 'bg-amber-100 border-amber-300 text-amber-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    {selectedPhoto.locked ? 'Unlock' : 'Lock Pos'}
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSelectedToPresetPosition('bottom-right')}
                    className="py-1.5 px-2 rounded-xl bg-slate-50 hover:bg-cyan-50 border border-slate-200 text-slate-700"
                  >
                    ↘ Bot-Right
                  </button>
                </div>
              </div>

              {/* Numeric X & Y Coordinates */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                    X Position ({coordUnit})
                  </label>
                  <input
                    type="number"
                    step={coordUnit === 'mm' ? '0.5' : '1'}
                    disabled={selectedPhoto.locked}
                    value={
                      coordUnit === 'mm'
                        ? Math.round(selectedPhoto.xMm * 10) / 10
                        : mmToExportPx(selectedPhoto.xMm)
                    }
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      const nextMm = coordUnit === 'mm' ? val : exportPxToMm(val);
                      updateSelectedPhotoProps((o) => ({
                        ...o,
                        xMm: Math.max(0, Math.min(sheetWMm - o.widthMm, nextMm)),
                      }));
                    }}
                    className="w-full min-h-[36px] px-2.5 py-1 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                    Y Position ({coordUnit})
                  </label>
                  <input
                    type="number"
                    step={coordUnit === 'mm' ? '0.5' : '1'}
                    disabled={selectedPhoto.locked}
                    value={
                      coordUnit === 'mm'
                        ? Math.round(selectedPhoto.yMm * 10) / 10
                        : mmToExportPx(selectedPhoto.yMm)
                    }
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      const nextMm = coordUnit === 'mm' ? val : exportPxToMm(val);
                      updateSelectedPhotoProps((o) => ({
                        ...o,
                        yMm: Math.max(0, Math.min(sheetHMm - o.heightMm, nextMm)),
                      }));
                    }}
                    className="w-full min-h-[36px] px-2.5 py-1 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Width & Height with Aspect Ratio Lock */}
              <div className="space-y-2 p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700">
                    Photo Dimensions ({coordUnit})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateSelectedPhotoProps((o) => ({
                        ...o,
                        aspectLocked: !o.aspectLocked,
                      }))
                    }
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                      selectedPhoto.aspectLocked
                        ? 'bg-cyan-100 text-cyan-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    <i
                      className={`fa-solid ${
                        selectedPhoto.aspectLocked ? 'fa-link' : 'fa-link-slash'
                      }`}
                    ></i>
                    <span>{selectedPhoto.aspectLocked ? 'Aspect Locked' : 'Free Aspect'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                      Width ({coordUnit})
                    </label>
                    <input
                      type="number"
                      step={coordUnit === 'mm' ? '0.5' : '1'}
                      disabled={selectedPhoto.locked}
                      value={
                        coordUnit === 'mm'
                          ? Math.round(selectedPhoto.widthMm * 10) / 10
                          : mmToExportPx(selectedPhoto.widthMm)
                      }
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 10;
                        const nextWMm = Math.max(
                          10,
                          coordUnit === 'mm' ? val : exportPxToMm(val)
                        );
                        updateSelectedPhotoProps((o) => {
                          const ratio = o.heightMm / Math.max(1, o.widthMm);
                          return {
                            ...o,
                            widthMm: nextWMm,
                            heightMm: o.aspectLocked
                              ? Math.round(nextWMm * ratio * 100) / 100
                              : o.heightMm,
                          };
                        });
                      }}
                      className="w-full min-h-[36px] px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                      Height ({coordUnit})
                    </label>
                    <input
                      type="number"
                      step={coordUnit === 'mm' ? '0.5' : '1'}
                      disabled={selectedPhoto.locked}
                      value={
                        coordUnit === 'mm'
                          ? Math.round(selectedPhoto.heightMm * 10) / 10
                          : mmToExportPx(selectedPhoto.heightMm)
                      }
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 10;
                        const nextHMm = Math.max(
                          10,
                          coordUnit === 'mm' ? val : exportPxToMm(val)
                        );
                        updateSelectedPhotoProps((o) => {
                          const ratio = o.widthMm / Math.max(1, o.heightMm);
                          return {
                            ...o,
                            heightMm: nextHMm,
                            widthMm: o.aspectLocked
                              ? Math.round(nextHMm * ratio * 100) / 100
                              : o.widthMm,
                          };
                        });
                      }}
                      className="w-full min-h-[36px] px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Individual Photo Rotation */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Rotation Angle</span>
                  <span className="font-mono font-bold text-cyan-700">
                    {selectedPhoto.rotation}°
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={selectedPhoto.locked}
                    onClick={() =>
                      updateSelectedPhotoProps((o) => ({
                        ...o,
                        rotation: ((o.rotation - 90 + 540) % 360) - 180,
                      }))
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
                  >
                    -90°
                  </button>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    disabled={selectedPhoto.locked}
                    value={selectedPhoto.rotation}
                    onChange={(e) => {
                      const deg = parseFloat(e.target.value);
                      updateSelectedPhotoProps((o) => ({ ...o, rotation: deg }), false);
                    }}
                    onMouseUp={() => pushHistorySnapshot(photoObjects)}
                    className="flex-1 cursor-pointer"
                  />
                  <button
                    type="button"
                    disabled={selectedPhoto.locked}
                    onClick={() =>
                      updateSelectedPhotoProps((o) => ({
                        ...o,
                        rotation: ((o.rotation + 90 + 540) % 360) - 180,
                      }))
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
                  >
                    +90°
                  </button>
                  <button
                    type="button"
                    disabled={selectedPhoto.locked}
                    onClick={() =>
                      updateSelectedPhotoProps((o) => ({ ...o, rotation: 0 }))
                    }
                    className="px-2 py-1 rounded-lg bg-cyan-50 text-cyan-800 text-xs font-bold"
                  >
                    0°
                  </button>
                </div>
              </div>

              {/* Layer Order, Duplicate & Delete Controls */}
              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-100 text-xs font-bold">
                <button
                  type="button"
                  onClick={handleBringForward}
                  className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-layer-group"></i>
                  <span>Bring Forward</span>
                </button>
                <button
                  type="button"
                  onClick={handleSendBackward}
                  className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-bars-staggered"></i>
                  <span>Send Backward</span>
                </button>
                <button
                  type="button"
                  onClick={handleDuplicateSelected}
                  className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border border-cyan-200 flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-copy"></i>
                  <span>Duplicate</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-trash-can"></i>
                  <span>Delete</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
