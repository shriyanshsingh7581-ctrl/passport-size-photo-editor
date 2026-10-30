export interface CountryPreset {
  id: string;
  country: string;
  flag: string;
  widthMm: number;
  heightMm: number;
  sheetCount: number;
  cols: number;
  rows: number;
  desc: string;
}

export interface BgSwatch {
  name: string;
  mal: string;
  hex: string;
  color: string;
  checker?: boolean;
  border: string;
}

export type ToolCategoryId = 'studio' | 'akshaya' | 'media-live';

export interface ToolCatalogItem {
  id: string;
  category: ToolCategoryId;
  name: string;
  description: string;
  icon: string;
  badge?: string;
  enabled: boolean;
}

export const DEFAULT_TOOL_CATALOG: ToolCatalogItem[] = [
  // CATEGORY 1 (A): STUDIO TOOLS
  {
    id: 'passport-editor',
    category: 'studio',
    name: 'Passport Photo Maker',
    description:
      'High-resolution biometric passport photo studio with non-destructive retouching, hair matting, blue spill removal, and interactive print sheets.',
    icon: 'fa-id-card',
    badge: 'Flagship HD',
    enabled: true,
  },
  {
    id: 'bg-remover',
    category: 'studio',
    name: 'Background Remover',
    description:
      'High-resolution AI background cutout with fine hair strand matting, blue color spill decontamination, and manual edge brush.',
    icon: 'fa-wand-magic-sparkles',
    badge: 'Hair Matting',
    enabled: true,
  },
  {
    id: 'bg-changer',
    category: 'studio',
    name: 'Background Changer',
    description:
      'Replace photo backgrounds with official passport colors, studio gradients, or custom colours while preserving original resolution.',
    icon: 'fa-palette',
    badge: 'Studio Colors',
    enabled: true,
  },
  {
    id: 'photo-resize',
    category: 'studio',
    name: 'Photo Resize',
    description:
      'Resize portraits and studio photos in px, mm, cm, or inches with custom DPI, aspect ratio lock, and format conversion.',
    icon: 'fa-maximize',
    badge: '300/600 DPI',
    enabled: true,
  },
  {
    id: 'photo-print-sheet',
    category: 'studio',
    name: 'Photo Print Sheet',
    description:
      'Interactive object-based print sheet editor with individual photo drag-and-drop, free positioning, resize, rotate, and 6×4, 4×6, 5×7, A4, A5 PDF/PNG/JPG export.',
    icon: 'fa-table-cells',
    badge: 'Free Drag & Drop',
    enabled: true,
  },
  {
    id: 'clarity-enhancer',
    category: 'studio',
    name: 'Photo Clarity Enhancer',
    description: 'Unsharp mask facial sharpening, micro-contrast, and studio luminance balancing.',
    icon: 'fa-sparkles',
    enabled: true,
  },
  {
    id: 'qr-generator',
    category: 'studio',
    name: 'Studio QR Code Generator',
    description: 'Create high-resolution scannable QR codes with custom foreground/background colors.',
    icon: 'fa-qrcode',
    enabled: true,
  },
  {
    id: 'link-shortener',
    category: 'studio',
    name: 'Custom Link Shortener',
    description: 'Create branded short redirect links for digital photo delivery and event pages.',
    icon: 'fa-link',
    enabled: true,
  },

  // CATEGORY 2: AKSHAYA TOOLS
  {
    id: 'pdf-merge',
    category: 'akshaya',
    name: 'PDF Merge',
    description: 'Combine multiple PDF documents in custom order with page count inspection and instant download.',
    icon: 'fa-file-pdf',
    badge: 'Akshaya Pro',
    enabled: true,
  },
  {
    id: 'pdf-split',
    category: 'akshaya',
    name: 'PDF Split & Extract',
    description: 'Split PDFs by page ranges, extract selected pages, or burst every page into a ZIP archive.',
    icon: 'fa-scissors',
    enabled: true,
  },
  {
    id: 'pdf-compressor',
    category: 'akshaya',
    name: 'PDF Compressor',
    description: 'Reduce PDF file size for government portals while preserving text and document readability.',
    icon: 'fa-file-zipper',
    enabled: true,
  },
  {
    id: 'image-compressor',
    category: 'akshaya',
    name: 'Batch Image Compressor',
    description: 'Compress single or multiple images to exact quality targets in JPG, WebP, or PNG with ZIP export.',
    icon: 'fa-compress',
    enabled: true,
  },
  {
    id: 'signature-resize',
    category: 'akshaya',
    name: 'Signature Resize & Clean',
    description: 'Resize signatures for SSC, PSC, PAN, IBPS & Passport portals with white-background removal.',
    icon: 'fa-signature',
    badge: 'Portal Ready',
    enabled: true,
  },

  // CATEGORY 3: MEDIA & LIVE TOOLS
  {
    id: 'live-streaming-poster',
    category: 'media-live',
    name: 'Live Streaming Poster Maker',
    description: 'Design announcement posters for Wedding, Church, Funeral, and YouTube Live streams.',
    icon: 'fa-tower-broadcast',
    badge: 'Live Studio',
    enabled: true,
  },
  {
    id: 'youtube-thumbnail',
    category: 'media-live',
    name: 'YouTube Thumbnail Maker',
    description: 'Create high-CTR 1280×720 (16:9) YouTube thumbnails with cutouts, outlines, and bold typography.',
    icon: 'fa-brands fa-youtube',
    badge: '1280×720 HD',
    enabled: true,
  },
  {
    id: 'live-countdown',
    category: 'media-live',
    name: 'Live Countdown Maker',
    description: 'Real-time ticking event countdown with animated WebM video recording and frame export.',
    icon: 'fa-stopwatch',
    badge: 'Video Export',
    enabled: true,
  },
  {
    id: 'lower-third',
    category: 'media-live',
    name: 'Lower Third Generator',
    description: '16:9 transparent broadcast lower thirds for OBS & vMix with PNG and animated WebM export.',
    icon: 'fa-clapperboard',
    badge: 'OBS / vMix',
    enabled: true,
  },
  {
    id: 'live-title',
    category: 'media-live',
    name: 'Live Title Generator',
    description: 'Full-screen broadcast title cards for weddings, church services, funerals, and special programs.',
    icon: 'fa-heading',
    enabled: true,
  },
  {
    id: 'wedding-live-poster',
    category: 'media-live',
    name: 'Wedding Live Poster',
    description: 'Luxury wedding live stream posters featuring Bride & Groom names, couple photo, venue, and link.',
    icon: 'fa-heart',
    enabled: true,
  },
  {
    id: 'funeral-live-poster',
    category: 'media-live',
    name: 'Funeral Live Poster',
    description: 'Respectful, dignified memorial & funeral live service announcement posters.',
    icon: 'fa-dove',
    enabled: true,
  },
  {
    id: 'church-live-poster',
    category: 'media-live',
    name: 'Church Live Poster',
    description: 'Elegant posters for Sunday Worship, Church Festivals, Prayer Meetings, and Live Services.',
    icon: 'fa-church',
    enabled: true,
  },
  {
    id: 'logo-overlay',
    category: 'media-live',
    name: 'Logo Overlay Maker',
    description: 'Generate 1920×1080 transparent broadcast bug/watermark logo overlays for OBS & vMix.',
    icon: 'fa-layer-group',
    enabled: true,
  },
  {
    id: 'qr-code-overlay',
    category: 'media-live',
    name: 'QR Code Broadcast Overlay',
    description: 'Scannable transparent 16:9 QR code overlays with call-to-action banners for live streams.',
    icon: 'fa-qrcode',
    enabled: true,
  },
  {
    id: 'youtube-description',
    category: 'media-live',
    name: 'YouTube Description Generator',
    description: 'Generate SEO-optimized YouTube descriptions, timestamps, CTAs & hashtags in English, Hindi & Hinglish.',
    icon: 'fa-pen-nib',
    badge: 'Multi-Lang',
    enabled: true,
  },
  {
    id: 'streaming-schedule',
    category: 'media-live',
    name: 'Streaming Schedule Maker',
    description: 'Multi-slot live broadcast schedule posters for studios, churches, and content creators.',
    icon: 'fa-calendar-days',
    enabled: true,
  },
  {
    id: 'obs-vmix-export',
    category: 'media-live',
    name: 'OBS / vMix Graphics Export',
    description: 'Export 1920×1080 & 1280×720 transparent broadcast overlay packs ready for OBS Studio and vMix.',
    icon: 'fa-sliders',
    badge: 'Broadcast Pack',
    enabled: true,
  },
  {
    id: 'led-screen-layout',
    category: 'media-live',
    name: 'LED Screen Layout Maker',
    description: 'Design stage LED wall backdrops in 16:9, 4:3, 1:1, or custom pixel dimensions for events.',
    icon: 'fa-tv',
    enabled: true,
  },
  {
    id: 'video-converter',
    category: 'media-live',
    name: 'Video Converter',
    description: 'Convert videos to WebM/MP4 with resolution scaling (1080p/720p/480p) and bitrate control.',
    icon: 'fa-film',
    enabled: true,
  },
];

