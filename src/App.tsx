/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  COUNTRY_PRESETS,
  BG_SWATCHES,
  generateSamplePortraitDataUrl,
  UserProfile,
  AppointmentRecord,
  DocumentVerificationRecord,
  SavedPhotoRecord,
  SERVICE_TYPES,
  BRANCH_LOCATIONS,
  TIME_SLOTS,
  DOCUMENT_TYPES,
} from './constants';
import { runBriaRmbgCutout } from './rmbgEngine';
import { UserDashboard } from './components/UserDashboard';

export default function App() {
  // Navigation & Auth State (Only Studio & User Dashboard - No Admin Panel)
  const [activeRoute, setActiveRoute] = useState<'studio' | 'dashboard'>('studio');
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Email & Password Auth Modal State
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [authFullName, setAuthFullName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  // Firestore Collections State
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [verifications, setVerifications] = useState<DocumentVerificationRecord[]>([]);
  const [savedPhotos, setSavedPhotos] = useState<SavedPhotoRecord[]>([]);

  // Studio Control Tab State
  const [controlTab, setControlTab] = useState<'size' | 'bg' | 'adjust'>('size');
  const [countrySearch, setCountrySearch] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('in-stamp');
  const [widthMm, setWidthMm] = useState(35);
  const [heightMm, setHeightMm] = useState(45);
  const [customUnit, setCustomUnit] = useState<'mm' | 'cm' | 'inch' | 'px'>('mm');
  const [customWidthInput, setCustomWidthInput] = useState('35');
  const [customHeightInput, setCustomHeightInput] = useState('45');
  const [dpi, setDpi] = useState(300);

  // Studio Background & Cutout State
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [bgName, setBgName] = useState('Pure White');
  const [cutoutEngine, setCutoutEngine] = useState<'rmbg' | 'removebg_api' | 'original'>('rmbg');
  const [bgTolerance, setBgTolerance] = useState(10);
  const [removeBgApiKey, setRemoveBgApiKey] = useState('');
  const [aiStatusText, setAiStatusText] = useState('Ready');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLoadingMsg, setAiLoadingMsg] = useState('Removing Background...');
  const [aiProgress, setAiProgress] = useState(20);

  // Studio Adjustments & Transforms
  const [zoom, setZoom] = useState(100);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [rotate, setRotate] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);

  // Studio Preview Mode & Overlays
  const [previewMode, setPreviewMode] = useState<'single' | 'compare' | 'sheet'>('single');
  const [showBiometricGrid, setShowBiometricGrid] = useState(true);
  const [showCutMarks, setShowCutMarks] = useState(true);
  const [activeSampleIdx, setActiveSampleIdx] = useState<number>(0);
  const [sampleThumbUrls, setSampleThumbUrls] = useState<string[]>([]);
  const [compareOriginalSrc, setCompareOriginalSrc] = useState<string>('');
  const [currentStudioPreviewUrl, setCurrentStudioPreviewUrl] = useState<string>('');

  // Modals & Toast
  const [showExportModal, setShowExportModal] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isSavingCloudPhoto, setIsSavingCloudPhoto] = useState(false);

  // Canvas & Image Refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const passportCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compareCutoutCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sheetCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeImageRef = useRef<HTMLImageElement | null>(null);
  const rawCutoutCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseSubjectCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const toastTimerRef = useRef<any>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMsg(null);
    }, 3500);
  }, []);

  // =========================================================================
  // 1. GENERATE HERMETIC DEMO PORTRAITS ON MOUNT
  // =========================================================================
  useEffect(() => {
    const urls = [
      generateSamplePortraitDataUrl(0, false),
      generateSamplePortraitDataUrl(1, false),
      generateSamplePortraitDataUrl(2, false),
    ];
    setSampleThumbUrls(urls);
    loadSamplePortraitByIndex(0, urls[0], false);
  }, []);

  // =========================================================================
  // 2. FIREBASE AUTHENTICATION & USER PROFILE BOOTSTRAP
  // =========================================================================
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const defaultProfile: UserProfile = {
          uid: user.uid,
          displayName: (user.displayName || user.email?.split('@')[0] || 'Studio User').slice(0, 100),
          email: (user.email || 'user@passportstudio.pro').slice(0, 150),
          phone: (user.phoneNumber || '').slice(0, 30),
          role: 'user',
          status: 'active',
        };
        const userRef = doc(db, 'users', user.uid);
        try {
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            await setDoc(userRef, {
              ...defaultProfile,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            setUserProfile(defaultProfile);
          } else {
            const existingData = snap.data() as UserProfile;
            setUserProfile(existingData);
          }
        } catch (error) {
          console.warn('Firestore profile sync notice:', error);
          setUserProfile(defaultProfile);
        }
      } else {
        setUserProfile(null);
        setActiveRoute('studio');
      }
      setIsAuthReady(true);
    });
    return () => unsub();
  }, []);

  // =========================================================================
  // 3. REAL-TIME FIRESTORE LISTENERS (USER DASHBOARD)
  // =========================================================================
  useEffect(() => {
    if (!isAuthReady || !currentUser || !userProfile) {
      setAppointments([]);
      setVerifications([]);
      setSavedPhotos([]);
      return;
    }

    // Appointments Listener
    const aptQuery = query(collection(db, 'appointments'), where('userId', '==', currentUser.uid));
    const unsubApt = onSnapshot(
      aptQuery,
      (snap) => {
        const list: AppointmentRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AppointmentRecord, 'id'>),
        }));
        setAppointments(list);
      },
      (err) => console.warn('Firestore appointments listener error:', err)
    );

    // Document Verifications Listener
    const verQuery = query(collection(db, 'verifications'), where('userId', '==', currentUser.uid));
    const unsubVer = onSnapshot(
      verQuery,
      (snap) => {
        const list: DocumentVerificationRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<DocumentVerificationRecord, 'id'>),
        }));
        setVerifications(list);
      },
      (err) => console.warn('Firestore verifications listener error:', err)
    );

    // Saved Photos Listener
    const photoQuery = query(collection(db, 'savedPhotos'), where('userId', '==', currentUser.uid));
    const unsubPhotos = onSnapshot(
      photoQuery,
      (snap) => {
        const list: SavedPhotoRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SavedPhotoRecord, 'id'>),
        }));
        setSavedPhotos(list);
      },
      (err) => console.warn('Firestore savedPhotos listener error:', err)
    );

    return () => {
      unsubApt();
      unsubVer();
      unsubPhotos();
    };
  }, [isAuthReady, currentUser, userProfile]);

  // =========================================================================
  // 4. PIXEL-LEVEL COLOR GRADING & EDGE REFINEMENT
  // =========================================================================
  const applyPixelColorGrading = useCallback(
    (bVal = brightness, cVal = contrast, sVal = saturate) => {
      if (!baseSubjectCanvasRef.current) return;
      const src = baseSubjectCanvasRef.current;
      const w = src.width;
      const h = src.height;

      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const ctx = out.getContext('2d')!;
      ctx.drawImage(src, 0, 0);

      const b = bVal / 100;
      const c = cVal / 100;
      const s = sVal / 100;

      if (b !== 1 || c !== 1 || s !== 1) {
        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;
        const contrastFactor = Math.pow(c + 0.05, 2);

        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] === 0) continue;

          let r = d[i] * b;
          let g = d[i + 1] * b;
          let bl = d[i + 2] * b;

          r = (r - 128) * contrastFactor + 128;
          g = (g - 128) * contrastFactor + 128;
          bl = (bl - 128) * contrastFactor + 128;

          const gray = 0.299 * r + 0.587 * g + 0.114 * bl;
          r = gray + (r - gray) * s;
          g = gray + (g - gray) * s;
          bl = gray + (bl - gray) * s;

          d[i] = r < 0 ? 0 : r > 255 ? 255 : r;
          d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
          d[i + 2] = bl < 0 ? 0 : bl > 255 ? 255 : bl;
        }
        ctx.putImageData(imgData, 0, 0);
      }

      processedCanvasRef.current = out;

      if (compareCutoutCanvasRef.current) {
        compareCutoutCanvasRef.current.width = w;
        compareCutoutCanvasRef.current.height = h;
        compareCutoutCanvasRef.current.getContext('2d')!.drawImage(out, 0, 0);
      }
    },
    [brightness, contrast, saturate]
  );

  const applyEdgeRefinement = useCallback(
    (toleranceVal = bgTolerance) => {
      if (!rawCutoutCanvasRef.current) return;
      const src = rawCutoutCanvasRef.current;
      const w = src.width;
      const h = src.height;
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const ctx = out.getContext('2d')!;
      ctx.drawImage(src, 0, 0);

      if (toleranceVal > 0) {
        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;
        const threshold = Math.round((toleranceVal / 50) * 110);
        for (let i = 3; i < d.length; i += 4) {
          const a = d[i];
          if (a > 0 && a < threshold) {
            d[i] = 0;
          } else if (a >= threshold && a < 230) {
            d[i] = Math.min(255, Math.round((a - threshold) * (255 / (230 - threshold))));
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }
      baseSubjectCanvasRef.current = out;
      applyPixelColorGrading();
    },
    [bgTolerance, applyPixelColorGrading]
  );

  // =========================================================================
  // 5. EXACT 6x4 INCH PRINT SHEET & PASSPORT CANVAS RENDERING
  // =========================================================================
  const getExact6x4GridConfig = useCallback(() => {
    const sheetDpi = 300;
    const photoW = Math.round((widthMm / 25.4) * sheetDpi);
    const photoH = Math.round((heightMm / 25.4) * sheetDpi);
    const sheetW = 1800;
    const sheetH = 1200;

    const preset = COUNTRY_PRESETS.find((p) => p.id === selectedPresetId);
    if (preset && preset.cols && preset.rows) {
      return {
        cols: preset.cols,
        rows: preset.rows,
        total: preset.cols * preset.rows,
        sheetW,
        sheetH,
        photoW,
        photoH,
      };
    }

    const cols = Math.max(1, Math.floor(sheetW / photoW));
    const rows = Math.max(1, Math.floor(sheetH / photoH));
    return {
      cols,
      rows,
      total: cols * rows,
      sheetW,
      sheetH,
      photoW,
      photoH,
    };
  }, [widthMm, heightMm, selectedPresetId]);

  const renderPassportToCanvas = useCallback(
    (targetCanvas: HTMLCanvasElement, includeBiometricOverlay = false) => {
      const pxW = Math.round((widthMm / 25.4) * dpi);
      const pxH = Math.round((heightMm / 25.4) * dpi);
      targetCanvas.width = pxW;
      targetCanvas.height = pxH;
      const ctx = targetCanvas.getContext('2d')!;
      ctx.clearRect(0, 0, pxW, pxH);

      if (bgColor !== 'transparent') {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, pxW, pxH);
      }

      if (processedCanvasRef.current) {
        ctx.save();
        ctx.translate(pxW / 2 + panX, pxH / 2 + panY);
        ctx.rotate((rotate * Math.PI) / 180);
        const z = zoom / 100;
        ctx.scale(z, z);
        ctx.translate(-pxW / 2, -pxH / 2);

        const img = processedCanvasRef.current;
        const imgAspect = img.width / img.height;
        const canvasAspect = pxW / pxH;
        let drawW: number;
        let drawH: number;
        if (imgAspect > canvasAspect) {
          drawH = pxH;
          drawW = pxH * imgAspect;
        } else {
          drawW = pxW;
          drawH = pxW / imgAspect;
        }
        ctx.drawImage(img, (pxW - drawW) / 2, (pxH - drawH) / 2, drawW, drawH);
        ctx.restore();
      }

      if (includeBiometricOverlay) {
        ctx.save();
        ctx.strokeStyle = 'rgba(79, 70, 229, 0.50)';
        ctx.lineWidth = Math.max(1.5, pxW * 0.003);
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(pxW / 2, 0);
        ctx.lineTo(pxW / 2, pxH);
        ctx.stroke();

        const eyeY = pxH * 0.43;
        ctx.beginPath();
        ctx.moveTo(pxW * 0.15, eyeY);
        ctx.lineTo(pxW * 0.85, eyeY);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.ellipse(pxW / 2, pxH * 0.45, pxW * 0.27, pxH * 0.31, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    },
    [widthMm, heightMm, dpi, bgColor, panX, panY, rotate, zoom]
  );

  const renderPrintableSheet = useCallback(
    (sheetCanvas: HTMLCanvasElement) => {
      const singleClean = document.createElement('canvas');
      renderPassportToCanvas(singleClean, false);

      const { cols, rows, sheetW, sheetH, photoW, photoH } = getExact6x4GridConfig();

      sheetCanvas.width = sheetW;
      sheetCanvas.height = sheetH;
      const ctx = sheetCanvas.getContext('2d')!;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, sheetW, sheetH);

      const availW = sheetW - cols * photoW;
      const availH = sheetH - rows * photoH;
      const gapX = cols > 1 ? Math.min(24, Math.floor(availW / (cols + 1))) : 0;
      const gapY = rows > 1 ? Math.min(24, Math.floor(availH / (rows + 1))) : 0;

      const totalGridW = cols * photoW + (cols - 1) * gapX;
      const totalGridH = rows * photoH + (rows - 1) * gapY;

      const startX = Math.round((sheetW - totalGridW) / 2);
      const startY = Math.round((sheetH - totalGridH) / 2);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = startX + c * (photoW + gapX);
          const y = startY + r * (photoH + gapY);
          ctx.drawImage(singleClean, x, y, photoW, photoH);

          if (showCutMarks) {
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, photoW, photoH);
          }
        }
      }
    },
    [renderPassportToCanvas, getExact6x4GridConfig, showCutMarks]
  );

  const renderAll = useCallback(() => {
    if (passportCanvasRef.current) {
      renderPassportToCanvas(passportCanvasRef.current, showBiometricGrid);
    }
    if (sheetCanvasRef.current && previewMode === 'sheet') {
      renderPrintableSheet(sheetCanvasRef.current);
    }
    if (compareCutoutCanvasRef.current && processedCanvasRef.current) {
      compareCutoutCanvasRef.current.width = processedCanvasRef.current.width;
      compareCutoutCanvasRef.current.height = processedCanvasRef.current.height;
      compareCutoutCanvasRef.current
        .getContext('2d')!
        .drawImage(processedCanvasRef.current, 0, 0);
    }

    const thumbCanvas = document.createElement('canvas');
    renderPassportToCanvas(thumbCanvas, false);
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = 210;
    smallCanvas.height = Math.round(210 * (heightMm / widthMm));
    smallCanvas
      .getContext('2d')!
      .drawImage(thumbCanvas, 0, 0, smallCanvas.width, smallCanvas.height);
    setCurrentStudioPreviewUrl(smallCanvas.toDataURL('image/jpeg', 0.82));
  }, [
    renderPassportToCanvas,
    renderPrintableSheet,
    showBiometricGrid,
    previewMode,
    widthMm,
    heightMm,
  ]);

  useEffect(() => {
    applyPixelColorGrading(brightness, contrast, saturate);
    renderAll();
  }, [
    brightness,
    contrast,
    saturate,
    widthMm,
    heightMm,
    dpi,
    bgColor,
    panX,
    panY,
    rotate,
    zoom,
    showBiometricGrid,
    showCutMarks,
    previewMode,
    activeRoute,
    applyPixelColorGrading,
    renderAll,
  ]);

  // =========================================================================
  // 6. PHOTO LOADING & AI BACKGROUND REMOVAL HANDLERS
  // =========================================================================
  const loadSamplePortraitByIndex = (
    index: number,
    overrideUrl?: string,
    autoRunAi = false
  ) => {
    setActiveSampleIdx(index);
    const dataUrl = overrideUrl || sampleThumbUrls[index] || generateSamplePortraitDataUrl(index, false);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      activeImageRef.current = img;
      rawCutoutCanvasRef.current = null;
      setZoom(100);
      setPanX(0);
      setPanY(0);
      setRotate(0);
      setBrightness(100);
      setContrast(100);
      setSaturate(100);
      setAiStatusText('Ready');

      const origCanvas = document.createElement('canvas');
      origCanvas.width = img.width;
      origCanvas.height = img.height;
      origCanvas.getContext('2d')!.drawImage(img, 0, 0);
      baseSubjectCanvasRef.current = origCanvas;
      setCompareOriginalSrc(img.src);

      applyPixelColorGrading(100, 100, 100);
      renderAll();

      if (autoRunAi) {
        triggerManualAiCutout(img);
      }
    };
    img.src = dataUrl;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setActiveSampleIdx(-1);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        activeImageRef.current = img;
        rawCutoutCanvasRef.current = null;
        setZoom(100);
        setPanX(0);
        setPanY(0);
        setRotate(0);
        setBrightness(100);
        setContrast(100);
        setSaturate(100);

        const origCanvas = document.createElement('canvas');
        origCanvas.width = img.width;
        origCanvas.height = img.height;
        origCanvas.getContext('2d')!.drawImage(img, 0, 0);
        baseSubjectCanvasRef.current = origCanvas;
        setCompareOriginalSrc(img.src);

        if (img.height > img.width * 1.28) {
          const pxH = Math.round((heightMm / 25.4) * dpi);
          setZoom(175);
          setPanX(0);
          setPanY(Math.round(pxH * 0.28));
        }

        applyPixelColorGrading(100, 100, 100);
        renderAll();
        triggerManualAiCutout(img);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const triggerManualAiCutout = async (imgOverride?: HTMLImageElement) => {
    const targetImg = imgOverride || activeImageRef.current;
    if (!targetImg) return;

    setAiLoading(true);
    setAiLoadingMsg('Starting AI Background Remover...');
    setAiProgress(20);

    try {
      const cutoutCanvas = await runBriaRmbgCutout(targetImg, (pct, msg) => {
        setAiProgress(pct);
        setAiLoadingMsg(msg);
      });
      if (cutoutCanvas) {
        rawCutoutCanvasRef.current = cutoutCanvas;
        applyEdgeRefinement(bgTolerance);
        setAiLoading(false);
        setAiStatusText('Cutout Active');
        renderAll();
        showToast('Background Removed Successfully!');
        return;
      }
    } catch (err) {
      console.error('Cutout error:', err);
    }

    setAiLoading(false);
    showToast('Background Removed!');
  };

  const runRemoveBgCloudApi = async () => {
    if (!removeBgApiKey.trim() || !activeImageRef.current) {
      showToast('Please enter a valid Remove.bg API Key');
      return;
    }
    try {
      setAiLoading(true);
      setAiLoadingMsg('Connecting to Remove.bg Cloud...');
      setAiProgress(60);

      const c = document.createElement('canvas');
      c.width = activeImageRef.current.width;
      c.height = activeImageRef.current.height;
      c.getContext('2d')!.drawImage(activeImageRef.current, 0, 0);
      const blob = await new Promise<Blob | null>((res) =>
        c.toBlob(res, 'image/jpeg', 0.92)
      );
      if (!blob) throw new Error('Blob conversion failed');

      const formData = new FormData();
      formData.append('image_file', blob, 'photo.jpg');
      formData.append('size', 'auto');

      const res = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': removeBgApiKey.trim() },
        body: formData,
      });
      if (!res.ok) throw new Error('API Error');
      const outBlob = await res.blob();
      const outUrl = URL.createObjectURL(outBlob);
      const cutImg = new Image();
      cutImg.onload = () => {
        const outC = document.createElement('canvas');
        outC.width = cutImg.width;
        outC.height = cutImg.height;
        outC.getContext('2d')!.drawImage(cutImg, 0, 0);
        rawCutoutCanvasRef.current = outC;
        applyEdgeRefinement(bgTolerance);
        setAiLoading(false);
        setAiStatusText('Cloud Cutout');
        renderAll();
        showToast('Remove.bg Cloud Cutout Complete!');
      };
      cutImg.src = outUrl;
    } catch {
      setAiLoading(false);
      showToast('Remove.bg API key invalid or quota exceeded.');
    }
  };

  const handleSetCutoutEngine = (mode: 'rmbg' | 'removebg_api' | 'original') => {
    setCutoutEngine(mode);
    if (mode === 'original' && activeImageRef.current) {
      const c = document.createElement('canvas');
      c.width = activeImageRef.current.width;
      c.height = activeImageRef.current.height;
      c.getContext('2d')!.drawImage(activeImageRef.current, 0, 0);
      baseSubjectCanvasRef.current = c;
      applyPixelColorGrading();
      renderAll();
    } else if (mode === 'rmbg') {
      if (rawCutoutCanvasRef.current) {
        applyEdgeRefinement();
        renderAll();
      } else {
        triggerManualAiCutout();
      }
    }
  };

  const selectCountryPreset = (presetId: string) => {
    const preset = COUNTRY_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(presetId);
    setWidthMm(preset.widthMm);
    setHeightMm(preset.heightMm);
    setCustomWidthInput(String(preset.widthMm));
    setCustomHeightInput(String(preset.heightMm));
  };

  const applyCustomSize = (
    unitVal: 'mm' | 'cm' | 'inch' | 'px',
    wStr: string,
    hStr: string,
    dpiVal: number
  ) => {
    const rawW = parseFloat(wStr) || 35;
    const rawH = parseFloat(hStr) || 45;
    setSelectedPresetId('custom');
    let wMm = rawW;
    let hMm = rawH;
    if (unitVal === 'cm') {
      wMm = rawW * 10;
      hMm = rawH * 10;
    } else if (unitVal === 'inch') {
      wMm = rawW * 25.4;
      hMm = rawH * 25.4;
    } else if (unitVal === 'px') {
      wMm = (rawW / dpiVal) * 25.4;
      hMm = (rawH / dpiVal) * 25.4;
    }
    setWidthMm(Math.max(15, Math.min(150, wMm)));
    setHeightMm(Math.max(15, Math.min(150, hMm)));
  };

  const applyPassportHeadshotZoom = () => {
    if (!activeImageRef.current) return;
    const pxH = Math.round((heightMm / 25.4) * dpi);
    setZoom(175);
    setPanX(0);
    setPanY(Math.round(pxH * 0.28));
    showToast('Auto-Framed Head & Shoulders!');
  };

  const resetTransformAndFilters = () => {
    setZoom(100);
    setPanX(0);
    setPanY(0);
    setRotate(0);
    setBrightness(100);
    setContrast(100);
    setSaturate(100);
    showToast('Reset all adjustments');
  };

  const downloadSinglePhoto = (format: 'png' | 'jpeg' = 'png') => {
    const exportCanvas = document.createElement('canvas');
    renderPassportToCanvas(exportCanvas, false);
    const link = document.createElement('a');
    link.download = `passport-photo.${format === 'jpeg' ? 'jpg' : 'png'}`;
    link.href = exportCanvas.toDataURL(
      format === 'jpeg' ? 'image/jpeg' : 'image/png',
      0.96
    );
    link.click();
    setShowExportModal(false);
    showToast('Downloaded HD Passport Photo!');
  };

  const downloadPrintSheet = () => {
    const tempSheet = document.createElement('canvas');
    renderPrintableSheet(tempSheet);
    const link = document.createElement('a');
    link.download = 'passport-6x4-sheet-300dpi.jpg';
    link.href = tempSheet.toDataURL('image/jpeg', 0.96);
    link.click();
    setShowExportModal(false);
    showToast('Downloaded 6×4" Print Sheet!');
  };

  const handleSavePhotoToCloud = async () => {
    if (!currentUser || !userProfile) {
      setShowAuthModal(true);
      return;
    }
    setIsSavingCloudPhoto(true);
    try {
      const activePreset = COUNTRY_PRESETS.find((p) => p.id === selectedPresetId);
      const wMmRounded = Math.round(widthMm * 10) / 10;
      const hMmRounded = Math.round(heightMm * 10) / 10;
      await addDoc(collection(db, 'savedPhotos'), {
        userId: currentUser.uid,
        presetName: (activePreset ? activePreset.country : 'Custom Passport Size').slice(0, 100),
        dimensionsText: `${wMmRounded} × ${hMmRounded} mm @ ${dpi} DPI`.slice(0, 80),
        bgColor: bgColor.slice(0, 30),
        previewDataUrl: currentStudioPreviewUrl.slice(0, 240000),
        createdAt: serverTimestamp(),
      });
      showToast('Saved photo to your Dashboard!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'savedPhotos');
    } finally {
      setIsSavingCloudPhoto(false);
    }
  };

  // =========================================================================
  // 7. CANVAS DRAG & WHEEL INTERACTIONS
  // =========================================================================
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - panX, y: e.clientY - panY };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      setPanX(e.clientX - dragStartRef.current.x);
      setPanY(e.clientY - dragStartRef.current.y);
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 6 : -6;
    setZoom((prev) => Math.max(50, Math.min(280, prev + delta)));
  };

  // =========================================================================
  // 8. AUTHENTICATION HANDLERS (EMAIL/PASSWORD + GOOGLE)
  // =========================================================================
  const formatFirebaseAuthError = (error: any): string => {
    const code = error?.code || '';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Invalid email or password. Please check your credentials and try again.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'This email address is already registered. Please switch to Login.';
    }
    if (code === 'auth/weak-password') {
      return 'Password must be at least 6 characters long.';
    }
    if (code === 'auth/operation-not-allowed') {
      return 'Email/Password sign-in is not enabled in Firebase Console (bharatchats-e963f). Enable it in Authentication → Sign-in method.';
    }
    return error?.message || 'Authentication error occurred. Please try again.';
  };

  const handleEmailPasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthSubmitting(true);

    try {
      if (authMode === 'reset') {
        if (!authEmail.trim()) {
          setAuthError('Please enter your registered email address.');
          return;
        }
        await sendPasswordResetEmail(auth, authEmail.trim());
        showToast('Password reset link sent to your email!');
        setAuthMode('login');
        return;
      }

      if (authMode === 'signup') {
        if (!authFullName.trim()) {
          setAuthError('Please enter your full name.');
          return;
        }
        const userCred = await createUserWithEmailAndPassword(
          auth,
          authEmail.trim(),
          authPassword
        );
        await updateProfile(userCred.user, {
          displayName: authFullName.trim().slice(0, 100),
        });

        const newProfile: UserProfile = {
          uid: userCred.user.uid,
          displayName: authFullName.trim().slice(0, 100),
          email: (userCred.user.email || authEmail.trim()).slice(0, 150),
          phone: authPhone.trim().slice(0, 30),
          role: 'user',
          status: 'active',
        };

        try {
          await setDoc(doc(db, 'users', userCred.user.uid), {
            ...newProfile,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (firestoreErr) {
          console.warn('Firestore user profile creation notice:', firestoreErr);
        }

        setUserProfile(newProfile);
        setShowAuthModal(false);
        setAuthPassword('');
        showToast('Account created and signed in!');
      } else {
        await signInWithEmailAndPassword(auth, authEmail.trim(), authPassword);
        setShowAuthModal(false);
        setAuthPassword('');
        showToast('Signed in successfully!');
      }
    } catch (error: any) {
      setAuthError(formatFirebaseAuthError(error));
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      setShowAuthModal(false);
      showToast('Signed in with Google!');
    } catch (error: any) {
      setAuthError(formatFirebaseAuthError(error));
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setActiveRoute('studio');
    showToast('Signed out successfully');
  };

  // =========================================================================
  // 9. FIRESTORE MUTATION HANDLERS FOR USER DASHBOARD
  // =========================================================================
  const handleBookAppointment = async (data: {
    phone: string;
    serviceType: (typeof SERVICE_TYPES)[number];
    countrySpec: string;
    branchLocation: (typeof BRANCH_LOCATIONS)[number];
    appointmentDate: string;
    timeSlot: (typeof TIME_SLOTS)[number];
    notes: string;
  }) => {
    if (!currentUser || !userProfile) return;
    try {
      await addDoc(collection(db, 'appointments'), {
        userId: currentUser.uid,
        userName: userProfile.displayName.slice(0, 100),
        userEmail: userProfile.email.slice(0, 150),
        phone: data.phone.slice(0, 30),
        serviceType: data.serviceType,
        countrySpec: data.countrySpec.slice(0, 100),
        branchLocation: data.branchLocation,
        appointmentDate: data.appointmentDate.slice(0, 10),
        timeSlot: data.timeSlot,
        status: 'pending',
        notes: data.notes.slice(0, 500),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast('Studio Appointment Booked Successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'appointments');
    }
  };

  const handleCancelAppointment = async (apt: AppointmentRecord) => {
    try {
      await updateDoc(doc(db, 'appointments', apt.id), {
        status: 'cancelled',
        notes: apt.notes,
        updatedAt: serverTimestamp(),
      });
      showToast('Appointment cancelled');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${apt.id}`);
    }
  };

  const handleSubmitVerification = async (data: {
    documentType: (typeof DOCUMENT_TYPES)[number];
    documentNumber: string;
    country: string;
    photoPreviewDataUrl: string;
    remarks: string;
  }) => {
    if (!currentUser || !userProfile) return;
    try {
      await addDoc(collection(db, 'verifications'), {
        userId: currentUser.uid,
        userName: userProfile.displayName.slice(0, 100),
        userEmail: userProfile.email.slice(0, 150),
        documentType: data.documentType,
        documentNumber: data.documentNumber.slice(0, 50),
        country: data.country.slice(0, 80),
        photoPreviewDataUrl: data.photoPreviewDataUrl.slice(0, 240000),
        status: 'pending',
        remarks: data.remarks.slice(0, 500),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast('Document submitted for official verification!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'verifications');
    }
  };

  const handleDeleteVerification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'verifications', id));
      showToast('Verification record removed');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `verifications/${id}`);
    }
  };

  const handleDeleteSavedPhoto = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'savedPhotos', id));
      showToast('Saved photo deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `savedPhotos/${id}`);
    }
  };

  const handleUpdateProfile = async (displayName: string, phone: string) => {
    if (!currentUser || !userProfile) return;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        displayName: displayName.slice(0, 100),
        phone: phone.slice(0, 30),
        updatedAt: serverTimestamp(),
      });
      setUserProfile({ ...userProfile, displayName, phone });
      showToast('Profile details updated!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${currentUser.uid}`);
    }
  };

  // =========================================================================
  // 10. COMPUTED DIMENSION & SHEET LABELS
  // =========================================================================
  const wMmRounded = Math.round(widthMm * 10) / 10;
  const hMmRounded = Math.round(heightMm * 10) / 10;
  const wIn = (widthMm / 25.4).toFixed(2);
  const hIn = (heightMm / 25.4).toFixed(2);
  const pxW = Math.round((widthMm / 25.4) * dpi);
  const pxH = Math.round((heightMm / 25.4) * dpi);
  const activePreset = COUNTRY_PRESETS.find((p) => p.id === selectedPresetId);
  const gridInfo = getExact6x4GridConfig();

  const filteredPresets = COUNTRY_PRESETS.filter(
    (p) =>
      p.country.toLowerCase().includes(countrySearch.trim().toLowerCase()) ||
      p.desc.toLowerCase().includes(countrySearch.trim().toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 font-sans">
      {/* Top Navigation — Clean 3-Zone Contract with PassportStudio Pro Identity */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <button
            onClick={() => setActiveRoute('studio')}
            className="flex items-center gap-3 text-left whitespace-nowrap shrink-0 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/25">
              <i className="fa-solid fa-id-card-clip text-lg"></i>
            </div>
            <span className="font-extrabold text-lg tracking-tight text-slate-900">
              Passport<span className="text-indigo-600">Studio</span> Pro
            </span>
          </button>

          {/* Zone 2: Concise Navigation Links (Studio + User Dashboard Only) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600">
            <button
              onClick={() => setActiveRoute('studio')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                activeRoute === 'studio'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent'
              }`}
            >
              Photo Studio
            </button>
            <button
              onClick={() => {
                if (!currentUser) {
                  setAuthMode('login');
                  setAuthError(null);
                  setShowAuthModal(true);
                } else {
                  setActiveRoute('dashboard');
                }
              }}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                activeRoute === 'dashboard'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent'
              }`}
            >
              My Dashboard
            </button>
          </nav>

          {/* Zone 3: Primary Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            {currentUser ? (
              <button
                onClick={() =>
                  setActiveRoute(activeRoute === 'studio' ? 'dashboard' : 'studio')
                }
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <i className="fa-solid fa-user-check"></i>
                <span>
                  {activeRoute === 'studio'
                    ? `Dashboard (${userProfile?.displayName?.split(' ')[0] || 'Account'})`
                    : 'Back to Studio'}
                </span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setAuthMode('login');
                  setAuthError(null);
                  setShowAuthModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-indigo-600/25 transition flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <i className="fa-solid fa-right-to-bracket"></i>
                <span>Login / Sign Up</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Sub-navigation bar when signed in */}
      {currentUser && (
        <div className="bg-slate-900 text-slate-200 border-b border-slate-800 px-4 py-2 text-xs">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 overflow-x-auto">
              <button
                onClick={() => setActiveRoute('studio')}
                className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                  activeRoute === 'studio'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <i className="fa-solid fa-camera mr-1.5"></i>Photo Studio
              </button>
              <button
                onClick={() => setActiveRoute('dashboard')}
                className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                  activeRoute === 'dashboard'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <i className="fa-solid fa-table-columns mr-1.5"></i>My Dashboard ({appointments.length} Appts · {verifications.length} Docs)
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-slate-400 hidden sm:inline">
                Signed in as <strong className="text-white">{userProfile?.email}</strong>
              </span>
              <button
                onClick={handleSignOut}
                className="text-rose-300 hover:text-rose-200 font-bold whitespace-nowrap"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROUTE 1: PASSPORT STUDIO PRO WORKSPACE */}
      {activeRoute === 'studio' && (
        <>
          {/* Hero Banner (Exact match to passportstudiopro.netlify.app) */}
          <section className="bg-gradient-to-b from-white to-slate-50 border-b border-slate-200/80 py-4 px-4">
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-4">
              <div className="text-center lg:text-left">
                <div className="text-xs font-semibold text-indigo-600 font-malayalam mb-0.5">
                  പാസ്‌പോർട്ട് സൈസ് ഫോട്ടോ സ്റ്റുഡിയോ · Pro AI 300 DPI Studio
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Create Official Passport, Visa & ID Photos Instantly
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 font-malayalam">
                  ഫോട്ടോ അപ്‌ലോഡ് ചെയ്യൂ, ബാക്ക്ഗ്രൗണ്ട് കളർ മാറ്റൂ, ഇന്ത്യ, യുകെ, യുഎസ്, യുഎഇ തുടങ്ങി ഏത് രാജ്യത്തിന്റെയും പാസ്‌പോർട്ട് സൈസിലാക്കൂ!
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs font-medium text-slate-500 px-2">
                  Demo Photos:<br />
                  <span className="text-[10px] text-slate-400 font-malayalam">സാമ്പിൾ</span>
                </div>
                {[0, 1, 2].map((idx) => (
                  <button
                    key={idx}
                    onClick={() => loadSamplePortraitByIndex(idx, sampleThumbUrls[idx], false)}
                    className={`w-11 h-11 rounded-xl overflow-hidden border-2 transition hover:scale-105 ${
                      activeSampleIdx === idx
                        ? 'border-indigo-600'
                        : 'border-transparent hover:border-indigo-400'
                    }`}
                  >
                    {sampleThumbUrls[idx] ? (
                      <img
                        src={sampleThumbUrls[idx]}
                        alt={`Demo Portrait ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-200" />
                    )}
                  </button>
                ))}

                <div className="h-7 w-px bg-slate-200 mx-1"></div>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <i className="fa-solid fa-camera"></i>
                  <span>Upload Your Photo</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />

                <button
                  onClick={() => setShowExportModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <i className="fa-solid fa-download"></i>
                  <span>Download HD</span>
                </button>
              </div>
            </div>
          </section>

          {/* Main Studio Workspace */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT PANEL: Controls (3 Clean Tabs: Size, Background, Adjust) */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50/70 p-1.5 gap-1 text-xs font-semibold">
                  <button
                    onClick={() => setControlTab('size')}
                    className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
                      controlTab === 'size'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <i className="fa-solid fa-earth-americas"></i>
                    <span>Size / രാജ്യം</span>
                  </button>
                  <button
                    onClick={() => setControlTab('bg')}
                    className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
                      controlTab === 'bg'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <i className="fa-solid fa-palette"></i>
                    <span>Background</span>
                  </button>
                  <button
                    onClick={() => setControlTab('adjust')}
                    className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
                      controlTab === 'adjust'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <i className="fa-solid fa-sliders"></i>
                    <span>Adjust / നിറം</span>
                  </button>
                </div>

                {/* TAB 1: COUNTRY & CUSTOM SIZE */}
                {controlTab === 'size' && (
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">
                          Select Country or Custom Size
                        </h2>
                        <p className="text-xs text-slate-500 font-malayalam">
                          പാസ്‌പോർട്ട് അളവ് തിരഞ്ഞെടുക്കുക (300 DPI)
                        </p>
                      </div>
                      <span className="text-xs font-mono font-semibold text-indigo-700">
                        {wMmRounded} × {hMmRounded} mm
                      </span>
                    </div>

                    <div className="relative">
                      <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                      <input
                        type="text"
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        placeholder="Search India, UK, US, UAE, Schengen, PAN..."
                        className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                      />
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {filteredPresets.map((preset) => {
                        const isSelected = preset.id === selectedPresetId;
                        return (
                          <button
                            key={preset.id}
                            onClick={() => selectCountryPreset(preset.id)}
                            className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-indigo-50 border-indigo-600 ring-1 ring-indigo-600'
                                : 'bg-white hover:bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-2xl">{preset.flag}</span>
                              <div className="truncate">
                                <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                  {preset.country}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate">
                                  {preset.desc}
                                </div>
                              </div>
                            </div>
                            <span
                              className={`text-[11px] font-mono font-bold px-2 py-1 rounded-md shrink-0 ${
                                isSelected
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {preset.sheetCount} in 6×4"
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <i className="fa-solid fa-ruler-combined text-indigo-600"></i>
                          Custom Dimensions (കസ്റ്റം സൈസ്)
                        </span>
                        <select
                          value={customUnit}
                          onChange={(e) => {
                            const u = e.target.value as any;
                            setCustomUnit(u);
                            applyCustomSize(u, customWidthInput, customHeightInput, dpi);
                          }}
                          className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1 font-medium text-slate-700"
                        >
                          <option value="mm">mm (Millimeters)</option>
                          <option value="cm">cm (Centimeters)</option>
                          <option value="inch">inch (Inches)</option>
                          <option value="px">px (Pixels)</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">
                            Width (വീതി)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={customWidthInput}
                            onChange={(e) => {
                              setCustomWidthInput(e.target.value);
                              applyCustomSize(customUnit, e.target.value, customHeightInput, dpi);
                            }}
                            className="w-full px-2.5 py-1.5 text-sm font-mono font-semibold bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">
                            Height (ഉയരം)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={customHeightInput}
                            onChange={(e) => {
                              setCustomHeightInput(e.target.value);
                              applyCustomSize(customUnit, customWidthInput, e.target.value, dpi);
                            }}
                            className="w-full px-2.5 py-1.5 text-sm font-mono font-semibold bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">
                            DPI
                          </label>
                          <select
                            value={dpi}
                            onChange={(e) => {
                              const dVal = parseInt(e.target.value, 10) || 300;
                              setDpi(dVal);
                              applyCustomSize(customUnit, customWidthInput, customHeightInput, dVal);
                            }}
                            className="w-full px-2 py-1.5 text-sm font-mono font-semibold bg-white border border-slate-300 rounded-lg"
                          >
                            <option value={300}>300 DPI</option>
                            <option value={600}>600 DPI</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: BACKGROUND COLOR & ON-DEMAND AI CUTOUT */}
                {controlTab === 'bg' && (
                  <div className="p-5 space-y-5">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">
                        Background Color (ബാക്ക്ഗ്രൗണ്ട് നിറം)
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Choose official solid colors or custom shades
                      </p>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      {BG_SWATCHES.map((s) => {
                        const isSelected = bgColor.toLowerCase() === s.hex.toLowerCase();
                        return (
                          <button
                            key={s.name}
                            onClick={() => {
                              setBgColor(s.hex);
                              setBgName(s.name);
                            }}
                            className={`p-2 rounded-xl border text-left transition flex flex-col items-center gap-1.5 ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-500/30'
                                : 'border-slate-200 bg-white'
                            }`}
                          >
                            <span
                              className={`w-9 h-9 rounded-full shadow-inner border ${
                                s.hex === 'transparent' ? 'checkerboard' : ''
                              }`}
                              style={{
                                backgroundColor:
                                  s.hex === 'transparent' ? undefined : s.hex,
                                borderColor: s.border,
                              }}
                            ></span>
                            <div className="text-center">
                              <div className="text-[11px] font-bold text-slate-800 leading-tight">
                                {s.name}
                              </div>
                              <div className="text-[10px] text-slate-400 font-malayalam">
                                {s.mal}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="color"
                          value={bgColor === 'transparent' ? '#ffffff' : bgColor}
                          onChange={(e) => {
                            setBgColor(e.target.value);
                            setBgName('Custom Color');
                          }}
                          className="w-9 h-9 rounded-lg cursor-pointer border border-slate-300 bg-white p-0.5"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-800">
                            Custom Solid Color
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {bgColor === 'transparent'
                              ? 'Transparent PNG'
                              : `${bgColor.toUpperCase()} (${bgName})`}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-malayalam text-slate-500">
                        ഇഷ്ടമുള്ള നിറം
                      </span>
                    </div>

                    {/* On-Demand AI Background Removal Box */}
                    <div className="p-4 rounded-xl bg-indigo-50/90 border border-indigo-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                            <i className="fa-solid fa-wand-magic-sparkles text-indigo-600"></i>
                            AI Background Remover (RMBG-1.4)
                          </h3>
                          <p className="text-[11px] text-indigo-700 font-malayalam">
                            ബാക്ക്ഗ്രൗണ്ട് മാറ്റാൻ താഴെയുള്ള ബട്ടൺ അമർത്തുക
                          </p>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-800">
                          {aiStatusText}
                        </span>
                      </div>

                      <button
                        onClick={() => triggerManualAiCutout()}
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-wand-magic-sparkles"></i>
                        <span>Remove Background Now (AI Cutout)</span>
                      </button>

                      <div className="grid grid-cols-3 gap-1.5 bg-white p-1 rounded-xl border border-indigo-200 text-[11px] font-bold">
                        <button
                          onClick={() => handleSetCutoutEngine('rmbg')}
                          className={`py-1.5 px-2 rounded-lg transition text-center ${
                            cutoutEngine === 'rmbg'
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          AI Cutout
                        </button>
                        <button
                          onClick={() => handleSetCutoutEngine('removebg_api')}
                          className={`py-1.5 px-2 rounded-lg transition text-center ${
                            cutoutEngine === 'removebg_api'
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Cloud API
                        </button>
                        <button
                          onClick={() => handleSetCutoutEngine('original')}
                          className={`py-1.5 px-2 rounded-lg transition text-center ${
                            cutoutEngine === 'original'
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Original BG
                        </button>
                      </div>

                      <div className="space-y-2 pt-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-indigo-900">
                            Edge Sharpness (അരികുകൾ)
                          </span>
                          <span className="font-mono font-bold text-indigo-600">
                            {bgTolerance}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={50}
                          value={bgTolerance}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setBgTolerance(val);
                            applyEdgeRefinement(val);
                            renderAll();
                          }}
                          className="w-full h-1.5 bg-indigo-200 rounded-lg cursor-pointer"
                        />
                      </div>

                      {cutoutEngine === 'removebg_api' && (
                        <div className="space-y-2 pt-2 border-t border-indigo-200/70">
                          <label className="block text-[11px] font-bold text-indigo-950">
                            Remove.bg API Key
                          </label>
                          <div className="flex gap-1.5">
                            <input
                              type="password"
                              value={removeBgApiKey}
                              onChange={(e) => setRemoveBgApiKey(e.target.value)}
                              placeholder="Paste remove.bg API key..."
                              className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-indigo-300 rounded-lg"
                            />
                            <button
                              onClick={runRemoveBgCloudApi}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: ADJUST (100% Working Pixel-Level Brightness, Contrast & Color) */}
                {controlTab === 'adjust' && (
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">
                          Crop, Zoom & Color Adjustments
                        </h2>
                        <p className="text-xs text-slate-500 font-malayalam">
                          ഫോട്ടോയുടെ വലിപ്പവും നിറവും വെളിച്ചവും ക്രമീകരിക്കുക
                        </p>
                      </div>
                      <button
                        onClick={resetTransformAndFilters}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                      >
                        <i className="fa-solid fa-rotate-left"></i> Reset All
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={applyPassportHeadshotZoom}
                          className="py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition flex items-center justify-center gap-1.5"
                        >
                          <i className="fa-solid fa-user-check"></i> Auto Passport Zoom
                        </button>
                        <button
                          onClick={() => {
                            setZoom(100);
                            setPanX(0);
                            setPanY(0);
                          }}
                          className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5"
                        >
                          <i className="fa-solid fa-expand"></i> Reset Position
                        </button>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-slate-700">
                            <i className="fa-solid fa-magnifying-glass-plus mr-1 text-slate-400"></i>{' '}
                            Zoom (വലിപ്പം)
                          </span>
                          <span className="font-mono font-bold text-indigo-600">{zoom}%</span>
                        </div>
                        <input
                          type="range"
                          min={50}
                          max={280}
                          value={zoom}
                          onChange={(e) => setZoom(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-slate-700">
                            <i className="fa-solid fa-rotate mr-1 text-slate-400"></i> Rotate
                            (ചരിവ്)
                          </span>
                          <span className="font-mono font-bold text-indigo-600">
                            {rotate}°
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-20}
                          max={20}
                          step={0.5}
                          value={rotate}
                          onChange={(e) => setRotate(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-slate-700">
                            <i className="fa-solid fa-sun mr-1 text-amber-500"></i> Brightness
                            (വെളിച്ചം)
                          </span>
                          <span className="font-mono font-bold text-indigo-600">
                            {brightness}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={50}
                          max={150}
                          value={brightness}
                          onChange={(e) => setBrightness(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-slate-700">
                            <i className="fa-solid fa-circle-half-stroke mr-1 text-indigo-500"></i>{' '}
                            Contrast (തെളിച്ചം)
                          </span>
                          <span className="font-mono font-bold text-indigo-600">
                            {contrast}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={50}
                          max={150}
                          value={contrast}
                          onChange={(e) => setContrast(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-slate-700">
                            <i className="fa-solid fa-droplet mr-1 text-rose-500"></i> Color
                            Saturation (നിറം)
                          </span>
                          <span className="font-mono font-bold text-indigo-600">
                            {saturate}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={200}
                          value={saturate}
                          onChange={(e) => setSaturate(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT PANEL: Interactive Canvas Preview & Exact Print Sheet */}
              <div className="lg:col-span-7 space-y-5">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                      <button
                        onClick={() => setPreviewMode('single')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                          previewMode === 'single'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <i className="fa-solid fa-user-check text-indigo-600"></i>
                        <span>Single Photo</span>
                      </button>
                      <button
                        onClick={() => setPreviewMode('compare')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                          previewMode === 'compare'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <i className="fa-solid fa-columns text-indigo-600"></i>
                        <span>Original vs Cutout</span>
                      </button>
                      <button
                        onClick={() => setPreviewMode('sheet')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                          previewMode === 'sheet'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <i className="fa-solid fa-table-cells text-indigo-600"></i>
                        <span>6×4" Print Sheet (പ്രിന്റ് ഷീറ്റ്)</span>
                      </button>
                    </div>

                    {previewMode === 'single' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => triggerManualAiCutout()}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <i className="fa-solid fa-wand-magic-sparkles"></i> Remove BG
                        </button>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-xs font-medium text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                          <input
                            type="checkbox"
                            checked={showBiometricGrid}
                            onChange={(e) => setShowBiometricGrid(e.target.checked)}
                            className="rounded text-indigo-600"
                          />
                          <span>Grid</span>
                        </label>
                      </div>
                    )}

                    {previewMode === 'sheet' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                          <i className="fa-solid fa-print text-indigo-600 mr-1"></i>Paper: 6 × 4
                          inch (Studio 4R)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 1. SINGLE PASSPORT PHOTO WORKSPACE */}
                  <div
                    className={`${
                      previewMode === 'single' ? 'flex' : 'hidden'
                    } flex-col items-center justify-center py-3`}
                  >
                    <div className="relative group">
                      <div className="text-[11px] font-mono font-bold text-slate-500 text-center mb-2 flex items-center justify-center gap-2">
                        <span className="h-px w-8 bg-slate-300"></span>
                        <span>
                          {wMmRounded} mm ({wIn} in)
                        </span>
                        <span className="h-px w-8 bg-slate-300"></span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative rounded-xl overflow-hidden shadow-xl border-2 border-slate-300 checkerboard cursor-move select-none">
                          <canvas
                            ref={passportCanvasRef}
                            width={600}
                            height={600}
                            onMouseDown={handleCanvasMouseDown}
                            onWheel={handleCanvasWheel}
                            className="block max-h-[380px] w-auto"
                          />

                          {/* AI Progress Overlay */}
                          {aiLoading && (
                            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-white gap-3 z-20 p-6 text-center">
                              <i className="fa-solid fa-wand-magic-sparkles fa-bounce text-3xl text-indigo-400"></i>
                              <div className="text-xs sm:text-sm font-bold tracking-wide">
                                {aiLoadingMsg}
                              </div>
                              <div className="w-48 h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                                  style={{ width: `${aiProgress}%` }}
                                ></div>
                              </div>
                              <div className="text-[11px] text-slate-300 font-malayalam">
                                ദയവായി അല്പം കാത്തിരിക്കുക...
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="text-[11px] font-mono font-bold text-slate-500 [writing-mode:vertical-lr] rotate-180 flex items-center gap-2">
                          <span className="w-px h-8 bg-slate-300"></span>
                          <span>
                            {hMmRounded} mm ({hIn} in)
                          </span>
                          <span className="w-px h-8 bg-slate-300"></span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200/80">
                      <span className="flex items-center gap-1.5">
                        <i className="fa-solid fa-hand-pointer text-indigo-600"></i> Drag photo
                        to move • Scroll wheel to Zoom
                      </span>
                    </div>
                  </div>

                  {/* 2. SIDE-BY-SIDE "ORIGINAL VS CUTOUT" VIEW */}
                  <div
                    className={`${
                      previewMode === 'compare' ? 'grid' : 'hidden'
                    } grid-cols-1 sm:grid-cols-2 gap-4 py-3`}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-bold text-slate-700 mb-2">
                        Original Photo
                      </span>
                      <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 max-h-[360px] flex items-center justify-center">
                        {compareOriginalSrc && (
                          <img
                            src={compareOriginalSrc}
                            alt="Original"
                            referrerPolicy="no-referrer"
                            className="max-h-[350px] w-auto object-contain"
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-bold text-emerald-700 mb-2 flex items-center gap-1">
                        <i className="fa-solid fa-check-circle"></i> Processed Result
                      </span>
                      <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm checkerboard max-h-[360px] flex items-center justify-center">
                        <canvas
                          ref={compareCutoutCanvasRef}
                          className="max-h-[350px] w-auto object-contain"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. EXACT 6x4 PRINTABLE SHEET PREVIEW */}
                  <div
                    className={`${
                      previewMode === 'sheet' ? 'flex' : 'hidden'
                    } flex-col items-center justify-center py-3`}
                  >
                    <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200 shadow-inner max-w-full overflow-auto flex justify-center">
                      <canvas
                        ref={sheetCanvasRef}
                        className="bg-white shadow-lg rounded border border-slate-300 max-h-[390px] w-auto"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 w-full text-xs text-slate-600 px-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-mono font-extrabold text-xs">
                          {gridInfo.total} Photos
                        </span>
                        <span className="font-semibold text-slate-800">
                          Exact {gridInfo.total} Photos ({gridInfo.cols} × {gridInfo.rows} Grid)
                          on 6 × 4 inch Sheet
                        </span>
                      </div>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={showCutMarks}
                          onChange={(e) => setShowCutMarks(e.target.checked)}
                          className="rounded text-indigo-600"
                        />
                        <span>Show Cut Lines (കട്ട് ലൈനുകൾ)</span>
                      </label>
                    </div>
                  </div>

                  {/* Bottom Action Bar */}
                  <div className="mt-6 pt-5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                        <i className="fa-solid fa-check-double text-lg"></i>
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-slate-900">
                          {activePreset ? activePreset.country : 'Custom Size'} ({wMmRounded} ×{' '}
                          {hMmRounded} mm)
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          Output: {pxW} × {pxH} px @ {dpi} DPI • 6×4" Sheet: Exact{' '}
                          {gridInfo.total} Photos
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={handleSavePhotoToCloud}
                        disabled={isSavingCloudPhoto}
                        className="px-3.5 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <i className="fa-solid fa-cloud-arrow-up"></i>
                        <span>{isSavingCloudPhoto ? 'Saving...' : 'Save to Account'}</span>
                      </button>
                      <button
                        onClick={() => downloadSinglePhoto('png')}
                        className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
                      >
                        <i className="fa-solid fa-image"></i>
                        <span>Single Photo</span>
                      </button>
                      <button
                        onClick={downloadPrintSheet}
                        className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 whitespace-nowrap"
                      >
                        <i className="fa-solid fa-print"></i>
                        <span>Download 6×4" Sheet</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Portal Access Strip below Studio */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold text-indigo-600 uppercase tracking-wide">
                      Official Studio Services & User Dashboard
                    </div>
                    <h3 className="text-sm font-extrabold text-slate-900 mt-0.5">
                      Need physical studio prints, appointment booking, or document verification?
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Sign in with Email & Password or Google to manage your bookings and saved 300 DPI photos.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        if (!currentUser) {
                          setAuthMode('login');
                          setAuthError(null);
                          setShowAuthModal(true);
                        } else {
                          setActiveRoute('dashboard');
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition whitespace-nowrap"
                    >
                      Open My Dashboard →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </>
      )}

      {/* ROUTE 2: USER DASHBOARD */}
      {activeRoute === 'dashboard' && userProfile && (
        <main className="flex-1">
          <UserDashboard
            userProfile={userProfile}
            appointments={appointments}
            verifications={verifications}
            savedPhotos={savedPhotos}
            currentStudioPreviewUrl={currentStudioPreviewUrl}
            onBookAppointment={handleBookAppointment}
            onCancelAppointment={handleCancelAppointment}
            onSubmitVerification={handleSubmitVerification}
            onDeleteVerification={handleDeleteVerification}
            onDeleteSavedPhoto={handleDeleteSavedPhoto}
            onUpdateProfile={handleUpdateProfile}
            onNavigateToStudio={() => setActiveRoute('studio')}
          />
        </main>
      )}

      {/* Clean Professional Footer (Exact match to passportstudiopro.netlify.app) */}
      <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3.5 text-center md:text-left">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shrink-0">
                <i className="fa-solid fa-id-card-clip text-lg"></i>
              </div>
              <div>
                <div className="font-extrabold text-white text-base tracking-tight">
                  Passport<span className="text-indigo-400">Studio</span> Pro
                </div>
                <p className="text-xs text-slate-400">
                  Official Biometric Passport, Visa & ID Photo Maker (300 DPI Studio Standard)
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-800/90 border border-slate-700/80 px-5 py-3 rounded-2xl shadow-inner">
              <div className="text-center sm:text-left">
                <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  Site Designed and Created by
                </div>
                <div className="text-sm sm:text-base font-extrabold bg-gradient-to-r from-white via-indigo-200 to-indigo-300 bg-clip-text text-transparent">
                  Shalu M Abraham
                </div>
              </div>

              <div className="hidden sm:block h-8 w-px bg-slate-700"></div>

              <a
                href="https://www.instagram.com/shalumabraham/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-600 via-rose-500 to-amber-500 hover:opacity-95 text-white font-bold text-xs flex items-center gap-2 shadow-md transition"
              >
                <i className="fa-brands fa-instagram text-base"></i>
                <span>@shalumathewabraham</span>
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* HD Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                Download HD Passport Photo
              </h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Single Passport Photo (JPG)
                  </div>
                  <div className="text-[11px] text-slate-500">300 DPI Studio Quality</div>
                </div>
                <button
                  onClick={() => downloadSinglePhoto('jpeg')}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
                >
                  Download JPG
                </button>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Single Passport Photo (PNG)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Lossless / Transparent Ready
                  </div>
                </div>
                <button
                  onClick={() => downloadSinglePhoto('png')}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold"
                >
                  Download PNG
                </button>
              </div>
              <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-indigo-950">
                    6 × 4 inch Printable Sheet (JPG)
                  </div>
                  <div className="text-[11px] text-indigo-700">
                    Exact count fitted for 6×4" lab paper
                  </div>
                </div>
                <button
                  onClick={downloadPrintSheet}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
                >
                  Download 6×4"
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email & Password + Google Login / Sign Up Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <i className="fa-solid fa-id-card-clip"></i>
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {authMode === 'login'
                      ? 'Login to PassportStudio Pro'
                      : authMode === 'signup'
                      ? 'Create Your Studio Account'
                      : 'Reset Your Password'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Access your Dashboard, Appointments & Saved Photos
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAuthModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Segmented Mode Switch: Login vs Sign Up */}
            {authMode !== 'reset' && (
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError(null);
                  }}
                  className={`py-2 rounded-lg transition ${
                    authMode === 'login'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Login (लॉगिन)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setAuthError(null);
                  }}
                  className={`py-2 rounded-lg transition ${
                    authMode === 'signup'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sign Up (नया अकाउंट)
                </button>
              </div>
            )}

            {authError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {authError}
              </div>
            )}

            {/* Email & Password Form */}
            <form onSubmit={handleEmailPasswordAuth} className="space-y-3.5">
              {authMode === 'signup' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Full Name (पूरा नाम)
                    </label>
                    <input
                      type="text"
                      required
                      value={authFullName}
                      onChange={(e) => setAuthFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mobile Number (मोबाइल नंबर)
                    </label>
                    <input
                      type="tel"
                      value={authPhone}
                      onChange={(e) => setAuthPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email ID (ईमेल आईडी)
                </label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {authMode !== 'reset' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Password (पासवर्ड)
                    </label>
                    {authMode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('reset');
                          setAuthError(null);
                        }}
                        className="text-[11px] font-semibold text-indigo-600 hover:underline"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isAuthSubmitting}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-envelope"></i>
                <span>
                  {isAuthSubmitting
                    ? 'Please wait...'
                    : authMode === 'login'
                    ? 'Login with Email & Password'
                    : authMode === 'signup'
                    ? 'Create Account with Email'
                    : 'Send Password Reset Link'}
                </span>
              </button>

              {authMode === 'reset' && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError(null);
                  }}
                  className="w-full py-2 text-xs font-bold text-slate-600 hover:text-slate-900 text-center"
                >
                  ← Back to Login
                </button>
              )}
            </form>

            {authMode !== 'reset' && (
              <>
                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-3 text-[11px] font-semibold text-slate-400 uppercase">
                    Or Continue With
                  </span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2.5"
                >
                  <i className="fa-brands fa-google text-sm"></i>
                  <span>Sign in with Google</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <div
        className={`fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2.5 transition-all duration-300 pointer-events-none ${
          toastMsg ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
        }`}
      >
        <i className="fa-solid fa-circle-check text-emerald-400 text-sm"></i>
        <span>{toastMsg || 'Ready!'}</span>
      </div>
    </div>
  );
}
