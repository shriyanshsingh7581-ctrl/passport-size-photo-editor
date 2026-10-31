import React, { useState, useRef, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import {
  SiteSettings,
  ToolCatalogItem,
  DEFAULT_TOOL_CATALOG,
  generateSamplePortraitDataUrl,
} from '../constants';
import { PosterTemplateMaker } from './PosterTemplateMaker';

export type MediaLiveSubToolId =
  | 'overview'
  | 'landing'
  | 'poster-template-maker'
  | 'live-streaming-poster'
  | 'youtube-thumbnail'
  | 'live-countdown'
  | 'lower-third'
  | 'live-title'
  | 'wedding-live-poster'
  | 'funeral-live-poster'
  | 'church-live-poster'
  | 'logo-overlay'
  | 'qr-code-overlay'
  | 'youtube-description'
  | 'streaming-schedule'
  | 'obs-vmix-export'
  | 'led-screen-layout'
  | 'video-converter';

interface MediaLiveToolsHubProps {
  initialTool?: MediaLiveSubToolId;
  activeSubTool?: MediaLiveSubToolId;
  onSelectSubTool?: (tool: MediaLiveSubToolId) => void;
  siteSettings: SiteSettings;
  toolCatalog?: ToolCatalogItem[];
  showToast: (msg: string) => void;
}

interface ScheduleSlot {
  id: string;
  eventName: string;
  dateText: string;
  startTime: string;
  endTime: string;
  platform: string;
  url: string;
}

export const MediaLiveToolsHub: React.FC<MediaLiveToolsHubProps> = ({
  initialTool = 'overview',
  activeSubTool: controlledSubTool,
  onSelectSubTool,
  siteSettings,
  toolCatalog: propCatalog,
  showToast,
}) => {
  const normalizeTool = (t?: MediaLiveSubToolId): MediaLiveSubToolId => {
    if (!t || t === 'landing') return 'overview';
    return t;
  };
  const [internalTool, setInternalTool] = useState<MediaLiveSubToolId>(
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

  const setActiveSubTool = (next: MediaLiveSubToolId) => {
    const norm = normalizeTool(next);
    setInternalTool(norm);
    if (onSelectSubTool) onSelectSubTool(norm);
  };
  const activeSubTool = internalTool;
  const toolCatalog =
    propCatalog && propCatalog.length > 0
      ? propCatalog
      : siteSettings.toolCatalog && siteSettings.toolCatalog.length > 0
      ? siteSettings.toolCatalog
      : DEFAULT_TOOL_CATALOG;

  // Shared uploaded assets for posters/graphics
  const [customBgUrl, setCustomBgUrl] = useState<string>('');
  const [subjectPhotoUrl, setSubjectPhotoUrl] = useState<string>('');
  const [logoImgUrl, setLogoImgUrl] = useState<string>(
    siteSettings.logoUrl || '/assets/aistudio/IMG-20261029-WA0055_86fec676.jpg'
  );
  const [fontFamily, setFontFamily] = useState<string>('Plus Jakarta Sans');
  const [primaryTextColor, setPrimaryTextColor] = useState<string>('#FFFFFF');
  const [accentColor, setAccentColor] = useState<string>('#06b6d4');

  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const subjectImgRef = useRef<HTMLImageElement | null>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);

  const bgUploadInputRef = useRef<HTMLInputElement | null>(null);
  const subjectUploadInputRef = useRef<HTMLInputElement | null>(null);
  const logoUploadInputRef = useRef<HTMLInputElement | null>(null);

  // =========================================================================
  // 1. LIVE STREAMING POSTER STATE
  // =========================================================================
  const [livePosterTemplate, setLivePosterTemplate] = useState<
    'wedding' | 'church' | 'funeral' | 'general' | 'youtube'
  >('youtube');
  const [livePosterTitle, setLivePosterTitle] = useState('GRAND MUSICAL NIGHT & CULTURAL FEST');
  const [livePosterDateTime, setLivePosterDateTime] = useState('SUNDAY, NOV 15 · 06:30 PM IST');
  const [livePosterPlatform, setLivePosterPlatform] = useState('YouTube Live & Facebook Live');
  const [livePosterUrl, setLivePosterUrl] = useState('youtube.com/@malnadumedia/live');
  const [livePosterDesc, setLivePosterDesc] = useState(
    'Watch Full 4K Multi-Cam Broadcast Live by MALNADU MEDIA'
  );

  // =========================================================================
  // 2. YOUTUBE THUMBNAIL MAKER & REDESIGN STUDIO STATE (1280×720)
  // =========================================================================
  const [ytTemplate, setYtTemplate] = useState<
    'redesign-glow' | 'breaking-banner' | 'split-before-after' | 'cyber' | 'fire' | 'studio'
  >('redesign-glow');
  const [uploadedThumbUrl, setUploadedThumbUrl] = useState<string>('');
  const [ytTitle, setYtTitle] = useState('PRO LIVE STREAM SETUP');
  const [ytSubtitle, setYtSubtitle] = useState('4K MULTI-CAM STUDIO WORKFLOW!');
  const [ytBadgeText, setYtBadgeText] = useState('NEW REDESIGN');
  const [ytOutlineWidth, setYtOutlineWidth] = useState<number>(8);
  const [ytShadowBlur, setYtShadowBlur] = useState<number>(18);
  const [ytRedesignBrightness, setYtRedesignBrightness] = useState<number>(106);
  const [ytRedesignContrast, setYtRedesignContrast] = useState<number>(115);
  const [ytRedesignSaturation, setYtRedesignSaturation] = useState<number>(122);
  const [ytRedesignTintOpacity, setYtRedesignTintOpacity] = useState<number>(45);
  const [ytRedesignZoom, setYtRedesignZoom] = useState<number>(100);
  const [ytShowSubjectOverlay, setYtShowSubjectOverlay] = useState<boolean>(true);
  const [ytShowNeonFrame, setYtShowNeonFrame] = useState<boolean>(true);
  const uploadedThumbImgRef = useRef<HTMLImageElement | null>(null);
  const thumbUploadInputRef = useRef<HTMLInputElement | null>(null);

  // =========================================================================
  // 3. LIVE COUNTDOWN MAKER STATE
  // =========================================================================
  const [cdEventTitle, setCdEventTitle] = useState('LIVE BROADCAST STARTING SOON');
  const [cdTargetIso, setCdTargetIso] = useState(() => {
    const d = new Date(Date.now() + 3600000 * 5 + 1500000);
    return d.toISOString().slice(0, 16);
  });
  const [cdStyle, setCdStyle] = useState<'neon' | 'broadcast' | 'royal'>('neon');
  const [cdRemaining, setCdRemaining] = useState({ days: '00', hours: '05', mins: '24', secs: '59' });
  const [isRecordingCdVideo, setIsRecordingCdVideo] = useState(false);

  // =========================================================================
  // 4. LOWER THIRD GENERATOR STATE (1920×1080 Transparent)
  // =========================================================================
  const [ltName, setLtName] = useState('DR. MATHEW VARGHESE');
  const [ltDesignation, setLtDesignation] = useState('Chief Guest & Keynote Speaker');
  const [ltOrg, setLtOrg] = useState('MALNADU MEDIA LIVE');
  const [ltTemplate, setLtTemplate] = useState<'modern-cyan' | 'gold-luxury' | 'news-bar'>('modern-cyan');
  const [ltBgColor, setLtBgColor] = useState('#070a14');
  const [ltResolution, setLtResolution] = useState<'1080p' | '720p'>('1080p');
  const [isRecordingLtVideo, setIsRecordingLtVideo] = useState(false);

  // =========================================================================
  // 5. LIVE TITLE GENERATOR STATE
  // =========================================================================
  const [titleTemplate, setTitleTemplate] = useState<
    'wedding' | 'church' | 'funeral' | 'special' | 'program'
  >('wedding');
  const [titleMain, setTitleMain] = useState('HOLY MATRIMONY LIVE');
  const [titleSub, setTitleSub] = useState('Solemnization of Marriage & Nuptial Blessing');
  const [titleDate, setTitleDate] = useState('November 24, 2026 · 10:30 AM');
  const [titleStudio, setTitleStudio] = useState('Live Broadcast by MALNADU MEDIA');

  // =========================================================================
  // 6. WEDDING LIVE POSTER STATE
  // =========================================================================
  const [wedBride, setWedBride] = useState('ANJALI MENON');
  const [wedGroom, setWedGroom] = useState('ROHAN NAIR');
  const [wedDate, setWedDate] = useState('Sunday, 22nd November 2026 · 11:00 AM');
  const [wedVenue, setWedVenue] = useState('St. George Cathedral & Grand Convention Center, Kochi');
  const [wedUrl, setWedUrl] = useState('youtube.com/@malnadumedia');
  const [wedTemplate, setWedTemplate] = useState<'royal-gold' | 'floral-rose' | 'emerald-palace'>('royal-gold');

  // =========================================================================
  // 7. FUNERAL LIVE POSTER STATE (Respectful, Minimal, Dignified)
  // =========================================================================
  const [funName, setFunName] = useState('LATE MR. THOMAS KURIAN');
  const [funDates, setFunDates] = useState('1942 – 2026 · In Loving Memory');
  const [funDetails, setFunDetails] = useState(
    'Funeral Service: Monday, Nov 2 · 02:30 PM at St. Mary’s Orthodox Church'
  );
  const [funUrl, setFunUrl] = useState('youtube.com/@malnadumedia/live');
  const [funTemplate, setFunTemplate] = useState<'ivory-dignified' | 'charcoal-memorial' | 'classic-serif'>(
    'ivory-dignified'
  );

  // =========================================================================
  // 8. CHURCH LIVE POSTER STATE
  // =========================================================================
  const [chName, setChName] = useState('ST. MARY’S FORANE CHURCH, MALNADU');
  const [chEvent, setChEvent] = useState('ANNUAL PARISH FEAST & SOLEMN HIGH MASS');
  const [chDateTime, setChDateTime] = useState('SUNDAY · 09:00 AM IST');
  const [chDetails, setChDetails] = useState('Main Celebrant: Most Rev. Dr. Joseph Mar Thoma');
  const [chUrl, setChUrl] = useState('youtube.com/@malnadumedia');
  const [chTemplate, setChTemplate] = useState<
    'festival' | 'sunday-worship' | 'prayer-meeting' | 'special-event'
  >('festival');

  // =========================================================================
  // 9. LOGO OVERLAY MAKER STATE (1920×1080 Transparent)
  // =========================================================================
  const [logoCorner, setLogoCorner] = useState<'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'>(
    'top-right'
  );
  const [logoScale, setLogoScale] = useState<number>(100);
  const [logoOpacity, setLogoOpacity] = useState<number>(92);
  const [logoRemoveWhite, setLogoRemoveWhite] = useState<boolean>(false);
  const [logoTagText, setLogoTagText] = useState<string>('LIVE HD');

  // =========================================================================
  // 10. QR CODE BROADCAST OVERLAY STATE
  // =========================================================================
  const [qrOverlayUrl, setQrOverlayUrl] = useState<string>('https://passportstudiopro.netlify.app');
  const [qrOverlayTitle, setQrOverlayTitle] = useState<string>('SCAN TO WATCH ON MOBILE');
  const [qrOverlayCta, setQrOverlayCta] = useState<string>('Share Live Stream with Family');
  const [qrOverlayCorner, setQrOverlayCorner] = useState<'bottom-right' | 'bottom-left' | 'top-right'>(
    'bottom-right'
  );
  const [qrGeneratedImg, setQrGeneratedImg] = useState<HTMLImageElement | null>(null);

  // =========================================================================
  // 11. YOUTUBE DESCRIPTION GENERATOR STATE
  // =========================================================================
  const [descTitle, setDescTitle] = useState('Grand Wedding Live Stream | Anjali Weds Rohan | 4K Multi-Cam');
  const [descTopic, setDescTopic] = useState(
    'Full HD Live Wedding Ceremony broadcast from Kochi with traditional rituals and stage reception'
  );
  const [descKeywords, setDescKeywords] = useState(
    'Wedding Live, Kerala Wedding, Malnadu Media, 4K Live Stream, Bride and Groom'
  );
  const [descLanguage, setDescLanguage] = useState<
    'Standard Broadcast' | 'High-CTR SEO' | 'Formal Event'
  >('Standard Broadcast');
  const [descCategory, setDescCategory] = useState<
    'Wedding Live' | 'Church / Devotional' | 'Tech / Tutorial' | 'Vlog / Entertainment'
  >('Wedding Live');
  const [descCta, setDescCta] = useState('Book MALNADU MEDIA for 4K Live Streaming: +91 98450 11223');
  const [generatedDescText, setGeneratedDescText] = useState<string>('');
  const [isGeneratingDesc, setIsGeneratingDesc] = useState<boolean>(false);

  // =========================================================================
  // 12. STREAMING SCHEDULE MAKER STATE
  // =========================================================================
  const [schedTitle, setSchedTitle] = useState('WEEKLY LIVE BROADCAST SCHEDULE');
  const [schedTemplate, setSchedTemplate] = useState<'obsidian-grid' | 'broadcast-neon'>('obsidian-grid');
  const [schedSlots, setSchedSlots] = useState<ScheduleSlot[]>([
    {
      id: 'slot-1',
      eventName: 'Sunday Holy Mass & Morning Service',
      dateText: 'Sunday, Nov 15',
      startTime: '08:30 AM',
      endTime: '10:30 AM',
      platform: 'YouTube Live',
      url: 'youtube.com/@malnadumedia',
    },
    {
      id: 'slot-2',
      eventName: 'Anjali & Rohan Wedding Ceremony',
      dateText: 'Monday, Nov 16',
      startTime: '11:00 AM',
      endTime: '02:00 PM',
      platform: 'YouTube & FB Live',
      url: 'youtube.com/@malnadumedia',
    },
    {
      id: 'slot-3',
      eventName: 'Annual Cultural Evening & Musical Fest',
      dateText: 'Wednesday, Nov 18',
      startTime: '06:30 PM',
      endTime: '09:30 PM',
      platform: 'YouTube 4K',
      url: 'youtube.com/@malnadumedia',
    },
  ]);

  // =========================================================================
  // 13. OBS / vMIX GRAPHICS EXPORT STATE
  // =========================================================================
  const [obsRes, setObsRes] = useState<'1920x1080' | '1280x720'>('1920x1080');
  const [obsGraphicType, setObsGraphicType] = useState<
    'lower-third' | 'logo-bug' | 'qr-bug' | 'starting-soon' | 'live-frame'
  >('lower-third');
  const [obsTransparent, setObsTransparent] = useState<boolean>(true);
  const [isExportingObsZip, setIsExportingObsZip] = useState<boolean>(false);

  // =========================================================================
  // 14. LED SCREEN LAYOUT MAKER STATE
  // =========================================================================
  const [ledAspect, setLedAspect] = useState<'16:9' | '4:3' | '1:1' | 'custom'>('16:9');
  const [ledCustomW, setLedCustomW] = useState<number>(1920);
  const [ledCustomH, setLedCustomH] = useState<number>(1080);
  const [ledHeadline, setLedHeadline] = useState<string>('WELCOME TO THE GRAND RECEPTION');
  const [ledSubheadline, setLedSubheadline] = useState<string>('ROHAN & ANJALI · NOVEMBER 2026');
  const [ledShowGrid, setLedShowGrid] = useState<boolean>(true);

  // =========================================================================
  // 15. VIDEO CONVERTER STATE
  // =========================================================================
  const [videoFileName, setVideoFileName] = useState<string>('');
  const [videoFileSize, setVideoFileSize] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoOrigW, setVideoOrigW] = useState<number>(0);
  const [videoOrigH, setVideoOrigH] = useState<number>(0);
  const [videoSrcUrl, setVideoSrcUrl] = useState<string>('');
  const [videoTargetFormat, setVideoTargetFormat] = useState<'webm' | 'mp4'>('webm');
  const [videoTargetRes, setVideoTargetRes] = useState<'1080p' | '720p' | '480p'>('720p');
  const [videoTargetQuality, setVideoTargetQuality] = useState<'high' | 'medium' | 'compact'>('high');
  const [isConvertingVideo, setIsConvertingVideo] = useState<boolean>(false);
  const [videoConvertProgress, setVideoConvertProgress] = useState<number>(0);
  const [convertedVideoUrl, setConvertedVideoUrl] = useState<string>('');
  const [convertedVideoBytes, setConvertedVideoBytes] = useState<number>(0);
  const [convertedVideoExt, setConvertedVideoExt] = useState<string>('webm');
  const [videoErrorMsg, setVideoErrorMsg] = useState<string | null>(null);

  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const videoPreviewElRef = useRef<HTMLVideoElement | null>(null);
  const mainGraphicCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // =========================================================================
  // INITIALIZE SAMPLE PORTRAIT, LOGO & QR IMAGE
  // =========================================================================
  useEffect(() => {
    const sampleUrl = generateSamplePortraitDataUrl(0, false);
    setSubjectPhotoUrl(sampleUrl);
    const sImg = new Image();
    sImg.crossOrigin = 'anonymous';
    sImg.onload = () => {
      subjectImgRef.current = sImg;
    };
    sImg.src = sampleUrl;

    const lImg = new Image();
    lImg.crossOrigin = 'anonymous';
    lImg.onload = () => {
      logoImgRef.current = lImg;
    };
    lImg.src = logoImgUrl;
  }, []);

  useEffect(() => {
    const updateQrImg = async () => {
      try {
        const QRCodeMod: any = await import('qrcode');
        const toDataURL = QRCodeMod.toDataURL || QRCodeMod.default?.toDataURL;
        if (toDataURL) {
          const dataUrl = await toDataURL(qrOverlayUrl || 'https://malnadumedia.com', {
            width: 300,
            margin: 1,
            color: { dark: '#070a14', light: '#FFFFFF' },
          });
          const qImg = new Image();
          qImg.onload = () => setQrGeneratedImg(qImg);
          qImg.src = dataUrl;
        }
      } catch {}
    };
    updateQrImg();
  }, [qrOverlayUrl]);

  // Real-time ticking countdown timer
  useEffect(() => {
    const tick = () => {
      const targetMs = new Date(cdTargetIso).getTime();
      const diff = Math.max(0, targetMs - Date.now());
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCdRemaining({
        days: String(d).padStart(2, '0'),
        hours: String(h).padStart(2, '0'),
        mins: String(m).padStart(2, '0'),
        secs: String(s).padStart(2, '0'),
      });
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [cdTargetIso]);

  const handleImageAssetUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'bg' | 'subject' | 'logo' | 'thumbnail'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const res = ev.target?.result as string;
      if (!res) return;
      const img = new Image();
      img.onload = () => {
        if (target === 'thumbnail') {
          uploadedThumbImgRef.current = img;
          setUploadedThumbUrl(res);
          setYtShowSubjectOverlay(false);
          showToast('Existing Thumbnail Uploaded! Adjust redesign styles & text below.');
        } else if (target === 'bg') {
          bgImgRef.current = img;
          setCustomBgUrl(res);
          showToast('Background image updated!');
        } else if (target === 'subject') {
          subjectImgRef.current = img;
          setSubjectPhotoUrl(res);
          setYtShowSubjectOverlay(true);
          showToast('Event / Subject photo updated!');
        } else {
          logoImgRef.current = img;
          setLogoImgUrl(res);
          showToast('Logo image updated!');
        }
      };
      img.src = res;
    };
    reader.readAsDataURL(file);
  };

  // =========================================================================
  // UNIFIED CANVAS GRAPHICS ENGINE FOR ALL MEDIA & LIVE TOOLS
  // =========================================================================
  const drawCoverBackground = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    fallbackStops: [string, string, string]
  ) => {
    if (bgImgRef.current) {
      const img = bgImgRef.current;
      const scale = Math.max(w / img.width, h / img.height);
      const dW = img.width * scale;
      const dH = img.height * scale;
      ctx.drawImage(img, (w - dW) / 2, (h - dH) / 2, dW, dH);
      ctx.fillStyle = 'rgba(7, 10, 20, 0.68)';
      ctx.fillRect(0, 0, w, h);
    } else {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, fallbackStops[0]);
      grad.addColorStop(0.5, fallbackStops[1]);
      grad.addColorStop(1, fallbackStops[2]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  };

  const renderActiveMediaCanvas = useCallback(
    (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d')!;

      // 1. LIVE STREAMING POSTER MAKER
      if (activeSubTool === 'live-streaming-poster') {
        const w = 1280;
        const h = 720;
        canvas.width = w;
        canvas.height = h;

        const palettes: Record<string, [string, string, string]> = {
          youtube: ['#070a14', '#0f172a', '#1e1b4b'],
          wedding: ['#2e1065', '#4c0519', '#1e1b4b'],
          church: ['#082f49', '#0f172a', '#172554'],
          funeral: ['#18181b', '#27272a', '#09090b'],
          general: ['#042f2e', '#0f172a', '#1e1b4b'],
        };
        drawCoverBackground(ctx, w, h, palettes[livePosterTemplate] || palettes.youtube);

        // Decorative border
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(28, 28, w - 56, h - 56);

        // Logo top-left
        if (logoImgRef.current) {
          ctx.drawImage(logoImgRef.current, 54, 48, 95, 64);
        }

        // LIVE Badge
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.roundRect(168, 60, 145, 40, 10);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `800 18px "${fontFamily}", sans-serif`;
        ctx.fillText('● LIVE STREAM', 184, 86);

        // Subject Photo on right
        if (subjectImgRef.current) {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(810, 85, 400, 550, 28);
          ctx.clip();
          const img = subjectImgRef.current;
          const sc = Math.max(400 / img.width, 550 / img.height);
          ctx.drawImage(img, 810 + (400 - img.width * sc) / 2, 85 + (550 - img.height * sc) / 2, img.width * sc, img.height * sc);
          ctx.restore();

          ctx.strokeStyle = accentColor;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.roundRect(810, 85, 400, 550, 28);
          ctx.stroke();
        }

        // Main Title & Details
        ctx.fillStyle = primaryTextColor;
        ctx.font = `800 44px "${fontFamily}", sans-serif`;
        ctx.fillText(livePosterTitle.slice(0, 34), 56, 235);
        if (livePosterTitle.length > 34) {
          ctx.fillText(livePosterTitle.slice(34, 68), 56, 290);
        }

        ctx.fillStyle = accentColor;
        ctx.font = `700 24px "${fontFamily}", sans-serif`;
        ctx.fillText(livePosterDateTime, 56, 365);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = `600 20px "${fontFamily}", sans-serif`;
        ctx.fillText(livePosterDesc, 56, 425);

        // Platform & URL Pill Bar
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.roundRect(56, 515, 690, 95, 20);
        ctx.fill();

        ctx.fillStyle = '#38bdf8';
        ctx.font = `800 20px "${fontFamily}", sans-serif`;
        ctx.fillText(`WATCH ON: ${livePosterPlatform.toUpperCase()}`, 80, 555);
        ctx.fillStyle = '#ffffff';
        ctx.font = `600 18px monospace`;
        ctx.fillText(livePosterUrl, 80, 590);
      }

      // 2. YOUTUBE THUMBNAIL MAKER & EXISTING THUMBNAIL REDESIGN STUDIO (1280×720)
      else if (activeSubTool === 'youtube-thumbnail') {
        const w = 1280;
        const h = 720;
        canvas.width = w;
        canvas.height = h;

        const stops: Record<string, [string, string, string]> = {
          'redesign-glow': ['#070a14', '#0e7490', '#3b0764'],
          'breaking-banner': ['#090d16', '#7f1d1d', '#1e1b4b'],
          'split-before-after': ['#070a14', '#1e293b', '#0f172a'],
          cyber: ['#070a14', '#0e7490', '#3b0764'],
          fire: ['#18181b', '#7f1d1d', '#9a3412'],
          studio: ['#0f172a', '#1e3a8a', '#172554'],
        };

        const activeBaseImg = uploadedThumbImgRef.current || bgImgRef.current;

        if (ytTemplate === 'split-before-after' && activeBaseImg) {
          // Left Half = Original Thumbnail ("BEFORE"), Right Half = Redesigned Color-Graded ("AFTER")
          const halfW = w / 2;
          const sc = Math.max(halfW / activeBaseImg.width, h / activeBaseImg.height);
          const dW = activeBaseImg.width * sc;
          const dH = activeBaseImg.height * sc;

          // Left: Original
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, halfW, h);
          ctx.clip();
          ctx.drawImage(activeBaseImg, (halfW - dW) / 2, (h - dH) / 2, dW, dH);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(0, 0, halfW, h);
          ctx.restore();

          // Right: Redesigned Enhanced
          ctx.save();
          ctx.beginPath();
          ctx.rect(halfW, 0, halfW, h);
          ctx.clip();
          ctx.filter = `brightness(${ytRedesignBrightness}%) contrast(${ytRedesignContrast}%) saturate(${ytRedesignSaturation}%)`;
          ctx.drawImage(activeBaseImg, halfW + (halfW - dW) / 2, (h - dH) / 2, dW, dH);
          ctx.filter = 'none';
          const rightGrad = ctx.createLinearGradient(halfW, 0, w, h);
          rightGrad.addColorStop(0, 'rgba(6, 182, 212, 0.15)');
          rightGrad.addColorStop(1, `rgba(7, 10, 20, ${ytRedesignTintOpacity / 100})`);
          ctx.fillStyle = rightGrad;
          ctx.fillRect(halfW, 0, halfW, h);
          ctx.restore();

          // Center Divider Line
          ctx.strokeStyle = accentColor;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(halfW, 0);
          ctx.lineTo(halfW, h);
          ctx.stroke();

          // BEFORE & AFTER Pills
          ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
          ctx.beginPath();
          ctx.roundRect(36, h - 76, 165, 48, 12);
          ctx.fill();
          ctx.fillStyle = '#94a3b8';
          ctx.font = `800 20px "${fontFamily}", sans-serif`;
          ctx.fillText('OLD THUMBNAIL', 48, h - 45);

          ctx.fillStyle = accentColor;
          ctx.beginPath();
          ctx.roundRect(w - 225, h - 76, 190, 48, 12);
          ctx.fill();
          ctx.fillStyle = '#070a14';
          ctx.font = `900 20px "${fontFamily}", sans-serif`;
          ctx.fillText('NEW REDESIGN', w - 208, h - 45);
        } else if (activeBaseImg) {
          // Draw Uploaded Existing Thumbnail with Real-Time Redesign Adjustments (Brightness, Contrast, Saturation, Zoom)
          ctx.save();
          ctx.filter = `brightness(${ytRedesignBrightness}%) contrast(${ytRedesignContrast}%) saturate(${ytRedesignSaturation}%)`;
          const zoomFactor = ytRedesignZoom / 100;
          const baseScale = Math.max(w / activeBaseImg.width, h / activeBaseImg.height) * zoomFactor;
          const dW = activeBaseImg.width * baseScale;
          const dH = activeBaseImg.height * baseScale;
          ctx.drawImage(activeBaseImg, (w - dW) / 2, (h - dH) / 2, dW, dH);
          ctx.restore();

          // Cinematic Redesign Gradient Overlay
          const overlayAlpha = ytRedesignTintOpacity / 100;
          if (overlayAlpha > 0) {
            const grad = ctx.createLinearGradient(0, 0, w * 0.78, h);
            grad.addColorStop(0, `rgba(7, 10, 20, ${Math.min(0.92, overlayAlpha + 0.18)})`);
            grad.addColorStop(0.55, `rgba(15, 23, 42, ${overlayAlpha * 0.65})`);
            grad.addColorStop(1, `rgba(7, 10, 20, ${overlayAlpha * 0.25})`);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
          }
        } else {
          drawCoverBackground(ctx, w, h, stops[ytTemplate] || stops.cyber);
        }

        // Optional Creator / Subject Cutout on Right
        if (ytShowSubjectOverlay && subjectImgRef.current) {
          const img = subjectImgRef.current;
          const targetH = 660;
          const targetW = Math.round((img.width / img.height) * targetH);
          ctx.save();
          ctx.shadowColor = accentColor;
          ctx.shadowBlur = 28;
          ctx.drawImage(img, w - targetW - 30, h - targetH, targetW, targetH);
          ctx.restore();
        }

        // Optional Neon Frame Border for Redesigned Thumbnails
        if (ytShowNeonFrame) {
          ctx.save();
          ctx.strokeStyle = accentColor;
          ctx.lineWidth = 6;
          ctx.shadowColor = accentColor;
          ctx.shadowBlur = 18;
          ctx.strokeRect(18, 18, w - 36, h - 36);
          ctx.restore();
        }

        // Breaking News Top Strip if breaking-banner template
        if (ytTemplate === 'breaking-banner') {
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(18, 18, w - 36, 54);
          ctx.fillStyle = '#ffffff';
          ctx.font = `900 22px "${fontFamily}", sans-serif`;
          ctx.fillText(
            `● LIVE BROADCAST REDESIGN · ${siteSettings.brandName.toUpperCase()}`,
            46,
            53
          );
        }

        // Top Badge
        const badgeY = ytTemplate === 'breaking-banner' ? 92 : 62;
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.roundRect(58, badgeY, 300, 56, 14);
        ctx.fill();
        ctx.fillStyle = '#070a14';
        ctx.font = `900 24px "${fontFamily}", sans-serif`;
        ctx.fillText(ytBadgeText.toUpperCase().slice(0, 18), 82, badgeY + 37);

        // Big Outlined Title
        ctx.save();
        ctx.font = `900 72px "${fontFamily}", sans-serif`;
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = ytShadowBlur;
        ctx.lineWidth = ytOutlineWidth;
        ctx.strokeStyle = '#000000';
        ctx.fillStyle = primaryTextColor;

        const words = ytTitle.split(' ');
        const line1 = words.slice(0, 2).join(' ');
        const line2 = words.slice(2).join(' ');

        if (ytOutlineWidth > 0) ctx.strokeText(line1, 58, 260);
        ctx.fillText(line1, 58, 260);

        if (line2) {
          ctx.fillStyle = accentColor;
          if (ytOutlineWidth > 0) ctx.strokeText(line2, 58, 355);
          ctx.fillText(line2, 58, 355);
        }
        ctx.restore();

        // Subtitle Banner
        if (ytSubtitle.trim()) {
          ctx.fillStyle = 'rgba(7, 10, 20, 0.88)';
          ctx.beginPath();
          ctx.roundRect(58, 430, 700, 74, 16);
          ctx.fill();
          ctx.strokeStyle = accentColor;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.font = `800 28px "${fontFamily}", sans-serif`;
          ctx.fillText(ytSubtitle.slice(0, 38), 82, 478);
        }

        if (logoImgRef.current) {
          ctx.drawImage(logoImgRef.current, 58, 575, 120, 80);
        }
      }

      // 3. LIVE COUNTDOWN MAKER
      else if (activeSubTool === 'live-countdown') {
        const w = 1280;
        const h = 720;
        canvas.width = w;
        canvas.height = h;

        const stops: Record<string, [string, string, string]> = {
          neon: ['#070a14', '#0f172a', '#1e1b4b'],
          broadcast: ['#020617', '#0c4a6e', '#0f172a'],
          royal: ['#1e1b4b', '#3b0764', '#450a0a'],
        };
        drawCoverBackground(ctx, w, h, stops[cdStyle] || stops.neon);

        ctx.textAlign = 'center';
        ctx.fillStyle = accentColor;
        ctx.font = `800 22px "${fontFamily}", sans-serif`;
        ctx.fillText(siteSettings.brandName.toUpperCase() + ' LIVE BROADCAST', w / 2, 130);

        ctx.fillStyle = primaryTextColor;
        ctx.font = `900 48px "${fontFamily}", sans-serif`;
        ctx.fillText(cdEventTitle, w / 2, 200);

        const units = [
          { label: 'DAYS', val: cdRemaining.days },
          { label: 'HOURS', val: cdRemaining.hours },
          { label: 'MINUTES', val: cdRemaining.mins },
          { label: 'SECONDS', val: cdRemaining.secs },
        ];

        const boxW = 210;
        const boxH = 220;
        const gap = 36;
        const totalW = units.length * boxW + (units.length - 1) * gap;
        const startX = (w - totalW) / 2;

        units.forEach((u, idx) => {
          const x = startX + idx * (boxW + gap);
          const y = 275;

          ctx.fillStyle = 'rgba(7, 10, 20, 0.82)';
          ctx.strokeStyle = accentColor;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.roundRect(x, y, boxW, boxH, 28);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = `900 84px monospace`;
          ctx.fillText(u.val, x + boxW / 2, y + 125);

          ctx.fillStyle = accentColor;
          ctx.font = `800 18px "${fontFamily}", sans-serif`;
          ctx.fillText(u.label, x + boxW / 2, y + 185);
        });

        ctx.textAlign = 'left';
      }

      // 4. LOWER THIRD GENERATOR (Transparent 16:9 Broadcast Overlay)
      else if (activeSubTool === 'lower-third') {
        const w = ltResolution === '1080p' ? 1920 : 1280;
        const h = ltResolution === '1080p' ? 1080 : 720;
        canvas.width = w;
        canvas.height = h;
        ctx.clearRect(0, 0, w, h);

        const scale = w / 1920;
        const barX = Math.round(90 * scale);
        const barY = Math.round(h - 230 * scale);
        const barW = Math.round(980 * scale);
        const barH = Math.round(140 * scale);

        // Left Accent Bar
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.roundRect(barX, barY, Math.round(16 * scale), barH, 8 * scale);
        ctx.fill();

        // Main Lower-Third Body
        ctx.fillStyle = ltBgColor;
        ctx.beginPath();
        ctx.roundRect(barX + 24 * scale, barY, barW, barH, 20 * scale);
        ctx.fill();

        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2.5 * scale;
        ctx.stroke();

        // Logo inside Lower Third
        let textStartX = barX + 54 * scale;
        if (logoImgRef.current) {
          ctx.drawImage(
            logoImgRef.current,
            barX + 44 * scale,
            barY + 22 * scale,
            125 * scale,
            96 * scale
          );
          textStartX = barX + 190 * scale;
        }

        // Name & Designation
        ctx.fillStyle = primaryTextColor;
        ctx.font = `800 ${Math.round(42 * scale)}px "${fontFamily}", sans-serif`;
        ctx.fillText(ltName, textStartX, barY + 62 * scale);

        ctx.fillStyle = accentColor;
        ctx.font = `700 ${Math.round(26 * scale)}px "${fontFamily}", sans-serif`;
        ctx.fillText(`${ltDesignation}  ·  ${ltOrg}`, textStartX, barY + 108 * scale);
      }

      // 5. LIVE TITLE GENERATOR
      else if (activeSubTool === 'live-title') {
        const w = 1280;
        const h = 720;
        canvas.width = w;
        canvas.height = h;

        const stops: Record<string, [string, string, string]> = {
          wedding: ['#2e1065', '#4c0519', '#070a14'],
          church: ['#0c4a6e', '#1e3a8a', '#070a14'],
          funeral: ['#18181b', '#27272a', '#09090b'],
          special: ['#070a14', '#1e1b4b', '#3b0764'],
          program: ['#042f2e', '#0f172a', '#070a14'],
        };
        drawCoverBackground(ctx, w, h, stops[titleTemplate] || stops.wedding);

        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(50, 50, w - 100, h - 100);

        ctx.textAlign = 'center';
        ctx.fillStyle = accentColor;
        ctx.font = `800 22px "${fontFamily}", sans-serif`;
        ctx.fillText(titleStudio.toUpperCase(), w / 2, 220);

        ctx.fillStyle = primaryTextColor;
        ctx.font = `900 62px "${fontFamily}", sans-serif`;
        ctx.fillText(titleMain, w / 2, 340);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = `600 28px "${fontFamily}", sans-serif`;
        ctx.fillText(titleSub, w / 2, 415);

        ctx.fillStyle = accentColor;
        ctx.font = `700 24px monospace`;
        ctx.fillText(titleDate, w / 2, 500);
        ctx.textAlign = 'left';
      }

      // 6. WEDDING LIVE POSTER
      else if (activeSubTool === 'wedding-live-poster') {
        const w = 1280;
        const h = 720;
        canvas.width = w;
        canvas.height = h;

        const stops: Record<string, [string, string, string]> = {
          'royal-gold': ['#2a0800', '#450a0a', '#1c1917'],
          'floral-rose': ['#4c0519', '#831843', '#2e1065'],
          'emerald-palace': ['#022c22', '#064e3b', '#0f172a'],
        };
        drawCoverBackground(ctx, w, h, stops[wedTemplate] || stops['royal-gold']);

        // Gold double border
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.strokeRect(32, 32, w - 64, h - 64);
        ctx.strokeRect(42, 42, w - 84, h - 84);

        // Couple Portrait Circle/Arch on Right
        if (subjectImgRef.current) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(980, 360, 220, 0, Math.PI * 2);
          ctx.clip();
          const img = subjectImgRef.current;
          const sc = Math.max(440 / img.width, 440 / img.height);
          ctx.drawImage(
            img,
            980 - (img.width * sc) / 2,
            360 - (img.height * sc) / 2,
            img.width * sc,
            img.height * sc
          );
          ctx.restore();

          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(980, 360, 220, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = '#fbbf24';
        ctx.font = `800 20px "${fontFamily}", sans-serif`;
        ctx.fillText('WEDDING LIVE STREAMING', 80, 130);

        ctx.fillStyle = '#ffffff';
        ctx.font = `900 54px "${fontFamily}", serif`;
        ctx.fillText(wedBride, 80, 235);
        ctx.fillStyle = '#fbbf24';
        ctx.font = `800 32px serif`;
        ctx.fillText('&', 80, 285);
        ctx.fillStyle = '#ffffff';
        ctx.font = `900 54px "${fontFamily}", serif`;
        ctx.fillText(wedGroom, 80, 345);

        ctx.fillStyle = '#fde68a';
        ctx.font = `700 22px "${fontFamily}", sans-serif`;
        ctx.fillText(wedDate, 80, 425);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = `600 18px "${fontFamily}", sans-serif`;
        ctx.fillText(wedVenue, 80, 465);

        ctx.fillStyle = 'rgba(251, 191, 36, 0.16)';
        ctx.beginPath();
        ctx.roundRect(80, 520, 620, 76, 16);
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.font = `800 18px monospace`;
        ctx.fillText(`WATCH LIVE: ${wedUrl}`, 105, 565);
      }

      // 7. FUNERAL LIVE POSTER (Respectful, Minimal, Dignified)
      else if (activeSubTool === 'funeral-live-poster') {
        const w = 1280;
        const h = 720;
        canvas.width = w;
        canvas.height = h;

        if (funTemplate === 'ivory-dignified') {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = '#94a3b8';
        } else {
          ctx.fillStyle = '#18181b';
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = '#d4d4d8';
        }

        const isLight = funTemplate === 'ivory-dignified';
        ctx.lineWidth = 2;
        ctx.strokeRect(40, 40, w - 80, h - 80);

        // Portrait Frame on Left
        if (subjectImgRef.current) {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(95, 120, 340, 460, 20);
          ctx.clip();
          const img = subjectImgRef.current;
          const sc = Math.max(340 / img.width, 460 / img.height);
          ctx.drawImage(
            img,
            95 + (340 - img.width * sc) / 2,
            120 + (460 - img.height * sc) / 2,
            img.width * sc,
            img.height * sc
          );
          ctx.restore();

          ctx.strokeStyle = isLight ? '#475569' : '#a1a1aa';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.roundRect(95, 120, 340, 460, 20);
          ctx.stroke();
        }

        ctx.fillStyle = isLight ? '#475569' : '#a1a1aa';
        ctx.font = `700 20px serif`;
        ctx.fillText('FUNERAL SERVICE LIVE BROADCAST', 490, 175);

        ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
        ctx.font = `800 46px serif`;
        ctx.fillText(funName, 490, 250);

        ctx.fillStyle = isLight ? '#334155' : '#d4d4d8';
        ctx.font = `600 24px serif`;
        ctx.fillText(funDates, 490, 305);

        ctx.font = `500 20px sans-serif`;
        ctx.fillText(funDetails.slice(0, 56), 490, 385);
        if (funDetails.length > 56) {
          ctx.fillText(funDetails.slice(56), 490, 420);
        }

        ctx.fillStyle = isLight ? '#1e293b' : '#f4f4f5';
        ctx.font = `700 18px monospace`;
        ctx.fillText(`Live Stream Link: ${funUrl}`, 490, 520);
      }

      // 8. CHURCH LIVE POSTER
      else if (activeSubTool === 'church-live-poster') {
        const w = 1280;
        const h = 720;
        canvas.width = w;
        canvas.height = h;

        drawCoverBackground(ctx, w, h, ['#082f49', '#1e3a8a', '#0f172a']);

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.strokeRect(36, 36, w - 72, h - 72);

        ctx.fillStyle = '#38bdf8';
        ctx.font = `800 22px "${fontFamily}", sans-serif`;
        ctx.fillText(chName.toUpperCase(), 75, 130);

        ctx.fillStyle = '#ffffff';
        ctx.font = `900 46px "${fontFamily}", sans-serif`;
        ctx.fillText(chEvent.slice(0, 34), 75, 225);
        if (chEvent.length > 34) {
          ctx.fillText(chEvent.slice(34, 68), 75, 280);
        }

        ctx.fillStyle = '#fbbf24';
        ctx.font = `800 26px "${fontFamily}", sans-serif`;
        ctx.fillText(chDateTime, 75, 365);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = `600 22px "${fontFamily}", sans-serif`;
        ctx.fillText(chDetails, 75, 430);

        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.beginPath();
        ctx.roundRect(75, 505, 680, 80, 18);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `700 20px monospace`;
        ctx.fillText(`LIVE STREAM: ${chUrl}`, 100, 552);
      }

      // 9. LOGO OVERLAY MAKER (1920×1080 Transparent Broadcast Canvas)
      else if (activeSubTool === 'logo-overlay') {
        const w = 1920;
        const h = 1080;
        canvas.width = w;
        canvas.height = h;
        ctx.clearRect(0, 0, w, h);

        if (logoImgRef.current) {
          const baseW = Math.round(220 * (logoScale / 100));
          const baseH = Math.round(140 * (logoScale / 100));
          const pad = 64;
          let x = w - baseW - pad;
          let y = pad;
          if (logoCorner === 'top-left') {
            x = pad;
            y = pad;
          } else if (logoCorner === 'bottom-right') {
            x = w - baseW - pad;
            y = h - baseH - pad;
          } else if (logoCorner === 'bottom-left') {
            x = pad;
            y = h - baseH - pad;
          }

          ctx.save();
          ctx.globalAlpha = logoOpacity / 100;
          ctx.drawImage(logoImgRef.current, x, y, baseW, baseH);

          if (logoTagText.trim()) {
            ctx.fillStyle = '#070a14';
            ctx.beginPath();
            ctx.roundRect(x, y + baseH + 10, baseW, 38, 8);
            ctx.fill();
            ctx.fillStyle = '#06b6d4';
            ctx.font = `800 18px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(logoTagText, x + baseW / 2, y + baseH + 35);
          }
          ctx.restore();
        }
      }

      // 10. QR CODE BROADCAST OVERLAY (1920×1080 Transparent)
      else if (activeSubTool === 'qr-code-overlay') {
        const w = 1920;
        const h = 1080;
        canvas.width = w;
        canvas.height = h;
        ctx.clearRect(0, 0, w, h);

        const cardW = 340;
        const cardH = 420;
        const pad = 64;
        let x = w - cardW - pad;
        let y = h - cardH - pad;
        if (qrOverlayCorner === 'bottom-left') {
          x = pad;
          y = h - cardH - pad;
        } else if (qrOverlayCorner === 'top-right') {
          x = w - cardW - pad;
          y = pad;
        }

        ctx.fillStyle = '#070a14';
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(x, y, cardW, cardH, 28);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = accentColor;
        ctx.font = `800 18px sans-serif`;
        ctx.fillText(qrOverlayTitle.toUpperCase(), x + cardW / 2, y + 42);

        if (qrGeneratedImg) {
          ctx.drawImage(qrGeneratedImg, x + 45, y + 62, 250, 250);
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = `700 16px sans-serif`;
        ctx.fillText(qrOverlayCta, x + cardW / 2, y + 355);
        ctx.fillStyle = '#94a3b8';
        ctx.font = `600 13px monospace`;
        ctx.fillText(siteSettings.brandName, x + cardW / 2, y + 390);
        ctx.textAlign = 'left';
      }

      // 12. STREAMING SCHEDULE MAKER
      else if (activeSubTool === 'streaming-schedule') {
        const w = 1280;
        const h = 720;
        canvas.width = w;
        canvas.height = h;

        drawCoverBackground(ctx, w, h, ['#070a14', '#0f172a', '#1e1b4b']);

        ctx.fillStyle = accentColor;
        ctx.font = `800 20px sans-serif`;
        ctx.fillText(siteSettings.brandName.toUpperCase(), 64, 76);

        ctx.fillStyle = '#ffffff';
        ctx.font = `900 42px sans-serif`;
        ctx.fillText(schedTitle, 64, 130);

        schedSlots.slice(0, 4).forEach((slot, idx) => {
          const y = 175 + idx * 122;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(64, y, w - 128, 104, 20);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = accentColor;
          ctx.font = `800 18px monospace`;
          ctx.fillText(`${slot.dateText} · ${slot.startTime} - ${slot.endTime}`, 92, y + 38);

          ctx.fillStyle = '#ffffff';
          ctx.font = `800 26px sans-serif`;
          ctx.fillText(slot.eventName, 92, y + 76);

          ctx.textAlign = 'right';
          ctx.fillStyle = '#38bdf8';
          ctx.font = `700 18px sans-serif`;
          ctx.fillText(slot.platform, w - 92, y + 45);
          ctx.fillStyle = '#cbd5e1';
          ctx.font = `600 15px monospace`;
          ctx.fillText(slot.url, w - 92, y + 76);
          ctx.textAlign = 'left';
        });
      }

      // 13. OBS / vMIX GRAPHICS EXPORT
      else if (activeSubTool === 'obs-vmix-export') {
        const w = obsRes === '1920x1080' ? 1920 : 1280;
        const h = obsRes === '1920x1080' ? 1080 : 720;
        canvas.width = w;
        canvas.height = h;
        ctx.clearRect(0, 0, w, h);

        if (!obsTransparent) {
          drawCoverBackground(ctx, w, h, ['#070a14', '#0f172a', '#1e1b4b']);
        }

        const sc = w / 1920;

        // Top-right Logo Bug
        if (obsGraphicType === 'logo-bug' || obsGraphicType === 'live-frame') {
          if (logoImgRef.current) {
            ctx.drawImage(logoImgRef.current, w - 240 * sc, 54 * sc, 180 * sc, 110 * sc);
          }
        }

        // Bottom-left Lower Third
        if (obsGraphicType === 'lower-third' || obsGraphicType === 'live-frame') {
          ctx.fillStyle = '#070a14';
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 3 * sc;
          ctx.beginPath();
          ctx.roundRect(80 * sc, h - 210 * sc, 920 * sc, 130 * sc, 20 * sc);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = `800 ${Math.round(38 * sc)}px sans-serif`;
          ctx.fillText(ltName, 115 * sc, h - 148 * sc);
          ctx.fillStyle = '#06b6d4';
          ctx.font = `700 ${Math.round(24 * sc)}px sans-serif`;
          ctx.fillText(`${ltDesignation} · ${ltOrg}`, 115 * sc, h - 105 * sc);
        }

        // Bottom-right QR Bug
        if (obsGraphicType === 'qr-bug' || obsGraphicType === 'live-frame') {
          if (qrGeneratedImg) {
            ctx.fillStyle = '#070a14';
            ctx.beginPath();
            ctx.roundRect(w - 280 * sc, h - 300 * sc, 210 * sc, 230 * sc, 20 * sc);
            ctx.fill();
            ctx.drawImage(qrGeneratedImg, w - 260 * sc, h - 280 * sc, 170 * sc, 170 * sc);
          }
        }

        if (obsGraphicType === 'starting-soon') {
          ctx.fillStyle = 'rgba(7, 10, 20, 0.92)';
          ctx.fillRect(0, 0, w, h);
          ctx.textAlign = 'center';
          ctx.fillStyle = '#06b6d4';
          ctx.font = `800 ${Math.round(32 * sc)}px sans-serif`;
          ctx.fillText(siteSettings.brandName, w / 2, h / 2 - 40 * sc);
          ctx.fillStyle = '#ffffff';
          ctx.font = `900 ${Math.round(68 * sc)}px sans-serif`;
          ctx.fillText('LIVE STREAM STARTING SOON', w / 2, h / 2 + 40 * sc);
          ctx.textAlign = 'left';
        }
      }

      // 14. LED SCREEN LAYOUT MAKER
      else if (activeSubTool === 'led-screen-layout') {
        let w = ledCustomW;
        let h = ledCustomH;
        if (ledAspect === '16:9') {
          w = 1920;
          h = 1080;
        } else if (ledAspect === '4:3') {
          w = 1600;
          h = 1200;
        } else if (ledAspect === '1:1') {
          w = 1200;
          h = 1200;
        }
        canvas.width = w;
        canvas.height = h;

        drawCoverBackground(ctx, w, h, ['#070a14', '#1e1b4b', '#3b0764']);

        if (ledShowGrid) {
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.22)';
          ctx.lineWidth = 2;
          for (let gx = 0; gx < w; gx += 160) {
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, h);
            ctx.stroke();
          }
          for (let gy = 0; gy < h; gy += 160) {
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(w, gy);
            ctx.stroke();
          }
        }

        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 6;
        ctx.strokeRect(40, 40, w - 80, h - 80);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = `900 ${Math.round(w * 0.042)}px "${fontFamily}", sans-serif`;
        ctx.fillText(ledHeadline, w / 2, h / 2 - 20);

        ctx.fillStyle = accentColor;
        ctx.font = `800 ${Math.round(w * 0.026)}px "${fontFamily}", sans-serif`;
        ctx.fillText(ledSubheadline, w / 2, h / 2 + 55);
        ctx.textAlign = 'left';
      }
    },
    [
      activeSubTool,
      livePosterTemplate,
      livePosterTitle,
      livePosterDateTime,
      livePosterPlatform,
      livePosterUrl,
      livePosterDesc,
      ytTemplate,
      uploadedThumbUrl,
      ytTitle,
      ytSubtitle,
      ytBadgeText,
      ytOutlineWidth,
      ytShadowBlur,
      ytRedesignBrightness,
      ytRedesignContrast,
      ytRedesignSaturation,
      ytRedesignTintOpacity,
      ytRedesignZoom,
      ytShowSubjectOverlay,
      ytShowNeonFrame,
      cdEventTitle,
      cdStyle,
      cdRemaining,
      ltName,
      ltDesignation,
      ltOrg,
      ltTemplate,
      ltBgColor,
      ltResolution,
      titleTemplate,
      titleMain,
      titleSub,
      titleDate,
      titleStudio,
      wedBride,
      wedGroom,
      wedDate,
      wedVenue,
      wedUrl,
      wedTemplate,
      funName,
      funDates,
      funDetails,
      funUrl,
      funTemplate,
      chName,
      chEvent,
      chDateTime,
      chDetails,
      chUrl,
      chTemplate,
      logoCorner,
      logoScale,
      logoOpacity,
      logoTagText,
      qrOverlayTitle,
      qrOverlayCta,
      qrOverlayCorner,
      qrGeneratedImg,
      schedTitle,
      schedSlots,
      obsRes,
      obsGraphicType,
      obsTransparent,
      ledAspect,
      ledCustomW,
      ledCustomH,
      ledHeadline,
      ledSubheadline,
      ledShowGrid,
      fontFamily,
      primaryTextColor,
      accentColor,
      siteSettings.brandName,
    ]
  );

  useEffect(() => {
    if (mainGraphicCanvasRef.current) {
      renderActiveMediaCanvas(mainGraphicCanvasRef.current);
    }
  }, [renderActiveMediaCanvas, customBgUrl, subjectPhotoUrl, logoImgUrl]);

  const exportCurrentGraphic = (format: 'png' | 'jpg') => {
    if (!mainGraphicCanvasRef.current) return;
    const canvas = mainGraphicCanvasRef.current;
    const a = document.createElement('a');
    a.download = `malnadu-${activeSubTool}-${Date.now()}.${format}`;
    a.href = canvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 0.96);
    a.click();
    showToast(`Exported ${canvas.width}×${canvas.height}px ${format.toUpperCase()}!`);
  };

  // Record 4-second Animated WebM Video from Canvas (for Countdown & Lower Third)
  const recordCanvasWebmAnimation = async (durationMs = 4000, label = 'countdown') => {
    if (!mainGraphicCanvasRef.current) return;
    const canvas = mainGraphicCanvasRef.current;
    if (typeof (canvas as any).captureStream !== 'function') {
      showToast('Browser does not support Canvas Video Stream capture.');
      return;
    }

    if (label === 'countdown') setIsRecordingCdVideo(true);
    else setIsRecordingLtVideo(true);

    try {
      const stream = (canvas as any).captureStream(30);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.download = `malnadu-${label}-animation.webm`;
        a.href = url;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setIsRecordingCdVideo(false);
        setIsRecordingLtVideo(false);
        showToast('Downloaded Animated WebM Broadcast Graphic!');
      };
      recorder.start();
      setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, durationMs);
    } catch {
      setIsRecordingCdVideo(false);
      setIsRecordingLtVideo(false);
      showToast('Could not record video stream.');
    }
  };

  // =========================================================================
  // 11. YOUTUBE DESCRIPTION GENERATOR HANDLER
  // =========================================================================
  const handleGenerateYoutubeDescription = () => {
    setIsGeneratingDesc(true);
    setTimeout(() => {
      const kwList = descKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      const hashtags = kwList.map((k) => `#${k.replace(/\s+/g, '')}`).join(' ');

      let output = '';
      if (descLanguage === 'High-CTR SEO') {
        output = `🔴 ${descTitle}\n\nWelcome to the official channel of ${siteSettings.brandName}! Watch this complete 4K high-definition broadcast and exclusive coverage.\n\n🔥 WHAT YOU WILL WATCH IN THIS VIDEO:\n${descTopic}\n\n⏱️ VIDEO CHAPTERS & TIMESTAMPS:\n00:00 - Broadcast Countdown & Intro\n04:00 - Main Event Entry & Welcome\n20:00 - Special Ceremony & Stage Highlights\n50:00 - Grand Finale & Closing Remarks\n\n📢 BOOKING & STUDIO CONTACT:\n${descCta}\n\n👉 Make sure to LIKE, SHARE, and SUBSCRIBE with the notification bell turned on so you never miss our next live stream!\n\n🏷️ SEO TAGS:\n${descKeywords}\n\n${hashtags} #MalnaduMedia #4KLiveStream #StudioPro`;
      } else if (descLanguage === 'Formal Event') {
        output = `${descTitle}\n\nOfficial Live Broadcast presented by ${siteSettings.brandName} (${siteSettings.brandTagline}).\n\nEVENT OVERVIEW:\n${descTopic}\n\nSCHEDULE & TIMESTAMPS:\n00:00 - Pre-Broadcast Stand-By\n05:00 - Opening Service & Welcome Address\n25:00 - Principal Ceremony\n45:00 - Concluding Remarks\n\nINQUIRIES & BROADCAST SERVICES:\n${descCta}\n\n${hashtags} #MalnaduMedia #LiveBroadcast`;
      } else {
        output = `🔴 ${descTitle}\n\nWelcome to the official broadcast by ${siteSettings.brandName} (${siteSettings.brandTagline}).\n\n📌 ABOUT THIS BROADCAST:\n${descTopic}\n\n⏱️ TIMESTAMPS / CHAPTERS:\n00:00 - Live Stream Countdown & Welcome\n05:00 - Opening Ceremony & Introduction\n20:00 - Main Event / Keynote Highlights\n45:00 - Special Moments & Concluding Remarks\n\n📞 BOOKING & STUDIO INQUIRIES:\n${descCta}\n\n🔔 Don't forget to LIKE, SHARE, and SUBSCRIBE for high-definition 4K live broadcasts and studio updates!\n\n🏷️ TAGS & KEYWORDS:\n${descKeywords}\n\n${hashtags} #MalnaduMedia #LiveBroadcast #4KStudio`;
      }

      setGeneratedDescText(output);
      setIsGeneratingDesc(false);
      showToast(`Generated ${descLanguage} YouTube Description!`);
    }, 250);
  };

  useEffect(() => {
    handleGenerateYoutubeDescription();
  }, []);

  // =========================================================================
  // 15. REAL VIDEO CONVERTER ENGINE
  // =========================================================================
  const handleVideoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoErrorMsg(null);
    setConvertedVideoUrl('');
    const url = URL.createObjectURL(file);
    setVideoFileName(file.name);
    setVideoFileSize(file.size);
    setVideoSrcUrl(url);
    showToast(`Loaded video "${file.name}"`);
  };

  const handleGenerateSampleTestVideo = () => {
    setVideoErrorMsg(null);
    setConvertedVideoUrl('');
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 360;
    const ctx = c.getContext('2d')!;
    if (typeof (c as any).captureStream !== 'function') {
      setVideoErrorMsg('Canvas stream not supported in this browser.');
      return;
    }

    const stream = (c as any).captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setVideoFileName('Malnadu_Studio_Sample_Clip.webm');
      setVideoFileSize(blob.size);
      setVideoSrcUrl(url);
      showToast('Generated 3-second Sample Video ready to convert!');
    };

    recorder.start();
    let frame = 0;
    const anim = setInterval(() => {
      frame++;
      ctx.fillStyle = '#070a14';
      ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(120 + frame * 5, 180, 48, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 24px sans-serif';
      ctx.fillText('MALNADU MEDIA SAMPLE VIDEO', 130, 90);
      ctx.font = '700 18px monospace';
      ctx.fillText(`Frame #${frame}`, 260, 310);
      if (frame >= 60) {
        clearInterval(anim);
        if (recorder.state !== 'inactive') recorder.stop();
      }
    }, 33);
  };

  const handleExecuteVideoConversion = async () => {
    const videoEl = videoPreviewElRef.current;
    if (!videoEl || !videoSrcUrl) {
      setVideoErrorMsg('Please upload a video or click "Generate Sample Video" first.');
      return;
    }
    setVideoErrorMsg(null);
    setIsConvertingVideo(true);
    setVideoConvertProgress(5);

    try {
      const targetH = videoTargetRes === '1080p' ? 1080 : videoTargetRes === '720p' ? 720 : 480;
      const aspect = (videoOrigW || 1280) / (videoOrigH || 720);
      const targetW = Math.round(targetH * aspect);

      const outCanvas = document.createElement('canvas');
      outCanvas.width = targetW;
      outCanvas.height = targetH;
      const outCtx = outCanvas.getContext('2d')!;

      const stream = (outCanvas as any).captureStream(30);
      let chosenMime = 'video/webm';
      let chosenExt = 'webm';
      if (videoTargetFormat === 'mp4' && MediaRecorder.isTypeSupported('video/mp4')) {
        chosenMime = 'video/mp4';
        chosenExt = 'mp4';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        chosenMime = 'video/webm;codecs=vp9';
        chosenExt = 'webm';
      }

      const bps =
        videoTargetQuality === 'high'
          ? 4500000
          : videoTargetQuality === 'medium'
          ? 2200000
          : 1000000;

      const recorder = new MediaRecorder(stream, {
        mimeType: chosenMime,
        videoBitsPerSecond: bps,
      });

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      recorder.onstop = () => {
        const outBlob = new Blob(chunks, { type: chosenMime });
        if (convertedVideoUrl) URL.revokeObjectURL(convertedVideoUrl);
        const outUrl = URL.createObjectURL(outBlob);
        setConvertedVideoUrl(outUrl);
        setConvertedVideoBytes(outBlob.size);
        setConvertedVideoExt(chosenExt);
        setVideoConvertProgress(100);
        setIsConvertingVideo(false);
        showToast(`Video converted to ${targetW}×${targetH} (${chosenExt.toUpperCase()})!`);
      };

      videoEl.currentTime = 0;
      videoEl.muted = true;
      await videoEl.play();
      recorder.start(100);

      const drawLoop = () => {
        if (videoEl.paused || videoEl.ended) {
          if (recorder.state !== 'inactive') recorder.stop();
          return;
        }
        outCtx.drawImage(videoEl, 0, 0, targetW, targetH);
        if (videoEl.duration > 0) {
          setVideoConvertProgress(
            Math.min(98, Math.round((videoEl.currentTime / videoEl.duration) * 100))
          );
        }
        requestAnimationFrame(drawLoop);
      };
      requestAnimationFrame(drawLoop);
    } catch (err) {
      console.error('Video conversion error:', err);
      setVideoErrorMsg('Could not transcode this video file.');
      setIsConvertingVideo(false);
    }
  };

  const mediaToolsList = toolCatalog.filter(
    (t) => t.category === 'media-live' && t.enabled
  );

  const isCanvasGraphicTool =
    activeSubTool !== 'overview' &&
    activeSubTool !== 'poster-template-maker' &&
    activeSubTool !== 'youtube-description' &&
    activeSubTool !== 'video-converter';

  return (
    <div className="max-w-6xl mx-auto px-3.5 sm:px-6 py-4 sm:py-6 space-y-5">
      {/* Category 3 Header & Tool Bar */}
      <div className="bg-[#070a14] text-white rounded-3xl border border-cyan-500/30 p-4 sm:p-6 shadow-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-purple-400">
              CATEGORY 3 · BROADCAST, STREAMING & EVENT GRAPHICS SUITE
            </div>
            <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight mt-1">
              Media & Live Tools — 36+ Event Poster Templates, OBS/vMix Overlays & Video
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              16 professional tools including 36+ editable Wedding, Anniversary, Birthday & Memorial Poster Templates.
            </p>
          </div>
          {activeSubTool !== 'overview' && (
            <button
              onClick={() => setActiveSubTool('overview')}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-cyan-300 text-xs font-bold self-start md:self-auto shrink-0"
            >
              ← All 16 Media & Live Tools
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 border-t border-white/10">
          <button
            onClick={() => setActiveSubTool('overview')}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-extrabold transition whitespace-nowrap ${
              activeSubTool === 'overview'
                ? 'bg-white text-slate-950'
                : 'bg-white/10 hover:bg-white/15 text-slate-300'
            }`}
          >
            All 16 Tools
          </button>
          <button
            onClick={() => setActiveSubTool('poster-template-maker')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTool === 'poster-template-maker'
                ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white shadow-sm'
                : 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300'
            }`}
          >
            <i className="fa-solid fa-wand-magic-sparkles"></i>
            <span>36+ Poster Template Maker</span>
          </button>
          {mediaToolsList
            .filter((t) => t.id !== 'poster-template-maker')
            .map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveSubTool(tool.id as MediaLiveSubToolId)}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  activeSubTool === tool.id
                    ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white'
                    : 'bg-white/10 hover:bg-white/15 text-slate-300'
                }`}
              >
                {tool.name}
              </button>
            ))}
        </div>
      </div>

      {/* Hidden Shared Upload Inputs */}
      <input
        ref={bgUploadInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => handleImageAssetUpload(e, 'bg')}
        className="hidden"
      />
      <input
        ref={subjectUploadInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => handleImageAssetUpload(e, 'subject')}
        className="hidden"
      />
      <input
        ref={logoUploadInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => handleImageAssetUpload(e, 'logo')}
        className="hidden"
      />
      <input
        ref={thumbUploadInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => handleImageAssetUpload(e, 'thumbnail')}
        className="hidden"
      />

      {/* =====================================================================
          DEDICATED 36+ WEDDING, ANNIVERSARY & MEMORIAL POSTER TEMPLATE MAKER
         ===================================================================== */}
      {activeSubTool === 'poster-template-maker' && (
        <PosterTemplateMaker showToast={showToast} />
      )}

      {/* =====================================================================
          VIEW 0: MEDIA & LIVE TOOLS CATEGORY LANDING GRID
         ===================================================================== */}
      {activeSubTool === 'overview' && (
        <div className="space-y-4">
          {/* Featured 36+ Poster Template Maker Banner */}
          <div className="bg-gradient-to-r from-[#070a14] via-purple-950 to-slate-900 text-white rounded-3xl border border-amber-400/40 p-5 sm:p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[11px] font-extrabold uppercase tracking-wider">
                <i className="fa-solid fa-crown"></i>
                <span>Featured · 36 Ready-Made Editable Templates</span>
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white">
                Wedding, Anniversary, Birthday, Memorial & Festival Poster Template Maker
              </h2>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Upload single or multiple photos into predefined arch, circle, oval & royal frames. Drag, zoom, and crop each photo independently and edit all names, dates, venues, and messages directly in your browser.
              </p>
            </div>
            <button
              onClick={() => setActiveSubTool('poster-template-maker')}
              className="min-h-[46px] px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white font-extrabold text-xs sm:text-sm shadow-md transition flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <i className="fa-solid fa-wand-magic-sparkles"></i>
              <span>Open 36+ Poster Template Maker →</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mediaToolsList.map((tool) => (
              <div
                key={tool.id}
                className="bg-white rounded-3xl border border-slate-200 hover:border-purple-400 p-5 flex flex-col justify-between gap-4 shadow-xs transition group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-[#070a14] text-purple-400 border border-purple-500/30 flex items-center justify-center text-lg shadow-sm group-hover:scale-105 transition">
                      <i className={`fa-solid ${tool.icon.replace('fa-brands ', '')}`}></i>
                    </div>
                    {tool.badge && (
                      <span className="text-[11px] font-bold text-purple-700">{tool.badge}</span>
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
                  onClick={() => setActiveSubTool(tool.id as MediaLiveSubToolId)}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-2xl bg-[#070a14] hover:bg-slate-800 text-cyan-300 font-bold text-xs transition flex items-center justify-center gap-2"
                >
                  <span>Open {tool.name}</span>
                  <i className="fa-solid fa-arrow-right text-[11px]"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          CANVAS-BASED BROADCAST & POSTER TOOLS (TOOLS 1–10, 12–14)
         ===================================================================== */}
      {isCanvasGraphicTool && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Configuration Column */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            {/* Shared Quick Image Asset Upload Strip */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => bgUploadInputRef.current?.click()}
                className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center justify-center gap-1.5"
              >
                <i className="fa-solid fa-panorama text-cyan-600"></i>
                <span>Upload BG</span>
              </button>
              <button
                type="button"
                onClick={() => subjectUploadInputRef.current?.click()}
                className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center justify-center gap-1.5"
              >
                <i className="fa-solid fa-user-plus text-purple-600"></i>
                <span>Event Photo</span>
              </button>
              <button
                type="button"
                onClick={() => logoUploadInputRef.current?.click()}
                className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center justify-center gap-1.5"
              >
                <i className="fa-solid fa-stamp text-amber-600"></i>
                <span>Studio Logo</span>
              </button>
            </div>

            {/* Tool-Specific Controls */}
            {activeSubTool === 'live-streaming-poster' && (
              <div className="space-y-3">
                <h2 className="text-base font-extrabold text-slate-900">
                  Live Streaming Poster Maker
                </h2>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Template</label>
                  <select
                    value={livePosterTemplate}
                    onChange={(e) => setLivePosterTemplate(e.target.value as any)}
                    className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="youtube">YouTube Live Announcement</option>
                    <option value="wedding">Wedding Live</option>
                    <option value="church">Church Live</option>
                    <option value="funeral">Funeral Live</option>
                    <option value="general">General Event Live</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={livePosterTitle}
                  onChange={(e) => setLivePosterTitle(e.target.value)}
                  placeholder="Event Title"
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={livePosterDateTime}
                  onChange={(e) => setLivePosterDateTime(e.target.value)}
                  placeholder="Date & Time"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={livePosterPlatform}
                  onChange={(e) => setLivePosterPlatform(e.target.value)}
                  placeholder="Platform Name"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={livePosterUrl}
                  onChange={(e) => setLivePosterUrl(e.target.value)}
                  placeholder="YouTube or Facebook Live URL"
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={livePosterDesc}
                  onChange={(e) => setLivePosterDesc(e.target.value)}
                  placeholder="Event Description"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            )}

            {activeSubTool === 'youtube-thumbnail' && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">
                      Thumbnail Upload & Redesign Studio (1280×720)
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Upload any existing thumbnail to redesign it or build a fresh 16:9 HD thumbnail.
                    </p>
                  </div>
                </div>

                {/* Prominent Upload Existing Thumbnail Card */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-50 via-cyan-50 to-indigo-50 border-2 border-dashed border-purple-300 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-purple-950 flex items-center gap-1.5">
                      <i className="fa-solid fa-wand-magic-sparkles text-purple-600"></i>
                      <span>Upload Existing Thumbnail to Redesign</span>
                    </span>
                    {uploadedThumbUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          uploadedThumbImgRef.current = null;
                          setUploadedThumbUrl('');
                          setYtShowSubjectOverlay(true);
                          showToast('Cleared uploaded thumbnail.');
                        }}
                        className="text-[11px] font-bold text-rose-600 hover:underline"
                      >
                        Reset Image
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => thumbUploadInputRef.current?.click()}
                      className="flex-1 min-h-[42px] py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-extrabold text-xs shadow-xs flex items-center justify-center gap-2 transition"
                    >
                      <i className="fa-solid fa-cloud-arrow-up"></i>
                      <span>
                        {uploadedThumbUrl
                          ? 'Replace Existing Thumbnail Image'
                          : 'Upload Thumbnail Image (JPG / PNG / WebP)'}
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Redesign Style / Makeover Layout
                  </label>
                  <select
                    value={ytTemplate}
                    onChange={(e) => setYtTemplate(e.target.value as any)}
                    className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="redesign-glow">Vibrant Glow & Contrast Redesign</option>
                    <option value="breaking-banner">Breaking Broadcast Frame Redesign</option>
                    <option value="split-before-after">Before vs. After Split Redesign</option>
                    <option value="cyber">Cyber Cyan & Purple Studio</option>
                    <option value="fire">High-Contrast Crimson Action</option>
                    <option value="studio">Royal Studio Blue</option>
                  </select>
                </div>

                {/* Color Grading & Image Redesign Sliders */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                      Thumbnail Image Color Grading & Frame
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setYtRedesignBrightness(106);
                        setYtRedesignContrast(115);
                        setYtRedesignSaturation(122);
                        setYtRedesignTintOpacity(45);
                        setYtRedesignZoom(100);
                      }}
                      className="text-[10px] font-bold text-cyan-700 hover:underline"
                    >
                      Reset Filters
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Brightness ({ytRedesignBrightness}%)
                      </label>
                      <input
                        type="range"
                        min={60}
                        max={150}
                        value={ytRedesignBrightness}
                        onChange={(e) => setYtRedesignBrightness(parseInt(e.target.value, 10))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Contrast ({ytRedesignContrast}%)
                      </label>
                      <input
                        type="range"
                        min={70}
                        max={160}
                        value={ytRedesignContrast}
                        onChange={(e) => setYtRedesignContrast(parseInt(e.target.value, 10))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Saturation ({ytRedesignSaturation}%)
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={200}
                        value={ytRedesignSaturation}
                        onChange={(e) => setYtRedesignSaturation(parseInt(e.target.value, 10))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Dark Gradient Tint ({ytRedesignTintOpacity}%)
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={85}
                        value={ytRedesignTintOpacity}
                        onChange={(e) => setYtRedesignTintOpacity(parseInt(e.target.value, 10))}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      Thumbnail Zoom / Crop Scale ({ytRedesignZoom}%)
                    </label>
                    <input
                      type="range"
                      min={85}
                      max={150}
                      value={ytRedesignZoom}
                      onChange={(e) => setYtRedesignZoom(parseInt(e.target.value, 10))}
                      className="w-full"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ytShowSubjectOverlay}
                        onChange={(e) => setYtShowSubjectOverlay(e.target.checked)}
                        className="w-3.5 h-3.5 accent-purple-600 rounded"
                      />
                      <span>Right Subject Cutout</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ytShowNeonFrame}
                        onChange={(e) => setYtShowNeonFrame(e.target.checked)}
                        className="w-3.5 h-3.5 accent-cyan-600 rounded"
                      />
                      <span>Neon Border Frame</span>
                    </label>
                  </div>
                </div>

                <input
                  type="text"
                  value={ytTitle}
                  onChange={(e) => setYtTitle(e.target.value)}
                  placeholder="Redesigned Thumbnail Headline"
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={ytSubtitle}
                  onChange={(e) => setYtSubtitle(e.target.value)}
                  placeholder="Subtitle Banner Text"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={ytBadgeText}
                  onChange={(e) => setYtBadgeText(e.target.value)}
                  placeholder="Top Tag Badge (e.g. NEW REDESIGN)"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Text Outline ({ytOutlineWidth}px)
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={16}
                      value={ytOutlineWidth}
                      onChange={(e) => setYtOutlineWidth(parseInt(e.target.value, 10))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Shadow Blur ({ytShadowBlur}px)
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      value={ytShadowBlur}
                      onChange={(e) => setYtShadowBlur(parseInt(e.target.value, 10))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeSubTool === 'live-countdown' && (
              <div className="space-y-3">
                <h2 className="text-base font-extrabold text-slate-900">Live Countdown Maker</h2>
                <input
                  type="text"
                  value={cdEventTitle}
                  onChange={(e) => setCdEventTitle(e.target.value)}
                  placeholder="Countdown Title"
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                />
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Event Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={cdTargetIso}
                    onChange={(e) => setCdTargetIso(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <select
                  value={cdStyle}
                  onChange={(e) => setCdStyle(e.target.value as any)}
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="neon">Obsidian Neon Cards</option>
                  <option value="broadcast">Studio Broadcast Blue</option>
                  <option value="royal">Royal Velvet</option>
                </select>
                <button
                  type="button"
                  disabled={isRecordingCdVideo}
                  onClick={() => recordCanvasWebmAnimation(5000, 'countdown')}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-video"></i>
                  <span>
                    {isRecordingCdVideo
                      ? 'Recording Live Ticking Video (5s)...'
                      : 'Export 5s Animated Countdown Video (.WebM)'}
                  </span>
                </button>
              </div>
            )}

            {activeSubTool === 'lower-third' && (
              <div className="space-y-3">
                <h2 className="text-base font-extrabold text-slate-900">
                  Lower Third Generator (Transparent 16:9)
                </h2>
                <input
                  type="text"
                  value={ltName}
                  onChange={(e) => setLtName(e.target.value)}
                  placeholder="Person's Full Name"
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={ltDesignation}
                  onChange={(e) => setLtDesignation(e.target.value)}
                  placeholder="Designation / Role"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={ltOrg}
                  onChange={(e) => setLtOrg(e.target.value)}
                  placeholder="Organization / Studio Name"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={ltResolution}
                    onChange={(e) => setLtResolution(e.target.value as any)}
                    className="min-h-[40px] px-2.5 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="1080p">1920×1080 (Full HD)</option>
                    <option value="720p">1280×720 (HD)</option>
                  </select>
                  <input
                    type="color"
                    value={ltBgColor}
                    onChange={(e) => setLtBgColor(e.target.value)}
                    className="w-full h-[40px] rounded-xl cursor-pointer"
                  />
                </div>
                <button
                  type="button"
                  disabled={isRecordingLtVideo}
                  onClick={() => recordCanvasWebmAnimation(4000, 'lower-third')}
                  className="w-full min-h-[42px] py-2 px-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 font-bold text-xs"
                >
                  {isRecordingLtVideo
                    ? 'Recording Broadcast WebM...'
                    : 'Export Animated Lower Third (.WebM)'}
                </button>
              </div>
            )}

            {activeSubTool === 'live-title' && (
              <div className="space-y-3">
                <h2 className="text-base font-extrabold text-slate-900">Live Title Generator</h2>
                <select
                  value={titleTemplate}
                  onChange={(e) => setTitleTemplate(e.target.value as any)}
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="wedding">Wedding Ceremony</option>
                  <option value="church">Church Service</option>
                  <option value="funeral">Funeral Service</option>
                  <option value="special">Special Events</option>
                  <option value="program">Live Program Titles</option>
                </select>
                <input
                  type="text"
                  value={titleMain}
                  onChange={(e) => setTitleMain(e.target.value)}
                  placeholder="Event Title"
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={titleSub}
                  onChange={(e) => setTitleSub(e.target.value)}
                  placeholder="Subtitle"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={titleDate}
                  onChange={(e) => setTitleDate(e.target.value)}
                  placeholder="Event Date"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={titleStudio}
                  onChange={(e) => setTitleStudio(e.target.value)}
                  placeholder="Organization / Studio Name"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            )}

            {activeSubTool === 'wedding-live-poster' && (
              <div className="space-y-3">
                <h2 className="text-base font-extrabold text-slate-900">Wedding Live Poster</h2>
                <select
                  value={wedTemplate}
                  onChange={(e) => setWedTemplate(e.target.value as any)}
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="royal-gold">Royal Crimson & Gold</option>
                  <option value="floral-rose">Velvet Rose</option>
                  <option value="emerald-palace">Emerald Palace</option>
                </select>
                <input
                  type="text"
                  value={wedBride}
                  onChange={(e) => setWedBride(e.target.value)}
                  placeholder="Bride's Name"
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={wedGroom}
                  onChange={(e) => setWedGroom(e.target.value)}
                  placeholder="Groom's Name"
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={wedDate}
                  onChange={(e) => setWedDate(e.target.value)}
                  placeholder="Wedding Date & Time"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={wedVenue}
                  onChange={(e) => setWedVenue(e.target.value)}
                  placeholder="Wedding Venue"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={wedUrl}
                  onChange={(e) => setWedUrl(e.target.value)}
                  placeholder="Live Streaming URL"
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            )}

            {activeSubTool === 'funeral-live-poster' && (
              <div className="space-y-3">
                <h2 className="text-base font-extrabold text-slate-900">
                  Funeral Live Poster (Dignified Memorial)
                </h2>
                <select
                  value={funTemplate}
                  onChange={(e) => setFunTemplate(e.target.value as any)}
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="ivory-dignified">Ivory Memorial (Minimal Light)</option>
                  <option value="charcoal-memorial">Charcoal Tribute (Respectful Dark)</option>
                  <option value="classic-serif">Classic Dignified Frame</option>
                </select>
                <input
                  type="text"
                  value={funName}
                  onChange={(e) => setFunName(e.target.value)}
                  placeholder="Person's Name"
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={funDates}
                  onChange={(e) => setFunDates(e.target.value)}
                  placeholder="Dates & Tribute Subtitle"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
                <textarea
                  rows={2}
                  value={funDetails}
                  onChange={(e) => setFunDetails(e.target.value)}
                  placeholder="Funeral Service Information"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={funUrl}
                  onChange={(e) => setFunUrl(e.target.value)}
                  placeholder="Live Streaming URL"
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            )}

            {activeSubTool === 'church-live-poster' && (
              <div className="space-y-3">
                <h2 className="text-base font-extrabold text-slate-900">Church Live Poster</h2>
                <select
                  value={chTemplate}
                  onChange={(e) => setChTemplate(e.target.value as any)}
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="festival">Church Festivals</option>
                  <option value="sunday-worship">Sunday Worship</option>
                  <option value="prayer-meeting">Prayer Meetings</option>
                  <option value="special-event">Special Church Events</option>
                </select>
                <input
                  type="text"
                  value={chName}
                  onChange={(e) => setChName(e.target.value)}
                  placeholder="Church Name"
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={chEvent}
                  onChange={(e) => setChEvent(e.target.value)}
                  placeholder="Service / Event Name"
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={chDateTime}
                  onChange={(e) => setChDateTime(e.target.value)}
                  placeholder="Service Date & Time"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={chDetails}
                  onChange={(e) => setChDetails(e.target.value)}
                  placeholder="Event Details / Celebrant"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={chUrl}
                  onChange={(e) => setChUrl(e.target.value)}
                  placeholder="Live Streaming URL"
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            )}

            {activeSubTool === 'logo-overlay' && (
              <div className="space-y-3">
                <h2 className="text-base font-extrabold text-slate-900">
                  Logo Overlay Maker (1920×1080 Transparent)
                </h2>
                <select
                  value={logoCorner}
                  onChange={(e) => setLogoCorner(e.target.value as any)}
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="top-right">Top Right Corner</option>
                  <option value="top-left">Top Left Corner</option>
                  <option value="bottom-right">Bottom Right Corner</option>
                  <option value="bottom-left">Bottom Left Corner</option>
                </select>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Logo Scale ({logoScale}%)
                  </label>
                  <input
                    type="range"
                    min={40}
                    max={200}
                    value={logoScale}
                    onChange={(e) => setLogoScale(parseInt(e.target.value, 10))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Opacity ({logoOpacity}%)
                  </label>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    value={logoOpacity}
                    onChange={(e) => setLogoOpacity(parseInt(e.target.value, 10))}
                    className="w-full"
                  />
                </div>
                <input
                  type="text"
                  value={logoTagText}
                  onChange={(e) => setLogoTagText(e.target.value)}
                  placeholder="Optional Label (e.g. LIVE HD)"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            )}

            {activeSubTool === 'qr-code-overlay' && (
              <div className="space-y-3">
                <h2 className="text-base font-extrabold text-slate-900">
                  QR Code Broadcast Overlay
                </h2>
                <input
                  type="text"
                  value={qrOverlayUrl}
                  onChange={(e) => setQrOverlayUrl(e.target.value)}
                  placeholder="Target URL for QR Code"
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={qrOverlayTitle}
                  onChange={(e) => setQrOverlayTitle(e.target.value)}
                  placeholder="Overlay Title"
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={qrOverlayCta}
                  onChange={(e) => setQrOverlayCta(e.target.value)}
                  placeholder="Call-to-Action Text"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
                <select
                  value={qrOverlayCorner}
                  onChange={(e) => setQrOverlayCorner(e.target.value as any)}
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="bottom-right">Bottom Right Broadcast Position</option>
                  <option value="bottom-left">Bottom Left Broadcast Position</option>
                  <option value="top-right">Top Right Broadcast Position</option>
                </select>
              </div>
            )}

            {activeSubTool === 'streaming-schedule' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-slate-900">
                    Streaming Schedule Maker
                  </h2>
                  <button
                    type="button"
                    onClick={() =>
                      setSchedSlots((prev) => [
                        ...prev,
                        {
                          id: `slot-${Date.now()}`,
                          eventName: 'New Live Broadcast Event',
                          dateText: 'Friday, Nov 20',
                          startTime: '05:00 PM',
                          endTime: '07:00 PM',
                          platform: 'YouTube Live',
                          url: 'youtube.com/@malnadumedia',
                        },
                      ])
                    }
                    className="px-2.5 py-1 rounded-lg bg-cyan-50 text-cyan-800 border border-cyan-200 text-xs font-bold"
                  >
                    + Add Event
                  </button>
                </div>
                <input
                  type="text"
                  value={schedTitle}
                  onChange={(e) => setSchedTitle(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                />
                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                  {schedSlots.map((slot, idx) => (
                    <div
                      key={slot.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-cyan-700">
                          Event #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSchedSlots((prev) => prev.filter((s) => s.id !== slot.id))
                          }
                          className="text-xs text-rose-600"
                        >
                          Remove
                        </button>
                      </div>
                      <input
                        type="text"
                        value={slot.eventName}
                        onChange={(e) =>
                          setSchedSlots((prev) =>
                            prev.map((s) =>
                              s.id === slot.id ? { ...s, eventName: e.target.value } : s
                            )
                          )
                        }
                        className="w-full px-2.5 py-1 text-xs font-bold bg-white border border-slate-200 rounded-lg"
                      />
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          value={slot.dateText}
                          onChange={(e) =>
                            setSchedSlots((prev) =>
                              prev.map((s) =>
                                s.id === slot.id ? { ...s, dateText: e.target.value } : s
                              )
                            )
                          }
                          className="px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-lg"
                        />
                        <input
                          type="text"
                          value={slot.startTime}
                          onChange={(e) =>
                            setSchedSlots((prev) =>
                              prev.map((s) =>
                                s.id === slot.id ? { ...s, startTime: e.target.value } : s
                              )
                            )
                          }
                          className="px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-lg"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSubTool === 'obs-vmix-export' && (
              <div className="space-y-3">
                <h2 className="text-base font-extrabold text-slate-900">
                  OBS / vMix Broadcast Graphics Export
                </h2>
                <p className="text-xs text-slate-500">
                  Generate 16:9 transparent PNG overlays compatible with OBS Studio Image Sources and vMix inputs.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Broadcast Resolution
                    </label>
                    <select
                      value={obsRes}
                      onChange={(e) => setObsRes(e.target.value as any)}
                      className="w-full min-h-[40px] px-2.5 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <option value="1920x1080">1920 × 1080 (Full HD)</option>
                      <option value="1280x720">1280 × 720 (HD)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Overlay Layer
                    </label>
                    <select
                      value={obsGraphicType}
                      onChange={(e) => setObsGraphicType(e.target.value as any)}
                      className="w-full min-h-[40px] px-2.5 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <option value="live-frame">Complete Broadcast Frame</option>
                      <option value="lower-third">Lower Third Only</option>
                      <option value="logo-bug">Logo Bug Only</option>
                      <option value="qr-bug">QR Code Overlay Only</option>
                      <option value="starting-soon">Starting Soon Screen</option>
                    </select>
                  </div>
                </div>
                <label className="flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer">
                  <span>Transparent Alpha Channel (For OBS/vMix Overlay)</span>
                  <input
                    type="checkbox"
                    checked={obsTransparent}
                    onChange={(e) => setObsTransparent(e.target.checked)}
                    className="w-4 h-4 accent-cyan-600 rounded"
                  />
                </label>
              </div>
            )}

            {activeSubTool === 'led-screen-layout' && (
              <div className="space-y-3">
                <h2 className="text-base font-extrabold text-slate-900">
                  LED Screen Layout Maker
                </h2>
                <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
                  {(['16:9', '4:3', '1:1', 'custom'] as const).map((ar) => (
                    <button
                      key={ar}
                      type="button"
                      onClick={() => setLedAspect(ar)}
                      className={`py-2 rounded-xl border uppercase ${
                        ledAspect === ar
                          ? 'bg-[#070a14] text-cyan-300 border-cyan-500'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {ar}
                    </button>
                  ))}
                </div>
                {ledAspect === 'custom' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={ledCustomW}
                      onChange={(e) => setLedCustomW(parseInt(e.target.value, 10) || 1920)}
                      placeholder="Width (px)"
                      className="min-h-[40px] px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                    />
                    <input
                      type="number"
                      value={ledCustomH}
                      onChange={(e) => setLedCustomH(parseInt(e.target.value, 10) || 1080)}
                      placeholder="Height (px)"
                      className="min-h-[40px] px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                )}
                <input
                  type="text"
                  value={ledHeadline}
                  onChange={(e) => setLedHeadline(e.target.value)}
                  placeholder="Main Stage Headline"
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={ledSubheadline}
                  onChange={(e) => setLedSubheadline(e.target.value)}
                  placeholder="Subheadline / Couple / Event Name"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
                <label className="flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer">
                  <span>Show LED Cabinet Calibration Grid</span>
                  <input
                    type="checkbox"
                    checked={ledShowGrid}
                    onChange={(e) => setLedShowGrid(e.target.checked)}
                    className="w-4 h-4 accent-cyan-600 rounded"
                  />
                </label>
              </div>
            )}

            {/* Shared Typography & Color Customization */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  Font Style
                </label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="w-full h-[36px] px-2 text-xs font-bold bg-white border border-slate-200 rounded-lg"
                >
                  <option value="Plus Jakarta Sans">Modern Sans</option>
                  <option value="Georgia">Royal Serif</option>
                  <option value="Impact">Broadcast Bold</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  Text Color
                </label>
                <input
                  type="color"
                  value={primaryTextColor}
                  onChange={(e) => setPrimaryTextColor(e.target.value)}
                  className="w-full h-[36px] rounded-lg cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  Accent Color
                </label>
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-full h-[36px] rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Export Buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={() => exportCurrentGraphic('png')}
                className="min-h-[48px] py-3 px-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-download"></i>
                <span>Export PNG</span>
              </button>
              <button
                onClick={() => exportCurrentGraphic('jpg')}
                className="min-h-[48px] py-3 px-3 rounded-2xl bg-[#070a14] text-cyan-300 font-bold text-xs flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-file-image"></i>
                <span>Export JPG</span>
              </button>
            </div>
          </div>

          {/* Right Live Canvas Preview */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Live Broadcast Graphic Preview
                </h3>
                <p className="text-xs text-slate-500">
                  High-resolution 16:9 / Custom studio render
                </p>
              </div>
            </div>

            <div className="w-full min-h-[340px] sm:min-h-[420px] rounded-2xl checkerboard border border-slate-200 p-3 flex items-center justify-center overflow-hidden">
              <canvas
                ref={mainGraphicCanvasRef}
                className="max-w-full max-h-[400px] w-auto h-auto rounded-xl shadow-lg border border-slate-300"
              />
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 11: YOUTUBE DESCRIPTION GENERATOR
         ===================================================================== */}
      {activeSubTool === 'youtube-description' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <h2 className="text-lg font-extrabold text-slate-900">
              YouTube Description & Hashtag Generator
            </h2>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Video Title</label>
              <input
                type="text"
                value={descTitle}
                onChange={(e) => setDescTitle(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Video Topic / Summary</label>
              <textarea
                rows={2}
                value={descTopic}
                onChange={(e) => setDescTopic(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Keywords (Comma-Separated)
              </label>
              <input
                type="text"
                value={descKeywords}
                onChange={(e) => setDescKeywords(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tone & Style</label>
                <select
                  value={descLanguage}
                  onChange={(e) => setDescLanguage(e.target.value as any)}
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="Standard Broadcast">Standard Broadcast (English)</option>
                  <option value="High-CTR SEO">High-CTR SEO (English)</option>
                  <option value="Formal Event">Formal Event (English)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={descCategory}
                  onChange={(e) => setDescCategory(e.target.value as any)}
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="Wedding Live">Wedding Live</option>
                  <option value="Church / Devotional">Church / Devotional</option>
                  <option value="Tech / Tutorial">Tech / Tutorial</option>
                  <option value="Vlog / Entertainment">Vlog / Entertainment</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleGenerateYoutubeDescription}
              disabled={isGeneratingDesc}
              className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-wand-magic-sparkles"></i>
              <span>Generate Description & Hashtags</span>
            </button>
          </div>

          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                Generated YouTube Description ({descLanguage})
              </h3>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedDescText);
                  showToast('Copied YouTube Description to clipboard!');
                }}
                className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#070a14] text-cyan-300 text-xs font-bold flex items-center gap-1.5"
              >
                <i className="fa-solid fa-copy"></i>
                <span>Copy Description</span>
              </button>
            </div>
            <textarea
              rows={15}
              value={generatedDescText}
              onChange={(e) => setGeneratedDescText(e.target.value)}
              className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 leading-relaxed"
            />
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 15: VIDEO CONVERTER
         ===================================================================== */}
      {activeSubTool === 'video-converter' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Video Converter</h2>
                <p className="text-xs text-slate-500">
                  Real browser stream transcoding with resolution and bitrate control.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateSampleTestVideo}
                className="px-3 py-1.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-bold"
              >
                Sample Video
              </button>
            </div>

            {videoErrorMsg && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                {videoErrorMsg}
              </div>
            )}

            <button
              onClick={() => videoInputRef.current?.click()}
              className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-film"></i>
              <span>Upload Video File (MP4, WebM, MOV)</span>
            </button>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoFileUpload}
              className="hidden"
            />

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Output Format
                  </label>
                  <select
                    value={videoTargetFormat}
                    onChange={(e) => setVideoTargetFormat(e.target.value as any)}
                    className="w-full min-h-[38px] px-2 py-1 text-xs font-bold bg-white border border-slate-200 rounded-xl"
                  >
                    <option value="webm">WebM (VP9)</option>
                    <option value="mp4">MP4</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Resolution
                  </label>
                  <select
                    value={videoTargetRes}
                    onChange={(e) => setVideoTargetRes(e.target.value as any)}
                    className="w-full min-h-[38px] px-2 py-1 text-xs font-bold bg-white border border-slate-200 rounded-xl"
                  >
                    <option value="1080p">1080p Full HD</option>
                    <option value="720p">720p HD</option>
                    <option value="480p">480p SD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Bitrate Quality
                  </label>
                  <select
                    value={videoTargetQuality}
                    onChange={(e) => setVideoTargetQuality(e.target.value as any)}
                    className="w-full min-h-[38px] px-2 py-1 text-xs font-bold bg-white border border-slate-200 rounded-xl"
                  >
                    <option value="high">High (4.5 Mbps)</option>
                    <option value="medium">Standard (2.2 Mbps)</option>
                    <option value="compact">Compact (1 Mbps)</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={handleExecuteVideoConversion}
              disabled={!videoSrcUrl || isConvertingVideo}
              className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-[#070a14] text-cyan-300 font-bold text-xs disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-bolt"></i>
              <span>
                {isConvertingVideo
                  ? `Converting Video (${videoConvertProgress}%)...`
                  : 'Convert Video Now'}
              </span>
            </button>
          </div>

          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3">
              Video Preview & Converted Output
            </h3>

            {videoSrcUrl ? (
              <div className="space-y-4">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Source: {videoFileName}</span>
                    <span className="font-mono text-cyan-700">
                      {(videoFileSize / 1024).toFixed(1)} KB · {videoDuration.toFixed(1)}s
                    </span>
                  </div>
                  <video
                    ref={videoPreviewElRef}
                    src={videoSrcUrl}
                    controls
                    onLoadedMetadata={(e) => {
                      const v = e.currentTarget;
                      setVideoDuration(v.duration || 0);
                      setVideoOrigW(v.videoWidth || 640);
                      setVideoOrigH(v.videoHeight || 360);
                    }}
                    className="w-full max-h-[240px] rounded-xl bg-black"
                  />
                </div>

                {convertedVideoUrl && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-extrabold text-emerald-950">
                        Converted Video Ready ({videoTargetRes} · {convertedVideoExt.toUpperCase()})
                      </div>
                      <div className="text-xs font-mono text-emerald-700">
                        Output Size: {(convertedVideoBytes / 1024).toFixed(1)} KB
                      </div>
                    </div>
                    <a
                      href={convertedVideoUrl}
                      download={`malnadu-converted-${videoTargetRes}.${convertedVideoExt}`}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-2"
                    >
                      <i className="fa-solid fa-download"></i>
                      <span>Download Video</span>
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                Upload a video file or click "Sample Video" to preview and transcode.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