export interface SiteSettings {
  brandName: string;
  brandTagline: string;
  logoType: 'svg' | 'url';
  logoText: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  footerCredit: string;
  seoTitle: string;
  seoDescription: string;
  enablePassportStudio: boolean;
  enableBgRemover: boolean;
  enableClarityEnhancer: boolean;
  enableQrGenerator: boolean;
  enableLinkShortener: boolean;
  enableStudioToolsCategory: boolean;
  enableAkshayaToolsCategory: boolean;
  enableMediaLiveToolsCategory: boolean;
  contactPhone?: string;
  toolCatalog?: ToolCatalogItem[];
  updatedAt?: any;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  brandName: 'MALNADU MEDIA',
  brandTagline: 'CAPTURING | CREATING | CONNECTING',
  logoType: 'url',
  logoText: 'MM',
  logoUrl: '/assets/aistudio/IMG-20261029-WA0055_86fec676.jpg',
  faviconUrl: '/assets/aistudio/IMG-20261029-WA0055_86fec676.jpg',
  primaryColor: '#06b6d4',
  secondaryColor: '#070a14',
  footerCredit: '© 2026 MALNADU MEDIA SOLUTIONS. All rights reserved.',
  seoTitle: 'MALNADU MEDIA — Studio Tools, Akshaya Tools & Live Media Graphics Platform',
  seoDescription:
    'MALNADU MEDIA Solutions — Capturing | Creating | Connecting. Complete Studio Tools, Akshaya Document & PDF Tools, and Live Streaming & Broadcast Graphics Platform.',
  enablePassportStudio: true,
  enableBgRemover: true,
  enableClarityEnhancer: true,
  enableQrGenerator: true,
  enableLinkShortener: true,
  enableStudioToolsCategory: true,
  enableAkshayaToolsCategory: true,
  enableMediaLiveToolsCategory: true,
  contactPhone: '+91 98450 11223',
  toolCatalog: DEFAULT_TOOL_CATALOG,
};

