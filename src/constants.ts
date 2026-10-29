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
  border: string;
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
  { name: 'Pure White', mal: 'വെള്ള', hex: '#FFFFFF', border: '#cbd5e1' },
  { name: 'UK Cream/Grey', mal: 'ഓഫ് വൈറ്റ്', hex: '#F2F2F2', border: '#cbd5e1' },
  { name: 'Light Blue', mal: 'ഇളം നീല', hex: '#D0E7FF', border: '#93c5fd' },
  { name: 'Sky Blue', mal: 'സ്കൈ ബ്ലൂ', hex: '#7CC0FF', border: '#60a5fa' },
  { name: 'Royal Blue', mal: 'കടും നീല', hex: '#1E40AF', border: '#1e3a8a' },
  { name: 'Light Grey', mal: 'ചാരനിറം', hex: '#E2E8F0', border: '#94a3b8' },
  { name: 'ID Red', mal: 'ചുവപ്പ്', hex: '#DC2626', border: '#b91c1c' },
  { name: 'Transparent', mal: 'ട്രാൻസ്പരന്റ്', hex: 'transparent', border: '#94a3b8' },
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

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  role: 'user' | 'admin';
  status: 'active' | 'suspended';
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

/**
 * Generates a realistic, high-resolution biometric portrait on an HTMLCanvasElement
 * with distinct background and subject layers so that:
 * 1) Never fails to load (100% hermetic / zero external network dependencies)
 * 2) Supports instant AI cutout simulation and real BriaAI RMBG-1.4 background removal
 */
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
      tie: '#4f46e5',
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

    // Subtle studio backdrop texture lines so original vs cutout is visibly distinct
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

  // Long hair back layer for female portrait
  if (cfg.gender === 'female') {
    ctx.fillStyle = cfg.hair;
    ctx.beginPath();
    ctx.ellipse(cx, 370, 155, 210, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Shoulders & Suit Jacket
  ctx.fillStyle = cfg.suit;
  ctx.beginPath();
  ctx.moveTo(cx - 290, 880);
  ctx.quadraticCurveTo(cx - 275, 595, cx - 105, 560);
  ctx.lineTo(cx + 105, 560);
  ctx.quadraticCurveTo(cx + 275, 595, cx + 290, 880);
  ctx.closePath();
  ctx.fill();

  // Shirt V-neck
  ctx.fillStyle = cfg.shirt;
  ctx.beginPath();
  ctx.moveTo(cx - 82, 560);
  ctx.lineTo(cx + 82, 560);
  ctx.lineTo(cx, 780);
  ctx.closePath();
  ctx.fill();

  // Tie or Necklace / Lapel detail
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
    // Formal collar lapels
    ctx.strokeStyle = '#c7d2fe';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 80, 565);
    ctx.lineTo(cx, 690);
    ctx.lineTo(cx + 80, 565);
    ctx.stroke();
  }

  // Neck
  ctx.fillStyle = cfg.skinShadow;
  ctx.beginPath();
  ctx.roundRect(cx - 58, 465, 116, 135, 35);
  ctx.fill();

  // Collar flaps
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

  // Ears
  ctx.fillStyle = cfg.skinShadow;
  ctx.beginPath();
  ctx.ellipse(cx - 132, 345, 22, 42, -0.1, 0, Math.PI * 2);
  ctx.ellipse(cx + 132, 345, 22, 42, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Head / Face Oval
  ctx.fillStyle = cfg.skin;
  ctx.beginPath();
  ctx.ellipse(cx, 335, 130, 168, 0, 0, Math.PI * 2);
  ctx.fill();

  // Subtle facial beard for sample 3
  if (cfg.gender === 'male_beard') {
    ctx.fillStyle = 'rgba(30, 27, 24, 0.82)';
    ctx.beginPath();
    ctx.arc(cx, 355, 128, 0.18 * Math.PI, 0.82 * Math.PI, false);
    ctx.quadraticCurveTo(cx, 480, cx - 108, 425);
    ctx.fill();

    // Mustache
    ctx.beginPath();
    ctx.ellipse(cx, 405, 46, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hair Top
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

  // Eyebrows
  ctx.strokeStyle = cfg.hair;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 78, 292);
  ctx.quadraticCurveTo(cx - 48, 282, cx - 22, 292);
  ctx.moveTo(cx + 22, 292);
  ctx.quadraticCurveTo(cx + 48, 282, cx + 78, 292);
  ctx.stroke();

  // Eyes
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

  // Nose
  ctx.strokeStyle = cfg.skinShadow;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(cx, 322);
  ctx.lineTo(cx - 6, 376);
  ctx.quadraticCurveTo(cx, 384, cx + 10, 376);
  ctx.stroke();

  // Mouth / Neutral Smile
  ctx.strokeStyle = cfg.gender === 'female' ? '#be123c' : '#9f5843';
  ctx.lineWidth = cfg.gender === 'female' ? 7 : 6;
  ctx.beginPath();
  ctx.moveTo(cx - 34, 424);
  ctx.quadraticCurveTo(cx, 436, cx + 34, 424);
  ctx.stroke();

  return canvas.toDataURL('image/png');
}
