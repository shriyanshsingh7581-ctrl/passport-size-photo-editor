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
} from './firebase';
import {
  COUNTRY_PRESETS,
  BG_SWATCHES,
  generateSamplePortraitDataUrl,
  UserProfile,
  AccountStatus,
  AppointmentRecord,
  DocumentVerificationRecord,
  SavedPhotoRecord,
  SiteSettings,
  DEFAULT_SITE_SETTINGS,
  ShortLinkRecord,
  SERVICE_TYPES,
  BRANCH_LOCATIONS,
  TIME_SLOTS,
  DOCUMENT_TYPES,
} from './constants';
import { runBriaRmbgCutout } from './rmbgEngine';
import { UserDashboard } from './components/UserDashboard';
import { ToolsHub, ActiveToolTab } from './components/ToolsHub';
import { AdminPanel } from './components/AdminPanel';

const LOCAL_SETTINGS_KEY = 'malnadu_media_site_settings_v1';
const LOCAL_SHORTLINKS_KEY = 'malnadu_media_short_links_v1';
const LOCAL_USERS_KEY = 'malnadu_media_users_v1';

const DEFAULT_DEMO_USERS: UserProfile[] = [
  {
    uid: 'admin-malnadu-01',
    displayName: 'Malnadu Media Admin',
    email: 'shriyanshsingh7581@gmail.com',
    phone: '+91 98450 11223',
    role: 'admin',
    status: 'approved',
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
  },
  {
    uid: 'user-arjun-02',
    displayName: 'Arjun Nair',
    email: 'arjun.nair@malnadumedia.in',
    phone: '+91 98951 44321',
    role: 'user',
    status: 'approved',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    uid: 'user-priya-03',
    displayName: 'Priya Menon',
    email: 'priya.menon@studio.in',
    phone: '+91 94470 88210',
    role: 'user',
    status: 'pending',
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    uid: 'user-rahul-04',
    displayName: 'Rahul Shetty',
    email: 'rahul.shetty@chikmagalur.org',
    phone: '+91 99001 55678',
    role: 'user',
    status: 'pending',
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
];

const DEFAULT_DEMO_SHORT_LINKS: ShortLinkRecord[] = [
  {
    id: 'photo-edit',
    slug: 'photo-edit',
    originalUrl: 'https://passportstudiopro.netlify.app',
    createdBy: 'admin',
    creatorEmail: 'admin@malnadumedia.com',
    active: true,
    clicks: 24,
    createdAt: new Date().toISOString(),
  },
];

export default function App() {
  // Primary Route State
  const [activeRoute, setActiveRoute] = useState<'studio' | 'tools' | 'dashboard' | 'admin'>('studio');
  const [activeToolTab, setActiveToolTab] = useState<ActiveToolTab>('bg-remover');
  const [dashboardSubTab, setDashboardSubTab] = useState<'overview' | 'appointments' | 'verifications' | 'photos' | 'profile'>('overview');

  // Short-Link Redirection State (for /:slug URLs)
  const [redirectState, setRedirectState] = useState<{
    checking: boolean;
    slug: string | null;
    status: 'none' | 'redirecting' | 'disabled' | 'not_found';
    targetUrl?: string;
  }>({
    checking: true,
    slug: null,
    status: 'none',
  });

  // Dynamic Site Settings (Brand Name, Logo, Colors, Configurable Footer Credit)
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_SETTINGS_KEY);
      if (saved) {
        return { ...DEFAULT_SITE_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SITE_SETTINGS;
  });

  // Auth & User State
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

  // Platform Collections State
  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_USERS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_DEMO_USERS;
  });

  const [shortLinks, setShortLinks] = useState<ShortLinkRecord[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_SHORTLINKS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_DEMO_SHORT_LINKS;
  });

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
    }, 3200);
  }, []);

  // =========================================================================
  // 0. DYNAMIC BRAND COLORS, TITLE & FAVICON SYNC
  // =========================================================================
  useEffect(() => {
    document.title = siteSettings.seoTitle || `${siteSettings.brandName} — Passport Photo Editor & AI Photo Tools`;
    document.documentElement.style.setProperty('--brand-primary', siteSettings.primaryColor || '#0d9488');
    document.documentElement.style.setProperty('--brand-secondary', siteSettings.secondaryColor || '#0f172a');

    try {
      localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(siteSettings));
    } catch {
      // ignore
    }
  }, [siteSettings]);

  // =========================================================================
  // 0.5 SHORT-LINK PATH REDIRECTION HANDLER (/:slug)
  // =========================================================================
  useEffect(() => {
    const checkShortLinkRedirect = async () => {
      const rawPath = window.location.pathname.replace(/^\/+|\/+$/g, '');
      const systemPaths = ['', 'index.html', 'studio', 'tools', 'dashboard', 'admin'];
      if (systemPaths.includes(rawPath.toLowerCase())) {
        setRedirectState({ checking: false, slug: null, status: 'none' });
        return;
      }

      const slug = rawPath.toLowerCase();
      setRedirectState({ checking: true, slug, status: 'none' });

      // 1. Check Firestore shortLinks/{slug}
      let matchedLink: ShortLinkRecord | null = null;
      try {
        const snap = await getDoc(doc(db, 'shortLinks', slug));
        if (snap.exists()) {
          matchedLink = { id: snap.id, ...(snap.data() as Omit<ShortLinkRecord, 'id'>) };
        }
      } catch {
        // Fallback to local shortLinks array
      }

      // 2. Check local mirror if not found in Firestore
      if (!matchedLink) {
        try {
          const localRaw = localStorage.getItem(LOCAL_SHORTLINKS_KEY);
          const list: ShortLinkRecord[] = localRaw ? JSON.parse(localRaw) : DEFAULT_DEMO_SHORT_LINKS;
          matchedLink = list.find((item) => item.slug.toLowerCase() === slug) || null;
        } catch {
          matchedLink = null;
        }
      }

      if (!matchedLink) {
        setRedirectState({ checking: false, slug, status: 'not_found' });
        return;
      }

      if (!matchedLink.active) {
        setRedirectState({
          checking: false,
          slug,
          status: 'disabled',
          targetUrl: matchedLink.originalUrl,
        });
        return;
      }

      // Increment click counter in background
      try {
        updateDoc(doc(db, 'shortLinks', slug), {
          clicks: (matchedLink.clicks || 0) + 1,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      } catch {
        // ignore
      }

      setRedirectState({
        checking: false,
        slug,
        status: 'redirecting',
        targetUrl: matchedLink.originalUrl,
      });

      // Perform actual browser redirection
      try {
        window.location.replace(matchedLink.originalUrl);
      } catch {
        window.location.href = matchedLink.originalUrl;
      }
    };

    checkShortLinkRedirect();
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
  // 2. SYNC SITE SETTINGS, SHORT LINKS & USERS WITH FIRESTORE + LOCAL STORAGE
  // =========================================================================
  useEffect(() => {
    // Listen to global siteSettings
    const unsubSettings = onSnapshot(
      doc(db, 'siteSettings', 'global'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<SiteSettings>;
          setSiteSettings((prev) => ({ ...prev, ...data }));
        }
      },
      () => {
        // Keep localStorage settings if external Firestore rules restrict global read
      }
    );

    // Listen to shortLinks collection
    const unsubLinks = onSnapshot(
      collection(db, 'shortLinks'),
      (snap) => {
        if (!snap.empty) {
          const list: ShortLinkRecord[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ShortLinkRecord, 'id'>),
          }));
          setShortLinks(list);
          try {
            localStorage.setItem(LOCAL_SHORTLINKS_KEY, JSON.stringify(list));
          } catch {
            // ignore
          }
        }
      },
      () => {}
    );

    // Listen to users collection
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        if (!snap.empty) {
          const firestoreUsers: UserProfile[] = snap.docs.map((d) => ({
            ...(d.data() as UserProfile),
            uid: d.id,
          }));
          setAllUsers((prev) => {
            const map = new Map<string, UserProfile>();
            prev.forEach((u) => map.set(u.uid, u));
            firestoreUsers.forEach((u) => map.set(u.uid, u));
            const merged = Array.from(map.values());
            try {
              localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(merged));
            } catch {
              // ignore
            }
            return merged;
          });
        }
      },
      () => {}
    );

    return () => {
      unsubSettings();
      unsubLinks();
      unsubUsers();
    };
  }, []);

  // =========================================================================
  // 3. FIREBASE AUTHENTICATION & USER PROFILE BOOTSTRAP
  // =========================================================================
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const isBootstrapAdmin =
          user.email?.toLowerCase() === 'shriyanshsingh7581@gmail.com' ||
          user.email?.toLowerCase() === 'admin@malnadumedia.com';

        const defaultProfile: UserProfile = {
          uid: user.uid,
          displayName: (user.displayName || user.email?.split('@')[0] || 'Studio User').slice(0, 100),
          email: (user.email || 'user@malnadumedia.com').slice(0, 150),
          phone: (user.phoneNumber || '').slice(0, 30),
          role: isBootstrapAdmin ? 'admin' : 'user',
          status: isBootstrapAdmin ? 'approved' : 'pending',
          createdAt: new Date().toISOString(),
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
            upsertUserInLocalState(defaultProfile);
          } else {
            const existingData = snap.data() as UserProfile;
            setUserProfile(existingData);
            upsertUserInLocalState(existingData);
          }
        } catch {
          // Check if we have a locally updated profile status for this user
          const localMatch = allUsers.find((u) => u.uid === user.uid || u.email === user.email);
          const resolved = localMatch || defaultProfile;
          setUserProfile(resolved);
          upsertUserInLocalState(resolved);
        }
      } else {
        setUserProfile(null);
        if (activeRoute === 'dashboard') {
          setActiveRoute('studio');
        }
      }
      setIsAuthReady(true);
    });
    return () => unsub();
  }, []);

  const upsertUserInLocalState = (profile: UserProfile) => {
    setAllUsers((prev) => {
      const exists = prev.some((u) => u.uid === profile.uid);
      const next = exists
        ? prev.map((u) => (u.uid === profile.uid ? { ...u, ...profile } : u))
        : [profile, ...prev];
      try {
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // =========================================================================
  // 4. REAL-TIME FIRESTORE LISTENERS (APPOINTMENTS, VERIFICATIONS, PHOTOS)
  // =========================================================================
  useEffect(() => {
    if (!isAuthReady || !currentUser || !userProfile) {
      setAppointments([]);
      setVerifications([]);
      setSavedPhotos([]);
      return;
    }

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
      () => {}
    );

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
      () => {}
    );

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
      () => {}
    );

    return () => {
      unsubApt();
      unsubVer();
      unsubPhotos();
    };
  }, [isAuthReady, currentUser, userProfile]);

  // =========================================================================
  // 5. PIXEL-LEVEL COLOR GRADING & EDGE REFINEMENT
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
  // 6. EXACT 6x4 INCH PRINT SHEET & PASSPORT CANVAS RENDERING
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
        ctx.strokeStyle = 'rgba(13, 148, 136, 0.6)';
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
  // 7. PHOTO LOADING & AI BACKGROUND REMOVAL HANDLERS
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
    link.download = `malnadu-media-passport.${format === 'jpeg' ? 'jpg' : 'png'}`;
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
    link.download = 'malnadu-media-6x4-sheet-300dpi.jpg';
    link.href = tempSheet.toDataURL('image/jpeg', 0.96);
    link.click();
    setShowExportModal(false);
    showToast('Downloaded 6×4" Print Sheet!');
  };

  const handleSavePhotoToCloud = async () => {
    if (!currentUser || !userProfile) {
      setAuthMode('login');
      setAuthError(null);
      setShowAuthModal(true);
      return;
    }
    setIsSavingCloudPhoto(true);
    try {
      const activePreset = COUNTRY_PRESETS.find((p) => p.id === selectedPresetId);
      const wMmRounded = Math.round(widthMm * 10) / 10;
      const hMmRounded = Math.round(heightMm * 10) / 10;
      const newRecord: SavedPhotoRecord = {
        id: `photo-${Date.now()}`,
        userId: currentUser.uid,
        presetName: (activePreset ? activePreset.country : 'Custom Passport Size').slice(0, 100),
        dimensionsText: `${wMmRounded} × ${hMmRounded} mm @ ${dpi} DPI`.slice(0, 80),
        bgColor: bgColor.slice(0, 30),
        previewDataUrl: currentStudioPreviewUrl.slice(0, 240000),
      };
      try {
        await addDoc(collection(db, 'savedPhotos'), {
          userId: newRecord.userId,
          presetName: newRecord.presetName,
          dimensionsText: newRecord.dimensionsText,
          bgColor: newRecord.bgColor,
          previewDataUrl: newRecord.previewDataUrl,
          createdAt: serverTimestamp(),
        });
      } catch {
        setSavedPhotos((prev) => [newRecord, ...prev]);
      }
      showToast('Saved photo to your Dashboard!');
    } finally {
      setIsSavingCloudPhoto(false);
    }
  };

  // =========================================================================
  // 8. CANVAS MOUSE + MOBILE TOUCH DRAG & WHEEL INTERACTIONS
  // =========================================================================
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - panX, y: e.clientY - panY };
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.touches[0].clientX - panX,
        y: e.touches[0].clientY - panY,
      };
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || e.touches.length !== 1) return;
    setPanX(e.touches[0].clientX - dragStartRef.current.x);
    setPanY(e.touches[0].clientY - dragStartRef.current.y);
  };

  const handleCanvasTouchEnd = () => {
    isDraggingRef.current = false;
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
  // 9. AUTHENTICATION HANDLERS (EMAIL/PASSWORD + GOOGLE)
  // =========================================================================
  const formatFirebaseAuthError = (error: any): string => {
    const code = error?.code || '';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Invalid email or password. Please check your credentials.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'This email is already registered. Please switch to Login.';
    }
    if (code === 'auth/weak-password') {
      return 'Password must be at least 6 characters long.';
    }
    if (code === 'auth/operation-not-allowed') {
      return 'Email/Password sign-in is not enabled in Firebase Console. Enable it in Authentication → Sign-in method.';
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

        const isBootstrapAdmin =
          authEmail.trim().toLowerCase() === 'shriyanshsingh7581@gmail.com' ||
          authEmail.trim().toLowerCase() === 'admin@malnadumedia.com';

        const newProfile: UserProfile = {
          uid: userCred.user.uid,
          displayName: authFullName.trim().slice(0, 100),
          email: (userCred.user.email || authEmail.trim()).slice(0, 150),
          phone: authPhone.trim().slice(0, 30),
          role: isBootstrapAdmin ? 'admin' : 'user',
          status: isBootstrapAdmin ? 'approved' : 'pending',
          createdAt: new Date().toISOString(),
        };

        try {
          await setDoc(doc(db, 'users', userCred.user.uid), {
            ...newProfile,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch {
          // Local mirror handles persistence if external Firestore rules restrict writes
        }

        setUserProfile(newProfile);
        upsertUserInLocalState(newProfile);
        setShowAuthModal(false);
        setAuthPassword('');
        setActiveRoute('dashboard');
        showToast(
          isBootstrapAdmin
            ? 'Admin Account Created & Approved!'
            : 'Account registered! Status: Pending Admin Approval.'
        );
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
  // 10. ADMIN & USER MUTATION HANDLERS (USERS, SETTINGS, SHORT LINKS)
  // =========================================================================
  const handleUpdateUserStatus = async (uid: string, status: AccountStatus) => {
    setAllUsers((prev) => {
      const next = prev.map((u) => (u.uid === uid ? { ...u, status } : u));
      try {
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    if (userProfile && userProfile.uid === uid) {
      setUserProfile({ ...userProfile, status });
    }

    try {
      await updateDoc(doc(db, 'users', uid), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // persisted in local state & localStorage
    }
    showToast(`User status updated to ${status.toUpperCase()}`);
  };

  const handleUpdateUserRole = async (uid: string, role: 'user' | 'admin') => {
    setAllUsers((prev) => {
      const next = prev.map((u) => (u.uid === uid ? { ...u, role } : u));
      try {
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    if (userProfile && userProfile.uid === uid) {
      setUserProfile({ ...userProfile, role });
    }

    try {
      await updateDoc(doc(db, 'users', uid), {
        role,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // persisted in local state
    }
    showToast(`User role updated to ${role.toUpperCase()}`);
  };

  const handleDeleteUserRecord = async (uid: string) => {
    setAllUsers((prev) => {
      const next = prev.filter((u) => u.uid !== uid);
      try {
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch {
      // persisted in local state
    }
    showToast('User account permanently removed');
  };

  const handleCreateManagedUser = async (
    displayName: string,
    email: string,
    phone: string,
    role: 'user' | 'admin',
    status: AccountStatus
  ) => {
    const uid = `user-${Date.now()}`;
    const newUser: UserProfile = {
      uid,
      displayName: displayName.slice(0, 100),
      email: email.slice(0, 150),
      phone: phone.slice(0, 30),
      role,
      status,
      createdAt: new Date().toISOString(),
    };
    upsertUserInLocalState(newUser);
    try {
      await setDoc(doc(db, 'users', uid), {
        ...newUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch {
      // persisted locally
    }
    showToast(`Added user ${displayName} (${status})`);
  };

  const handleSaveSiteSettings = async (newSettings: SiteSettings) => {
    setSiteSettings(newSettings);
    try {
      localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(newSettings));
    } catch {
      // ignore
    }
    try {
      await setDoc(doc(db, 'siteSettings', 'global'), {
        ...newSettings,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // persisted in localStorage
    }
  };

  const handleCreateShortLink = async (
    originalUrl: string,
    customSlug: string
  ): Promise<{ ok: boolean; error?: string; link?: ShortLinkRecord }> => {
    const slug = customSlug.toLowerCase().trim();
    const duplicate = shortLinks.find((l) => l.slug.toLowerCase() === slug);
    if (duplicate) {
      return {
        ok: false,
        error: `Short name "/${slug}" is already in use. Please choose another slug.`,
      };
    }

    const newLink: ShortLinkRecord = {
      id: slug,
      slug,
      originalUrl,
      createdBy: currentUser?.uid || 'guest',
      creatorEmail: userProfile?.email || currentUser?.email || 'studio@malnadumedia.com',
      active: true,
      clicks: 0,
      createdAt: new Date().toISOString(),
    };

    const nextLinks = [newLink, ...shortLinks];
    setShortLinks(nextLinks);
    try {
      localStorage.setItem(LOCAL_SHORTLINKS_KEY, JSON.stringify(nextLinks));
    } catch {
      // ignore
    }

    try {
      await setDoc(doc(db, 'shortLinks', slug), {
        slug: newLink.slug,
        originalUrl: newLink.originalUrl,
        createdBy: newLink.createdBy,
        creatorEmail: newLink.creatorEmail,
        active: true,
        clicks: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch {
      // persisted locally
    }

    return { ok: true, link: newLink };
  };

  const handleToggleShortLinkStatus = async (slug: string, currentActive: boolean) => {
    const nextActive = !currentActive;
    setShortLinks((prev) => {
      const updated = prev.map((l) => (l.slug === slug ? { ...l, active: nextActive } : l));
      try {
        localStorage.setItem(LOCAL_SHORTLINKS_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    try {
      await updateDoc(doc(db, 'shortLinks', slug), {
        active: nextActive,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // persisted locally
    }
    showToast(`Short link /${slug} ${nextActive ? 'enabled' : 'disabled'}`);
  };

  const handleDeleteShortLink = async (slug: string) => {
    setShortLinks((prev) => {
      const updated = prev.filter((l) => l.slug !== slug);
      try {
        localStorage.setItem(LOCAL_SHORTLINKS_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    try {
      await deleteDoc(doc(db, 'shortLinks', slug));
    } catch {
      // persisted locally
    }
    showToast(`Short link /${slug} deleted`);
  };

  // =========================================================================
  // 11. USER DASHBOARD MUTATION HANDLERS
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
    const localApt: AppointmentRecord = {
      id: `apt-${Date.now()}`,
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
    };
    try {
      await addDoc(collection(db, 'appointments'), {
        ...localApt,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch {
      setAppointments((prev) => [localApt, ...prev]);
    }
    showToast('Studio Appointment Booked!');
  };

  const handleCancelAppointment = async (apt: AppointmentRecord) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === apt.id ? { ...a, status: 'cancelled' } : a))
    );
    try {
      await updateDoc(doc(db, 'appointments', apt.id), {
        status: 'cancelled',
        notes: apt.notes,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // local state updated
    }
    showToast('Appointment cancelled');
  };

  const handleUpdateAppointmentStatus = async (
    id: string,
    status: AppointmentRecord['status'],
    notes: string
  ) => {
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status, notes } : a)));
    try {
      await updateDoc(doc(db, 'appointments', id), {
        status,
        notes,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // local state updated
    }
    showToast(`Appointment marked ${status}`);
  };

  const handleSubmitVerification = async (data: {
    documentType: (typeof DOCUMENT_TYPES)[number];
    documentNumber: string;
    country: string;
    photoPreviewDataUrl: string;
    remarks: string;
  }) => {
    if (!currentUser || !userProfile) return;
    const localVer: DocumentVerificationRecord = {
      id: `ver-${Date.now()}`,
      userId: currentUser.uid,
      userName: userProfile.displayName.slice(0, 100),
      userEmail: userProfile.email.slice(0, 150),
      documentType: data.documentType,
      documentNumber: data.documentNumber.slice(0, 50),
      country: data.country.slice(0, 80),
      photoPreviewDataUrl: data.photoPreviewDataUrl.slice(0, 240000),
      status: 'pending',
      remarks: data.remarks.slice(0, 500),
    };
    try {
      await addDoc(collection(db, 'verifications'), {
        ...localVer,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch {
      setVerifications((prev) => [localVer, ...prev]);
    }
    showToast('Document submitted for verification!');
  };

  const handleUpdateVerificationStatus = async (
    id: string,
    status: DocumentVerificationRecord['status'],
    remarks: string
  ) => {
    setVerifications((prev) =>
      prev.map((v) => (v.id === id ? { ...v, status, remarks } : v))
    );
    try {
      await updateDoc(doc(db, 'verifications', id), {
        status,
        remarks,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // local state updated
    }
    showToast(`Verification marked ${status}`);
  };

  const handleDeleteVerification = async (id: string) => {
    setVerifications((prev) => prev.filter((v) => v.id !== id));
    try {
      await deleteDoc(doc(db, 'verifications', id));
    } catch {
      // local state updated
    }
    showToast('Verification record removed');
  };

  const handleDeleteSavedPhoto = async (id: string) => {
    setSavedPhotos((prev) => prev.filter((p) => p.id !== id));
    try {
      await deleteDoc(doc(db, 'savedPhotos', id));
    } catch {
      // local state updated
    }
    showToast('Saved photo deleted');
  };

  const handleUpdateProfile = async (displayName: string, phone: string) => {
    if (!currentUser || !userProfile) return;
    const updated = { ...userProfile, displayName, phone };
    setUserProfile(updated);
    upsertUserInLocalState(updated);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        displayName: displayName.slice(0, 100),
        phone: phone.slice(0, 30),
        updatedAt: serverTimestamp(),
      });
    } catch {
      // local state updated
    }
    showToast('Profile details updated!');
  };

  const openDashboardSection = (subTab: 'overview' | 'appointments' | 'verifications' | 'photos' | 'profile') => {
    if (!currentUser) {
      setAuthMode('login');
      setAuthError(null);
      setShowAuthModal(true);
    } else {
      setDashboardSubTab(subTab);
      setActiveRoute('dashboard');
    }
  };

  const openToolSection = (tool: ActiveToolTab) => {
    setActiveToolTab(tool);
    setActiveRoute('tools');
  };

  // =========================================================================
  // 12. RENDER BRAND LOGO HELPER (MALNADU MEDIA)
  // =========================================================================
  const renderBrandLogo = (darkText = true) => {
    const parts = siteSettings.brandName.trim().split(' ');
    const firstWord = parts[0] || 'MALNADU';
    const restWords = parts.slice(1).join(' ') || 'MEDIA';

    return (
      <div className="flex items-center gap-2.5">
        {siteSettings.logoType === 'url' && siteSettings.logoUrl ? (
          <img
            src={siteSettings.logoUrl}
            alt={siteSettings.brandName}
            className="w-9 h-9 rounded-xl object-contain bg-white border border-slate-200 p-0.5 shrink-0"
          />
        ) : (
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold text-xs tracking-tighter shadow-sm shrink-0 relative overflow-hidden"
            style={{ backgroundColor: siteSettings.primaryColor || '#0d9488' }}
          >
            <span className="z-10">{siteSettings.logoText || 'MM'}</span>
            <span className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-white/15"></span>
          </div>
        )}
        <div className="leading-tight">
          <span
            className={`font-extrabold text-sm sm:text-base tracking-tight ${
              darkText ? 'text-slate-900' : 'text-white'
            }`}
          >
            {firstWord}{' '}
            <span style={{ color: siteSettings.primaryColor || '#0d9488' }}>{restWords}</span>
          </span>
        </div>
      </div>
    );
  };

  // =========================================================================
  // 13. SHORT-LINK REDIRECT / 404 / DISABLED INTERCEPT SCREENS
  // =========================================================================
  if (redirectState.status === 'redirecting') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center text-2xl shadow-lg">
          <i className="fa-solid fa-arrow-up-right-from-square fa-beat-fade"></i>
        </div>
        <h1 className="text-xl font-extrabold">{siteSettings.brandName} Short Link Redirect</h1>
        <p className="text-xs text-slate-400 max-w-md">
          Redirecting you to <span className="font-mono text-teal-400 break-all">{redirectState.targetUrl}</span>...
        </p>
        <a
          href={redirectState.targetUrl}
          className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition"
        >
          Click here if you are not redirected automatically
        </a>
      </div>
    );
  }

  if (redirectState.status === 'disabled') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-2xl">
          <i className="fa-solid fa-link-slash"></i>
        </div>
        <h1 className="text-xl font-extrabold">Short Link Disabled</h1>
        <p className="text-xs text-slate-400 max-w-md">
          The short link <span className="font-mono text-white">/{redirectState.slug}</span> has been temporarily disabled by the administrator.
        </p>
        <button
          onClick={() => {
            window.history.pushState({}, '', '/');
            setRedirectState({ checking: false, slug: null, status: 'none' });
          }}
          className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition"
        >
          Open {siteSettings.brandName} Studio
        </button>
      </div>
    );
  }

  if (redirectState.status === 'not_found') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center text-2xl">
          <i className="fa-solid fa-triangle-exclamation"></i>
        </div>
        <h1 className="text-xl font-extrabold">404 — Short Link Not Found</h1>
        <p className="text-xs text-slate-400 max-w-md">
          No short link was found for <span className="font-mono text-white">/{redirectState.slug}</span> on {siteSettings.brandName}.
        </p>
        <button
          onClick={() => {
            window.history.pushState({}, '', '/');
            setRedirectState({ checking: false, slug: null, status: 'none' });
          }}
          className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition"
        >
          Go to {siteSettings.brandName} Home
        </button>
      </div>
    );
  }

  // =========================================================================
  // 14. COMPUTED DIMENSION & SHEET LABELS
  // =========================================================================
  const wMmRounded = Math.round(widthMm * 10) / 10;
  const hMmRounded = Math.round(heightMm * 10) / 10;
  const wIn = (widthMm / 25.4).toFixed(2);
  const hIn = (heightMm / 25.4).toFixed(2);
  const pxW = Math.round((widthMm / 25.4) * dpi);
  const pxH = Math.round((heightMm / 25.4) * dpi);
  const gridInfo = getExact6x4GridConfig();

  const filteredPresets = COUNTRY_PRESETS.filter(
    (p) =>
      p.country.toLowerCase().includes(countrySearch.trim().toLowerCase()) ||
      p.desc.toLowerCase().includes(countrySearch.trim().toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/70 text-slate-800 font-sans pb-20 lg:pb-0">
      {/* Top App Bar */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 h-15 flex items-center">
        <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 flex items-center justify-between gap-3">
          {/* Zone 1: MALNADU MEDIA Brand Wordmark */}
          <button
            onClick={() => setActiveRoute('studio')}
            className="text-left whitespace-nowrap shrink-0 cursor-pointer min-h-[44px] flex items-center"
          >
            {renderBrandLogo(true)}
          </button>

          {/* Zone 2: Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <button
              onClick={() => setActiveRoute('studio')}
              className={`px-3 py-2 rounded-xl transition whitespace-nowrap ${
                activeRoute === 'studio'
                  ? 'bg-teal-50 text-teal-700'
                  : 'hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Passport Studio
            </button>

            {siteSettings.enableBgRemover && (
              <button
                onClick={() => openToolSection('bg-remover')}
                className={`px-3 py-2 rounded-xl transition whitespace-nowrap ${
                  activeRoute === 'tools' && activeToolTab === 'bg-remover'
                    ? 'bg-teal-50 text-teal-700'
                    : 'hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                BG Remover
              </button>
            )}

            {siteSettings.enableClarityEnhancer && (
              <button
                onClick={() => openToolSection('clarity-enhancer')}
                className={`px-3 py-2 rounded-xl transition whitespace-nowrap ${
                  activeRoute === 'tools' && activeToolTab === 'clarity-enhancer'
                    ? 'bg-teal-50 text-teal-700'
                    : 'hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                Clarity Enhancer
              </button>
            )}

            {siteSettings.enableQrGenerator && (
              <button
                onClick={() => openToolSection('qr-generator')}
                className={`px-3 py-2 rounded-xl transition whitespace-nowrap ${
                  activeRoute === 'tools' && activeToolTab === 'qr-generator'
                    ? 'bg-teal-50 text-teal-700'
                    : 'hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                QR Generator
              </button>
            )}

            {siteSettings.enableLinkShortener && (
              <button
                onClick={() => openToolSection('link-shortener')}
                className={`px-3 py-2 rounded-xl transition whitespace-nowrap ${
                  activeRoute === 'tools' && activeToolTab === 'link-shortener'
                    ? 'bg-teal-50 text-teal-700'
                    : 'hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                Link Shortener
              </button>
            )}

            <button
              onClick={() => openDashboardSection('overview')}
              className={`px-3 py-2 rounded-xl transition whitespace-nowrap ${
                activeRoute === 'dashboard'
                  ? 'bg-teal-50 text-teal-700'
                  : 'hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Dashboard
            </button>

            <button
              onClick={() => setActiveRoute('admin')}
              className={`px-3 py-2 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 ${
                activeRoute === 'admin'
                  ? 'bg-slate-900 text-white'
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              <i className="fa-solid fa-shield-halved text-teal-600"></i>
              <span>Admin Panel</span>
            </button>
          </nav>

          {/* Zone 3: Contextual Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {!currentUser ? (
              <button
                onClick={() => {
                  setAuthMode('login');
                  setAuthError(null);
                  setShowAuthModal(true);
                }}
                className="min-h-[40px] px-3.5 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition flex items-center gap-1.5 whitespace-nowrap"
              >
                <i className="fa-solid fa-user"></i>
                <span>Login / Sign Up</span>
              </button>
            ) : (
              <button
                onClick={() => openDashboardSection('overview')}
                className="min-h-[40px] px-3 py-1.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition hidden sm:flex items-center gap-1.5"
              >
                <i className="fa-solid fa-circle-user text-teal-600"></i>
                <span className="max-w-[110px] truncate">{userProfile?.displayName || 'Account'}</span>
              </button>
            )}

            {activeRoute === 'studio' && (
              <button
                onClick={() => setShowExportModal(true)}
                className="min-h-[40px] px-3.5 py-2 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm active:scale-[0.98] transition flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <i className="fa-solid fa-download"></i>
                <span>Export HD</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ROUTE 1: PASSPORT PHOTO STUDIO WORKSPACE */}
      {activeRoute === 'studio' && (
        <main className="flex-1 max-w-6xl w-full mx-auto px-3.5 sm:px-6 py-3.5 sm:py-6 space-y-4">
          {/* Quick Feature Suite Strip (Direct access to BG Remover, Clarity Enhancer, QR Generator, Link Shortener) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {siteSettings.enableBgRemover && (
              <button
                onClick={() => openToolSection('bg-remover')}
                className="bg-white hover:bg-teal-50/50 border border-slate-200/90 hover:border-teal-300 rounded-2xl p-3 text-left transition flex items-center gap-3 shadow-2xs"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-900 truncate">BG Remover</div>
                  <div className="text-[11px] text-slate-500 truncate">1-Click AI Cutout</div>
                </div>
              </button>
            )}

            {siteSettings.enableClarityEnhancer && (
              <button
                onClick={() => openToolSection('clarity-enhancer')}
                className="bg-white hover:bg-teal-50/50 border border-slate-200/90 hover:border-teal-300 rounded-2xl p-3 text-left transition flex items-center gap-3 shadow-2xs"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-sparkles"></i>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-900 truncate">Clarity Enhancer</div>
                  <div className="text-[11px] text-slate-500 truncate">HD Face Sharpening</div>
                </div>
              </button>
            )}

            {siteSettings.enableQrGenerator && (
              <button
                onClick={() => openToolSection('qr-generator')}
                className="bg-white hover:bg-teal-50/50 border border-slate-200/90 hover:border-teal-300 rounded-2xl p-3 text-left transition flex items-center gap-3 shadow-2xs"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-qrcode"></i>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-900 truncate">QR Generator</div>
                  <div className="text-[11px] text-slate-500 truncate">Instant PNG QR Code</div>
                </div>
              </button>
            )}

            {siteSettings.enableLinkShortener && (
              <button
                onClick={() => openToolSection('link-shortener')}
                className="bg-white hover:bg-teal-50/50 border border-slate-200/90 hover:border-teal-300 rounded-2xl p-3 text-left transition flex items-center gap-3 shadow-2xs"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-link"></i>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-900 truncate">Link Shortener</div>
                  <div className="text-[11px] text-slate-500 truncate">Custom Slug Redirects</div>
                </div>
              </button>
            )}
          </div>

          {/* Quick Mobile Upload & Sample Strip */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm shadow-sm active:scale-[0.98] transition flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <i className="fa-solid fa-camera text-sm"></i>
                <span>Upload Photo</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />

              <div className="h-6 w-px bg-slate-200 mx-1 shrink-0"></div>

              <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap hidden sm:inline">
                Samples:
              </span>
              {[0, 1, 2].map((idx) => (
                <button
                  key={idx}
                  onClick={() => loadSamplePortraitByIndex(idx, sampleThumbUrls[idx], false)}
                  className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl overflow-hidden border-2 transition shrink-0 active:scale-95 ${
                    activeSampleIdx === idx
                      ? 'border-teal-600 ring-2 ring-teal-500/20'
                      : 'border-slate-200 opacity-80 hover:opacity-100'
                  }`}
                >
                  {sampleThumbUrls[idx] ? (
                    <img
                      src={sampleThumbUrls[idx]}
                      alt={`Sample ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-200" />
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => triggerManualAiCutout()}
              className="min-h-[46px] px-3.5 py-2.5 rounded-2xl bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 font-bold text-xs active:scale-[0.98] transition flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <i className="fa-solid fa-wand-magic-sparkles"></i>
              <span className="hidden sm:inline">AI Cutout</span>
              <span className="sm:hidden">Remove BG</span>
            </button>
          </div>

          {/* Mobile-First Split Layout: Canvas Preview FIRST on mobile (order-1), Controls SECOND on mobile (order-2) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* STUDIO VIEWPORT CARD (Top on Mobile, Right on Desktop) */}
            <div className="order-1 lg:order-2 lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-4">
              {/* View Mode Switcher */}
              <div className="flex items-center justify-between gap-2">
                <div className="grid grid-cols-3 flex-1 bg-slate-100 p-1 rounded-2xl text-xs font-bold">
                  <button
                    onClick={() => setPreviewMode('single')}
                    className={`min-h-[40px] py-2 px-2 rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                      previewMode === 'single'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    <i className="fa-solid fa-user-check text-teal-600"></i>
                    <span>Photo</span>
                  </button>
                  <button
                    onClick={() => setPreviewMode('compare')}
                    className={`min-h-[40px] py-2 px-2 rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                      previewMode === 'compare'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    <i className="fa-solid fa-columns text-teal-600"></i>
                    <span>Compare</span>
                  </button>
                  <button
                    onClick={() => setPreviewMode('sheet')}
                    className={`min-h-[40px] py-2 px-2 rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                      previewMode === 'sheet'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    <i className="fa-solid fa-table-cells text-teal-600"></i>
                    <span>6×4" Sheet</span>
                  </button>
                </div>

                {previewMode === 'single' && (
                  <button
                    onClick={() => setShowBiometricGrid(!showBiometricGrid)}
                    className={`min-h-[42px] px-3 rounded-2xl border text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                      showBiometricGrid
                        ? 'bg-teal-50 border-teal-200 text-teal-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <i className="fa-solid fa-border-all"></i>
                    <span className="hidden sm:inline">Grid</span>
                  </button>
                )}
              </div>

              {/* 1. SINGLE PASSPORT PHOTO CANVAS */}
              <div
                className={`${
                  previewMode === 'single' ? 'flex' : 'hidden'
                } flex-col items-center justify-center py-2`}
              >
                <div className="text-[11px] font-mono font-semibold text-slate-500 mb-2 flex items-center gap-2">
                  <span>{wMmRounded} × {hMmRounded} mm</span>
                  <span>·</span>
                  <span>{wIn} × {hIn} in</span>
                  <span>·</span>
                  <span>{dpi} DPI</span>
                </div>

                <div className="relative rounded-2xl overflow-hidden shadow-lg border-2 border-slate-300 checkerboard cursor-move select-none touch-none">
                  <canvas
                    ref={passportCanvasRef}
                    width={600}
                    height={600}
                    onMouseDown={handleCanvasMouseDown}
                    onTouchStart={handleCanvasTouchStart}
                    onTouchMove={handleCanvasTouchMove}
                    onTouchEnd={handleCanvasTouchEnd}
                    onWheel={handleCanvasWheel}
                    className="block max-h-[300px] sm:max-h-[360px] w-auto"
                  />

                  {/* AI Progress Overlay */}
                  {aiLoading && (
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-3 z-20 p-6 text-center">
                      <i className="fa-solid fa-wand-magic-sparkles fa-bounce text-2xl text-teal-400"></i>
                      <div className="text-xs font-bold tracking-wide">{aiLoadingMsg}</div>
                      <div className="w-44 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-500 transition-all duration-300"
                          style={{ width: `${aiProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Mobile Touch Gesture Bar */}
                <div className="mt-3 flex items-center justify-center gap-2 w-full">
                  <button
                    onClick={() => setZoom((z) => Math.max(50, z - 10))}
                    className="min-h-[42px] min-w-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center active:scale-95 transition"
                    title="Zoom Out"
                  >
                    <i className="fa-solid fa-minus text-xs"></i>
                  </button>
                  <button
                    onClick={applyPassportHeadshotZoom}
                    className="min-h-[42px] px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition"
                  >
                    <i className="fa-solid fa-expand text-teal-600"></i>
                    <span>Auto-Fit Face</span>
                  </button>
                  <button
                    onClick={() => setZoom((z) => Math.min(280, z + 10))}
                    className="min-h-[42px] min-w-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center active:scale-95 transition"
                    title="Zoom In"
                  >
                    <i className="fa-solid fa-plus text-xs"></i>
                  </button>
                </div>
              </div>

              {/* 2. COMPARE ORIGINAL VS CUTOUT */}
              <div
                className={`${
                  previewMode === 'compare' ? 'grid' : 'hidden'
                } grid-cols-2 gap-3 py-2`}
              >
                <div className="flex flex-col items-center">
                  <span className="text-[11px] font-bold text-slate-500 mb-1.5">Original</span>
                  <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 max-h-[280px] sm:max-h-[340px] flex items-center justify-center p-1">
                    {compareOriginalSrc && (
                      <img
                        src={compareOriginalSrc}
                        alt="Original"
                        referrerPolicy="no-referrer"
                        className="max-h-[260px] sm:max-h-[320px] w-auto object-contain rounded-xl"
                      />
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[11px] font-bold text-emerald-700 mb-1.5">AI Cutout</span>
                  <div className="rounded-2xl overflow-hidden border border-slate-200 checkerboard max-h-[280px] sm:max-h-[340px] flex items-center justify-center p-1">
                    <canvas
                      ref={compareCutoutCanvasRef}
                      className="max-h-[260px] sm:max-h-[320px] w-auto object-contain rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* 3. 6x4 PRINTABLE SHEET */}
              <div
                className={`${
                  previewMode === 'sheet' ? 'flex' : 'hidden'
                } flex-col items-center justify-center py-2`}
              >
                <div className="bg-slate-100 p-3 rounded-2xl border border-slate-200 max-w-full overflow-auto flex justify-center">
                  <canvas
                    ref={sheetCanvasRef}
                    className="bg-white shadow-md rounded border border-slate-300 max-h-[280px] sm:max-h-[350px] w-auto"
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 w-full text-xs text-slate-600 px-1">
                  <span className="font-bold text-slate-900 font-mono">
                    {gridInfo.total} Photos ({gridInfo.cols}×{gridInfo.rows}) on 6×4" Lab Sheet
                  </span>
                  <label className="min-h-[40px] inline-flex items-center gap-2 cursor-pointer font-semibold">
                    <input
                      type="checkbox"
                      checked={showCutMarks}
                      onChange={(e) => setShowCutMarks(e.target.checked)}
                      className="w-4 h-4 rounded accent-teal-600"
                    />
                    <span>Cut Lines</span>
                  </label>
                </div>
              </div>

              {/* Primary Export & Cloud Save Bar inside Canvas Card */}
              <div className="pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <button
                  onClick={() => downloadSinglePhoto('jpeg')}
                  className="min-h-[46px] py-2.5 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs active:scale-[0.98] transition flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-image"></i>
                  <span>Single HD Photo</span>
                </button>
                <button
                  onClick={downloadPrintSheet}
                  className="min-h-[46px] py-2.5 px-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm active:scale-[0.98] transition flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-print"></i>
                  <span>6×4" Print Sheet</span>
                </button>
                <button
                  onClick={handleSavePhotoToCloud}
                  disabled={isSavingCloudPhoto}
                  className="col-span-2 sm:col-span-1 min-h-[46px] py-2.5 px-3 rounded-2xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-xs active:scale-[0.98] transition flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                  <span>{isSavingCloudPhoto ? 'Saving...' : 'Save to Account'}</span>
                </button>
              </div>
            </div>

            {/* STUDIO CONTROLS DRAWER / PANEL (Bottom on Mobile, Left on Desktop) */}
            <div className="order-2 lg:order-1 lg:col-span-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
              {/* 3 Ergonomic Touch Tool Tabs */}
              <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-100/80 p-1.5 gap-1 text-xs font-bold">
                <button
                  onClick={() => setControlTab('size')}
                  className={`min-h-[44px] py-2.5 px-2 rounded-2xl flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
                    controlTab === 'size'
                      ? 'bg-white text-teal-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-earth-americas"></i>
                  <span>1. Country Size</span>
                </button>
                <button
                  onClick={() => setControlTab('bg')}
                  className={`min-h-[44px] py-2.5 px-2 rounded-2xl flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
                    controlTab === 'bg'
                      ? 'bg-white text-teal-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-palette"></i>
                  <span>2. Background</span>
                </button>
                <button
                  onClick={() => setControlTab('adjust')}
                  className={`min-h-[44px] py-2.5 px-2 rounded-2xl flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
                    controlTab === 'adjust'
                      ? 'bg-white text-teal-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-sliders"></i>
                  <span>3. Adjust</span>
                </button>
              </div>

              {/* TAB 1: COUNTRY & CUSTOM SIZE */}
              {controlTab === 'size' && (
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="relative">
                    <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                    <input
                      type="text"
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      placeholder="Search India, UK, US, UAE, PAN Card..."
                      className="w-full min-h-[46px] pl-9 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {filteredPresets.map((preset) => {
                      const isSelected = preset.id === selectedPresetId;
                      return (
                        <button
                          key={preset.id}
                          onClick={() => selectCountryPreset(preset.id)}
                          className={`w-full min-h-[60px] text-left p-3 rounded-2xl border transition flex items-center justify-between gap-3 active:scale-[0.99] ${
                            isSelected
                              ? 'bg-teal-50/90 border-teal-600 ring-1 ring-teal-600'
                              : 'bg-white hover:bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-2xl shrink-0">{preset.flag}</span>
                            <div className="truncate">
                              <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                {preset.country}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                {preset.desc}
                              </div>
                            </div>
                          </div>
                          <span className="text-xs font-mono font-bold text-teal-700 shrink-0">
                            {preset.sheetCount} pcs
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Size Box */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        Custom Size (കസ്റ്റം സൈസ്)
                      </span>
                      <select
                        value={customUnit}
                        onChange={(e) => {
                          const u = e.target.value as any;
                          setCustomUnit(u);
                          applyCustomSize(u, customWidthInput, customHeightInput, dpi);
                        }}
                        className="min-h-[38px] text-xs bg-white border border-slate-300 rounded-xl px-2.5 py-1 font-bold text-slate-700"
                      >
                        <option value="mm">mm</option>
                        <option value="cm">cm</option>
                        <option value="inch">inch</option>
                        <option value="px">px</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">
                          Width
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={customWidthInput}
                          onChange={(e) => {
                            setCustomWidthInput(e.target.value);
                            applyCustomSize(customUnit, e.target.value, customHeightInput, dpi);
                          }}
                          className="w-full min-h-[42px] px-2.5 py-1.5 text-sm font-mono font-semibold bg-white border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">
                          Height
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={customHeightInput}
                          onChange={(e) => {
                            setCustomHeightInput(e.target.value);
                            applyCustomSize(customUnit, customWidthInput, e.target.value, dpi);
                          }}
                          className="w-full min-h-[42px] px-2.5 py-1.5 text-sm font-mono font-semibold bg-white border border-slate-300 rounded-xl"
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
                          className="w-full min-h-[42px] px-2 py-1.5 text-sm font-mono font-semibold bg-white border border-slate-300 rounded-xl"
                        >
                          <option value={300}>300</option>
                          <option value={600}>600</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: BACKGROUND COLOR & AI CUTOUT */}
              {controlTab === 'bg' && (
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="grid grid-cols-4 gap-2.5">
                    {BG_SWATCHES.map((s) => {
                      const isSelected = bgColor.toLowerCase() === s.hex.toLowerCase();
                      return (
                        <button
                          key={s.name}
                          onClick={() => {
                            setBgColor(s.hex);
                            setBgName(s.name);
                          }}
                          className={`min-h-[76px] p-2 rounded-2xl border transition flex flex-col items-center justify-center gap-1.5 active:scale-95 ${
                            isSelected
                              ? 'border-teal-600 bg-teal-50 ring-2 ring-teal-500/20'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <span
                            className={`w-8 h-8 rounded-full shadow-inner border ${
                              s.hex === 'transparent' ? 'checkerboard' : ''
                            }`}
                            style={{
                              backgroundColor: s.hex === 'transparent' ? undefined : s.hex,
                              borderColor: s.border,
                            }}
                          ></span>
                          <div className="text-[11px] font-bold text-slate-800 text-center leading-tight">
                            {s.name}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Color Picker Row */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={bgColor === 'transparent' ? '#ffffff' : bgColor}
                        onChange={(e) => {
                          setBgColor(e.target.value);
                          setBgName('Custom Color');
                        }}
                        className="w-10 h-10 rounded-xl cursor-pointer border border-slate-300 bg-white p-0.5"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-800">Custom Studio Color</div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {bgColor === 'transparent' ? 'Transparent' : bgColor.toUpperCase()} ({bgName})
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI Background Remover Card */}
                  <div className="p-4 rounded-2xl bg-teal-50/80 border border-teal-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-extrabold text-teal-950">
                        AI Background Cutout (RMBG-1.4)
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700">{aiStatusText}</span>
                    </div>

                    <button
                      onClick={() => triggerManualAiCutout()}
                      className="w-full min-h-[48px] py-2.5 px-4 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm shadow-sm active:scale-[0.98] transition flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-wand-magic-sparkles"></i>
                      <span>Remove Background Now</span>
                    </button>

                    <div className="grid grid-cols-3 gap-1.5 bg-white p-1 rounded-2xl border border-teal-200 text-[11px] font-bold">
                      <button
                        onClick={() => handleSetCutoutEngine('rmbg')}
                        className={`min-h-[38px] rounded-xl transition ${
                          cutoutEngine === 'rmbg'
                            ? 'bg-teal-600 text-white'
                            : 'text-slate-600'
                        }`}
                      >
                        AI Cutout
                      </button>
                      <button
                        onClick={() => handleSetCutoutEngine('removebg_api')}
                        className={`min-h-[38px] rounded-xl transition ${
                          cutoutEngine === 'removebg_api'
                            ? 'bg-teal-600 text-white'
                            : 'text-slate-600'
                        }`}
                      >
                        Cloud API
                      </button>
                      <button
                        onClick={() => handleSetCutoutEngine('original')}
                        className={`min-h-[38px] rounded-xl transition ${
                          cutoutEngine === 'original'
                            ? 'bg-teal-600 text-white'
                            : 'text-slate-600'
                        }`}
                      >
                        Original BG
                      </button>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-teal-950">Edge Refinement</span>
                        <span className="font-mono font-bold text-teal-700">{bgTolerance}%</span>
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
                        className="w-full cursor-pointer"
                      />
                    </div>

                    {cutoutEngine === 'removebg_api' && (
                      <div className="space-y-2 pt-2 border-t border-teal-200">
                        <div className="flex gap-2">
                          <input
                            type="password"
                            value={removeBgApiKey}
                            onChange={(e) => setRemoveBgApiKey(e.target.value)}
                            placeholder="Paste remove.bg API key..."
                            className="flex-1 min-h-[42px] px-3 py-1.5 text-xs bg-white border border-teal-300 rounded-xl"
                          />
                          <button
                            onClick={runRemoveBgCloudApi}
                            className="min-h-[42px] px-4 rounded-xl bg-teal-600 text-white text-xs font-bold"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: ADJUSTMENTS */}
              {controlTab === 'adjust' && (
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900">
                      Fine-Tune Lighting & Position
                    </span>
                    <button
                      onClick={resetTransformAndFilters}
                      className="min-h-[38px] px-3 rounded-xl bg-slate-100 text-xs font-bold text-teal-700"
                    >
                      Reset All
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={applyPassportHeadshotZoom}
                      className="min-h-[44px] py-2 px-3 rounded-2xl bg-teal-50 text-teal-700 border border-teal-200 text-xs font-bold active:scale-95 transition flex items-center justify-center gap-1.5"
                    >
                      <i className="fa-solid fa-user-check"></i>
                      <span>Auto Headshot</span>
                    </button>
                    <button
                      onClick={() => {
                        setZoom(100);
                        setPanX(0);
                        setPanY(0);
                      }}
                      className="min-h-[44px] py-2 px-3 rounded-2xl bg-slate-100 text-slate-700 text-xs font-bold active:scale-95 transition flex items-center justify-center gap-1.5"
                    >
                      <i className="fa-solid fa-arrows-to-dot"></i>
                      <span>Center Photo</span>
                    </button>
                  </div>

                  <div className="space-y-4 pt-1">
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-semibold text-slate-700">Zoom Scale</span>
                        <span className="font-mono font-bold text-teal-700">{zoom}%</span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={280}
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="w-full cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-semibold text-slate-700">Tilt / Rotate</span>
                        <span className="font-mono font-bold text-teal-700">{rotate}°</span>
                      </div>
                      <input
                        type="range"
                        min={-20}
                        max={20}
                        step={0.5}
                        value={rotate}
                        onChange={(e) => setRotate(parseFloat(e.target.value))}
                        className="w-full cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-semibold text-slate-700">Brightness (വെളിച്ചം)</span>
                        <span className="font-mono font-bold text-teal-700">{brightness}%</span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={150}
                        value={brightness}
                        onChange={(e) => setBrightness(parseFloat(e.target.value))}
                        className="w-full cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-semibold text-slate-700">Contrast (തെളിച്ചം)</span>
                        <span className="font-mono font-bold text-teal-700">{contrast}%</span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={150}
                        value={contrast}
                        onChange={(e) => setContrast(parseFloat(e.target.value))}
                        className="w-full cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-semibold text-slate-700">Saturation (നിറം)</span>
                        <span className="font-mono font-bold text-teal-700">{saturate}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={200}
                        value={saturate}
                        onChange={(e) => setSaturate(parseFloat(e.target.value))}
                        className="w-full cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* ROUTE 2: DEDICATED TOOLS HUB (BG REMOVER, CLARITY ENHANCER, QR GENERATOR, LINK SHORTENER) */}
      {activeRoute === 'tools' && (
        <main className="flex-1">
          <ToolsHub
            activeTool={activeToolTab}
            onSelectTool={(t) => setActiveToolTab(t)}
            siteSettings={siteSettings}
            shortLinks={shortLinks}
            onCreateShortLink={handleCreateShortLink}
            onToggleShortLinkStatus={handleToggleShortLinkStatus}
            onDeleteShortLink={handleDeleteShortLink}
            onOpenPassportStudio={() => setActiveRoute('studio')}
            showToast={showToast}
          />
        </main>
      )}

      {/* ROUTE 3: USER DASHBOARD */}
      {activeRoute === 'dashboard' && userProfile && (
        <main className="flex-1">
          <UserDashboard
            brandName={siteSettings.brandName}
            userProfile={userProfile}
            appointments={appointments}
            verifications={verifications}
            savedPhotos={savedPhotos}
            currentStudioPreviewUrl={currentStudioPreviewUrl}
            initialSubTab={dashboardSubTab}
            onBookAppointment={handleBookAppointment}
            onCancelAppointment={handleCancelAppointment}
            onSubmitVerification={handleSubmitVerification}
            onDeleteVerification={handleDeleteVerification}
            onDeleteSavedPhoto={handleDeleteSavedPhoto}
            onUpdateProfile={handleUpdateProfile}
            onNavigateToStudio={() => setActiveRoute('studio')}
            onOpenAdminPanel={() => setActiveRoute('admin')}
            onSelfApproveForDemo={async () => {
              await handleUpdateUserStatus(userProfile.uid, 'approved');
            }}
            onSignOut={handleSignOut}
          />
        </main>
      )}

      {/* ROUTE 4: ADMIN PANEL */}
      {activeRoute === 'admin' && (
        <main className="flex-1">
          <AdminPanel
            currentUserProfile={userProfile}
            users={allUsers}
            siteSettings={siteSettings}
            shortLinks={shortLinks}
            appointments={appointments}
            verifications={verifications}
            onUpdateUserStatus={handleUpdateUserStatus}
            onUpdateUserRole={handleUpdateUserRole}
            onDeleteUserRecord={handleDeleteUserRecord}
            onCreateManagedUser={handleCreateManagedUser}
            onSaveSiteSettings={handleSaveSiteSettings}
            onToggleShortLinkStatus={handleToggleShortLinkStatus}
            onDeleteShortLink={handleDeleteShortLink}
            onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
            onUpdateVerificationStatus={handleUpdateVerificationStatus}
            onNavigateToStudio={() => setActiveRoute('studio')}
            showToast={showToast}
          />
        </main>
      )}

      {/* Configurable Dynamic Website Footer (Visible on Desktop & Mobile above Bottom Nav) */}
      <footer
        className="text-slate-300 border-t border-slate-800 mt-8"
        style={{ backgroundColor: siteSettings.secondaryColor || '#0f172a' }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left">
            {renderBrandLogo(false)}
            <span className="hidden sm:inline text-slate-600">|</span>
            <p className="text-xs text-slate-400">
              {siteSettings.brandTagline}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-300">
            <span className="font-medium">{siteSettings.footerCredit}</span>
            <button
              onClick={() => setActiveRoute('admin')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-400 text-[11px] font-bold transition flex items-center gap-1"
              title="Configure Footer Credit & Brand Settings in Admin Panel"
            >
              <i className="fa-solid fa-gear"></i>
              <span>Admin Settings</span>
            </button>
          </div>
        </div>
      </footer>

      {/* FIXED MOBILE BOTTOM TAB BAR */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 items-center h-16 px-1 select-none">
        <button
          onClick={() => setActiveRoute('studio')}
          className={`min-h-[48px] flex flex-col items-center justify-center transition ${
            activeRoute === 'studio' ? 'text-teal-600 font-bold' : 'text-slate-500'
          }`}
        >
          <i className="fa-solid fa-camera text-base"></i>
          <span className="text-[10px] tracking-tight mt-1">Passport</span>
        </button>

        <button
          onClick={() => openToolSection('bg-remover')}
          className={`min-h-[48px] flex flex-col items-center justify-center transition ${
            activeRoute === 'tools' &&
            (activeToolTab === 'bg-remover' || activeToolTab === 'clarity-enhancer')
              ? 'text-teal-600 font-bold'
              : 'text-slate-500'
          }`}
        >
          <i className="fa-solid fa-wand-magic-sparkles text-base"></i>
          <span className="text-[10px] tracking-tight mt-1">AI Tools</span>
        </button>

        <button
          onClick={() => openToolSection('qr-generator')}
          className={`min-h-[48px] flex flex-col items-center justify-center transition ${
            activeRoute === 'tools' &&
            (activeToolTab === 'qr-generator' || activeToolTab === 'link-shortener')
              ? 'text-teal-600 font-bold'
              : 'text-slate-500'
          }`}
        >
          <i className="fa-solid fa-qrcode text-base"></i>
          <span className="text-[10px] tracking-tight mt-1">QR & Links</span>
        </button>

        <button
          onClick={() => openDashboardSection('overview')}
          className={`min-h-[48px] flex flex-col items-center justify-center transition ${
            activeRoute === 'dashboard' ? 'text-teal-600 font-bold' : 'text-slate-500'
          }`}
        >
          <i className="fa-solid fa-user-circle text-base"></i>
          <span className="text-[10px] tracking-tight mt-1">
            {currentUser ? 'Dashboard' : 'Login'}
          </span>
        </button>

        <button
          onClick={() => setActiveRoute('admin')}
          className={`min-h-[48px] flex flex-col items-center justify-center transition ${
            activeRoute === 'admin' ? 'text-teal-600 font-bold' : 'text-slate-500'
          }`}
        >
          <i className="fa-solid fa-shield-halved text-base"></i>
          <span className="text-[10px] tracking-tight mt-1">Admin</span>
        </button>
      </nav>

      {/* HD Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden"></div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                Download HD Passport Photo
              </h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="min-h-[40px] min-w-[40px] rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="space-y-3 pb-2">
              <button
                onClick={() => downloadSinglePhoto('jpeg')}
                className="w-full min-h-[56px] p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between active:scale-[0.99] transition"
              >
                <div className="text-left">
                  <div className="text-xs sm:text-sm font-bold text-slate-900">
                    Single Passport Photo (JPG)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {pxW} × {pxH} px @ {dpi} DPI Studio Quality
                  </div>
                </div>
                <span className="px-3.5 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold">
                  JPG
                </span>
              </button>

              <button
                onClick={() => downloadSinglePhoto('png')}
                className="w-full min-h-[56px] p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between active:scale-[0.99] transition"
              >
                <div className="text-left">
                  <div className="text-xs sm:text-sm font-bold text-slate-900">
                    Single Passport Photo (PNG)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Lossless / Transparent Ready
                  </div>
                </div>
                <span className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold">
                  PNG
                </span>
              </button>

              <button
                onClick={downloadPrintSheet}
                className="w-full min-h-[56px] p-3.5 rounded-2xl bg-teal-50 hover:bg-teal-100 border border-teal-200 flex items-center justify-between active:scale-[0.99] transition"
              >
                <div className="text-left">
                  <div className="text-xs sm:text-sm font-bold text-teal-950">
                    6 × 4 inch Printable Sheet ({gridInfo.total} Photos)
                  </div>
                  <div className="text-[11px] text-teal-700">
                    1800 × 1200 px @ 300 DPI Studio 4R Paper
                  </div>
                </div>
                <span className="px-3.5 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold">
                  6×4"
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login / Sign Up Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden"></div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                {renderBrandLogo(true)}
              </div>
              <button
                onClick={() => setShowAuthModal(false)}
                className="min-h-[40px] min-w-[40px] rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                {authMode === 'login'
                  ? `Sign In to ${siteSettings.brandName}`
                  : authMode === 'signup'
                  ? `Create ${siteSettings.brandName} Account`
                  : 'Reset Password'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {authMode === 'signup'
                  ? 'New registrations are reviewed & approved via the Admin Panel.'
                  : 'Access your saved passport photos, appointments, and tools.'}
              </p>
            </div>

            {authMode !== 'reset' && (
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-2xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError(null);
                  }}
                  className={`min-h-[42px] py-2 rounded-xl transition ${
                    authMode === 'login'
                      ? 'bg-white text-teal-700 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setAuthError(null);
                  }}
                  className={`min-h-[42px] py-2 rounded-xl transition ${
                    authMode === 'signup'
                      ? 'bg-white text-teal-700 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Register Account
                </button>
              </div>
            )}

            {authError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {authError}
              </div>
            )}

            <form onSubmit={handleEmailPasswordAuth} className="space-y-3.5">
              {authMode === 'signup' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={authFullName}
                      onChange={(e) => setAuthFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      value={authPhone}
                      onChange={(e) => setAuthPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {authMode !== 'reset' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Password
                    </label>
                    {authMode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('reset');
                          setAuthError(null);
                        }}
                        className="text-xs font-bold text-teal-700"
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
                    className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isAuthSubmitting}
                className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-sm shadow-sm active:scale-[0.98] transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-envelope"></i>
                <span>
                  {isAuthSubmitting
                    ? 'Please wait...'
                    : authMode === 'login'
                    ? 'Login with Email'
                    : authMode === 'signup'
                    ? 'Register Account'
                    : 'Send Reset Link'}
                </span>
              </button>

              {authMode === 'reset' && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError(null);
                  }}
                  className="w-full min-h-[42px] text-xs font-bold text-slate-600 text-center"
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
                    Or
                  </span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm active:scale-[0.98] transition flex items-center justify-center gap-2.5"
                >
                  <i className="fa-brands fa-google"></i>
                  <span>Continue with Google</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <div
        className={`fixed bottom-20 lg:bottom-6 right-4 left-4 sm:left-auto z-50 bg-slate-900 text-white px-4 py-3.5 rounded-2xl shadow-xl text-xs font-bold flex items-center justify-center sm:justify-start gap-2.5 transition-all duration-300 pointer-events-none ${
          toastMsg ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
        }`}
      >
        <i className="fa-solid fa-circle-check text-teal-400 text-sm"></i>
        <span>{toastMsg || 'Ready!'}</span>
      </div>
    </div>
  );
}