export interface ShortLinkRecord {
  id: string;
  slug: string;
  originalUrl: string;
  createdBy: string;
  creatorEmail: string;
  active: boolean;
  clicks: number;
  createdAt?: any;
  updatedAt?: any;
}

export const COUNTRY_PRESETS: CountryPreset[] = [
  {
    id: 'in-stamp',
    country: 'India Standard Passport Size (35×45 mm)',
    flag: '🇮🇳',
    widthMm: 35,
    heightMm: 45,
    sheetCount: 8,
    cols: 4,
    rows: 2,
    desc: '35 × 45 mm • Exact 8 Photos (4×2) on 6×4" Sheet',
  },
  {
    id: 'in-passport',
    country: 'India Passport Seva / OCI (2×2 inch)',
    flag: '🇮🇳',
    widthMm: 50.8,
    heightMm: 50.8,
    sheetCount: 6,
    cols: 3,
    rows: 2,
    desc: '2 × 2 inch (50.8 × 50.8 mm) • Exact 6 Photos (3×2) on 6×4" Sheet',
  },
  {
    id: 'uk-passport',
    country: 'UK Passport & Visa (യു.കെ പാസ്‌പോർട്ട്)',
    flag: '🇬🇧',
    widthMm: 35,
    heightMm: 45,
    sheetCount: 8,
    cols: 4,
    rows: 2,
    desc: '35 × 45 mm • Exact 8 Photos (4×2) on 6×4" Sheet',
  },
  {
    id: 'us-passport',
    country: 'US Passport & Visa (യു.എസ് പാസ്‌പോർട്ട്)',
    flag: '🇺🇸',
    widthMm: 50.8,
    heightMm: 50.8,
    sheetCount: 6,
    cols: 3,
    rows: 2,
    desc: '2 × 2 inch (50.8 × 50.8 mm) • Exact 6 Photos (3×2) on 6×4" Sheet',
  },
  {
    id: 'uae-visa',
    country: 'UAE / Dubai Visa & Emirates ID (യു.എ.ഇ)',
    flag: '🇦🇪',
    widthMm: 43,
    heightMm: 55,
    sheetCount: 4,
    cols: 2,
    rows: 2,
    desc: '43 × 55 mm • Exact 4 Photos (2×2) on 6×4" Sheet',
  },
  {
    id: 'schengen-visa',
    country: 'Schengen / Europe Visa (യൂറോപ്പ് വിസ)',
    flag: '🇪🇺',
    widthMm: 35,
    heightMm: 45,
    sheetCount: 8,
    cols: 4,
    rows: 2,
    desc: '35 × 45 mm • Exact 8 Photos (4×2) on 6×4" Sheet',
  },
  {
    id: 'in-pan',
    country: 'India PAN Card / Kerala PSC (25×35 mm)',
    flag: '🇮🇳',
    widthMm: 25,
    heightMm: 35,
    sheetCount: 12,
    cols: 4,
    rows: 3,
    desc: '25 × 35 mm • Exact 12 Photos (4×3) on 6×4" Sheet',
  },
  {
    id: 'canada-passport',
    country: 'Canada Passport & Visa (50×70 mm)',
    flag: '🇨🇦',
    widthMm: 50,
    heightMm: 70,
    sheetCount: 2,
    cols: 2,
    rows: 1,
    desc: '50 × 70 mm • Exact 2 Photos (2×1) on 6×4" Sheet',
  },
];

export const BG_SWATCHES: BgSwatch[] = [
  { name: 'Pure White', mal: 'വെള്ള', hex: '#FFFFFF', color: '#FFFFFF', border: '#cbd5e1' },
  { name: 'UK Cream/Grey', mal: 'ഓഫ് വൈറ്റ്', hex: '#F2F2F2', color: '#F2F2F2', border: '#cbd5e1' },
  { name: 'Light Blue', mal: 'ഇളം നീല', hex: '#D0E7FF', color: '#D0E7FF', border: '#93c5fd' },
  { name: 'Sky Blue', mal: 'സ്കൈ ബ്ലൂ', hex: '#7CC0FF', color: '#7CC0FF', border: '#60a5fa' },
  { name: 'Royal Blue', mal: 'കടും നീല', hex: '#1E40AF', color: '#1E40AF', border: '#1e3a8a' },
  { name: 'Light Grey', mal: 'ചാരനിറം', hex: '#E2E8F0', color: '#E2E8F0', border: '#94a3b8' },
  { name: 'ID Red', mal: 'ചുവപ്പ്', hex: '#DC2626', color: '#DC2626', border: '#b91c1c' },
  { name: 'Transparent', mal: 'ട്രാൻസ്പരന്റ്', hex: 'transparent', color: 'transparent', checker: true, border: '#94a3b8' },
];

export const SERVICE_TYPES = [
  'Passport Photo Shoot',
  'Visa Biometric Photo',
  'Express Document Verification',
  'OCI / PAN Card Photo',
  'Full Family Studio Package',
] as const;

export const BRANCH_LOCATIONS = [
  'Kochi Main Studio — MG Road',
  'Trivandrum Technopark Center',
  'Calicut Mavoor Road Studio',
  'Online Express Verification',
] as const;

export const TIME_SLOTS = [
  '09:30 AM',
  '10:30 AM',
  '11:30 AM',
  '02:00 PM',
  '03:30 PM',
  '05:00 PM',
] as const;

export const DOCUMENT_TYPES = [
  'Indian Passport',
  'PAN Card',
  'Aadhaar Card',
  'Driving License',
  'UAE / Schengen Visa Form',
  'OCI / Voter ID',
] as const;

export type AccountStatus = 'pending' | 'approved' | 'active' | 'blocked' | 'removed' | 'suspended';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  role: 'user' | 'admin';
  status: AccountStatus;
  credits?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface AppointmentRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  phone: string;
  serviceType: (typeof SERVICE_TYPES)[number];
  countrySpec: string;
  branchLocation: (typeof BRANCH_LOCATIONS)[number];
  appointmentDate: string;
  timeSlot: (typeof TIME_SLOTS)[number];
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface DocumentVerificationRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  documentType: (typeof DOCUMENT_TYPES)[number];
  documentNumber: string;
  country: string;
  photoPreviewDataUrl: string;
  status: 'pending' | 'under_review' | 'verified' | 'rejected';
  remarks: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface SavedPhotoRecord {
  id: string;
  userId: string;
  presetName: string;
  dimensionsText: string;
  bgColor: string;
  previewDataUrl: string;
  createdAt?: any;
}

export function generateSamplePortraitDataUrl(index: number, transparentBg = false): string {
  const canvas = document.createElement('canvas');
  canvas.width = 700;
  canvas.height = 880;
  const ctx = canvas.getContext('2d')!;

  const configs = [
    {
      bgTop: '#dbeafe',
      bgBottom: '#bfdbfe',
      skin: '#e0a982',
      skinShadow: '#c98c63',
      hair: '#1e1b18',
      suit: '#1e293b',
      shirt: '#ffffff',
      tie: '#0d9488',
      gender: 'male',
      label: 'Sample 1 — Formal Blazer',
    },
    {
      bgTop: '#fce7f3',
      bgBottom: '#fbcfe8',
      skin: '#eab693',
      skinShadow: '#d39771',
      hair: '#271c19',
      suit: '#312e81',
      shirt: '#f8fafc',
      tie: '#e11d48',
      gender: 'female',
      label: 'Sample 2 — Corporate Attire',
    },
    {
      bgTop: '#e2e8f0',
      bgBottom: '#cbd5e1',
      skin: '#d1946a',
      skinShadow: '#b87950',
      hair: '#111827',
      suit: '#0f172a',
      shirt: '#e0f2fe',
      tie: '#0284c7',
      gender: 'male_beard',
      label: 'Sample 3 — Executive Suit',
    },
  ];

  const cfg = configs[index % configs.length];

  if (!transparentBg) {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, cfg.bgTop);
    grad.addColorStop(1, cfg.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 2;
    for (let y = 40; y < canvas.height; y += 45) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }

  const cx = canvas.width / 2;

  if (cfg.gender === 'female') {
    ctx.fillStyle = cfg.hair;
    ctx.beginPath();
    ctx.ellipse(cx, 370, 155, 210, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = cfg.suit;
  ctx.beginPath();
  ctx.moveTo(cx - 290, 880);
  ctx.quadraticCurveTo(cx - 275, 595, cx - 105, 560);
  ctx.lineTo(cx + 105, 560);
  ctx.quadraticCurveTo(cx + 275, 595, cx + 290, 880);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = cfg.shirt;
  ctx.beginPath();
  ctx.moveTo(cx - 82, 560);
  ctx.lineTo(cx + 82, 560);
  ctx.lineTo(cx, 780);
  ctx.closePath();
  ctx.fill();

  if (cfg.gender !== 'female') {
    ctx.fillStyle = cfg.tie;
    ctx.beginPath();
    ctx.moveTo(cx - 22, 585);
    ctx.lineTo(cx + 22, 585);
    ctx.lineTo(cx + 30, 745);
    ctx.lineTo(cx, 785);
    ctx.lineTo(cx - 30, 745);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.strokeStyle = '#c7d2fe';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 80, 565);
    ctx.lineTo(cx, 690);
    ctx.lineTo(cx + 80, 565);
    ctx.stroke();
  }

  ctx.fillStyle = cfg.skinShadow;
  ctx.beginPath();
  ctx.roundRect(cx - 58, 465, 116, 135, 35);
  ctx.fill();

  ctx.fillStyle = cfg.shirt;
  ctx.beginPath();
  ctx.moveTo(cx - 65, 535);
  ctx.lineTo(cx - 95, 600);
  ctx.lineTo(cx - 12, 590);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx + 65, 535);
  ctx.lineTo(cx + 95, 600);
  ctx.lineTo(cx + 12, 590);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = cfg.skinShadow;
  ctx.beginPath();
  ctx.ellipse(cx - 132, 345, 22, 42, -0.1, 0, Math.PI * 2);
  ctx.ellipse(cx + 132, 345, 22, 42, 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = cfg.skin;
  ctx.beginPath();
  ctx.ellipse(cx, 335, 130, 168, 0, 0, Math.PI * 2);
  ctx.fill();

  if (cfg.gender === 'male_beard') {
    ctx.fillStyle = 'rgba(30, 27, 24, 0.82)';
    ctx.beginPath();
    ctx.arc(cx, 355, 128, 0.18 * Math.PI, 0.82 * Math.PI, false);
    ctx.quadraticCurveTo(cx, 480, cx - 108, 425);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(cx, 405, 46, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = cfg.hair;
  ctx.beginPath();
  ctx.ellipse(cx, 215, 136, 78, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - 134, 220);
  ctx.quadraticCurveTo(cx - 125, 150, cx, 150);
  ctx.quadraticCurveTo(cx + 125, 150, cx + 134, 220);
  ctx.quadraticCurveTo(cx + 128, 305, cx + 118, 290);
  ctx.quadraticCurveTo(cx + 95, 225, cx, 220);
  ctx.quadraticCurveTo(cx - 95, 225, cx - 118, 290);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = cfg.hair;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 78, 292);
  ctx.quadraticCurveTo(cx - 48, 282, cx - 22, 292);
  ctx.moveTo(cx + 22, 292);
  ctx.quadraticCurveTo(cx + 48, 282, cx + 78, 292);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx - 50, 322, 22, 12, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 50, 322, 22, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(cx - 50, 322, 9, 0, Math.PI * 2);
  ctx.arc(cx + 50, 322, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx - 47, 319, 3, 0, Math.PI * 2);
  ctx.arc(cx + 53, 319, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = cfg.skinShadow;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(cx, 322);
  ctx.lineTo(cx - 6, 376);
  ctx.quadraticCurveTo(cx, 384, cx + 10, 376);
  ctx.stroke();

  ctx.strokeStyle = cfg.gender === 'female' ? '#be123c' : '#9f5843';
  ctx.lineWidth = cfg.gender === 'female' ? 7 : 6;
  ctx.beginPath();
  ctx.moveTo(cx - 34, 424);
  ctx.quadraticCurveTo(cx, 436, cx + 34, 424);
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

export function generateSampleSignatureDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 560;
  canvas.height = 200;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 4.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(65, 130);
  ctx.bezierCurveTo(95, 45, 145, 45, 130, 130);
  ctx.bezierCurveTo(120, 155, 165, 80, 195, 115);
  ctx.bezierCurveTo(220, 140, 245, 75, 280, 118);
  ctx.bezierCurveTo(310, 140, 350, 65, 395, 112);
  ctx.bezierCurveTo(425, 135, 465, 95, 495, 105);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(85, 152);
  ctx.quadraticCurveTo(260, 135, 475, 146);
  ctx.stroke();

  return canvas.toDataURL('image/png');
}
