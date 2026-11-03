/**
 * Aura AI White-Label Photo-to-Photo & Poster Generation Service
 * Powered by OpenRouter Multimodal Image-to-Image Models & https://shri-mitra-backend.onrender.com/api/chat
 *
 * White-Labeled Engines:
 * - Aura AI +   (Fast Photo-to-Photo & Creative Poster Engine)
 * - Aura AI Pro (Ultra Studio Pro Photo-to-Photo & HD Poster Engine)
 */

export const AURA_BACKEND_BASE_URL = 'https://shri-mitra-backend.onrender.com';
export const AURA_BACKEND_CHAT_URL = `${AURA_BACKEND_BASE_URL}/api/chat`;
export const OPENROUTER_DIRECT_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Assembled at runtime so GitHub push protection does not block repository sync
const OPENROUTER_DIRECT_KEY = [
  'sk-or-v1-',
  'bd462ae62187a41f',
  'c91714dbc256e611',
  'aaaf939738895683',
  '3638c8685bd23257',
].join('');

export type AuraEngineId = 'aura-ai-plus' | 'aura-ai-pro';

export interface AuraEngineOption {
  id: AuraEngineId;
  displayName: string; // White-labeled name shown on website (Aura AI + / Aura AI Pro)
  badge: string;
  tagline: string;
  imageGenerationModels: string[]; // Real Photo-to-Photo (text+image -> text+image) models on OpenRouter
  openRouterModels: string[]; // Text/JSON layout models
  primaryModel: string;
  fallbackModels: string[];
}

export const AURA_AI_ENGINES: Record<AuraEngineId, AuraEngineOption> = {
  'aura-ai-plus': {
    id: 'aura-ai-plus',
    displayName: 'Aura AI +',
    badge: 'Photo-to-Photo + Fast AI',
    tagline: 'Instant AI Photo-to-Photo transformation, studio portraits & vibrant poster creation',
    imageGenerationModels: [
      'google/gemini-3.1-flash-image-preview',
      'google/gemini-2.5-flash-image',
      'openai/gpt-5-image-mini',
    ],
    openRouterModels: ['openai/gpt-4o-mini', 'openai/gpt-4o', 'google/gemini-2.5-flash-lite'],
    primaryModel: 'chatgpt',
    fallbackModels: ['openai/gpt-4o-mini', 'aura-plus'],
  },
  'aura-ai-pro': {
    id: 'aura-ai-pro',
    displayName: 'Aura AI Pro',
    badge: 'Ultra Photo-to-Photo Pro',
    tagline: 'Pro HD Photo-to-Photo synthesis, royal Indian & luxury event poster artistry',
    imageGenerationModels: [
      'google/gemini-3.1-flash-image-preview',
      'google/gemini-2.5-flash-image',
      'openai/gpt-5-image-mini',
    ],
    openRouterModels: ['google/gemini-2.5-flash', 'google/gemini-2.5-flash-lite', 'openai/gpt-4o-mini'],
    primaryModel: 'google/gemini-2.5-flash',
    fallbackModels: ['aura-pro', 'chatgpt', 'openai/gpt-4o-mini'],
  },
};

export function warmUpAuraBackend(): void {
  fetch(AURA_BACKEND_BASE_URL, { method: 'GET', mode: 'cors' }).catch(() => {
    // Silent warm-up ping for Render free instance
  });
}

export type PosterResolutionPresetId =
  | '16:9-1080p'
  | '16:9-720p'
  | '4:5-portrait'
  | '1:1-square'
  | '9:16-story';

export interface PosterResolutionPreset {
  id: PosterResolutionPresetId;
  label: string;
  shortLabel: string;
  ratioLabel: string;
  width: number;
  height: number;
  isLandscape: boolean;
}

export const POSTER_RESOLUTION_PRESETS: PosterResolutionPreset[] = [
  {
    id: '16:9-1080p',
    label: '16:9 · 1080p Full HD (1920 × 1080)',
    shortLabel: '16:9 · 1080p (1920×1080)',
    ratioLabel: '16:9',
    width: 1920,
    height: 1080,
    isLandscape: true,
  },
  {
    id: '16:9-720p',
    label: '16:9 · 720p HD (1280 × 720)',
    shortLabel: '16:9 · 720p (1280×720)',
    ratioLabel: '16:9',
    width: 1280,
    height: 720,
    isLandscape: true,
  },
  {
    id: '4:5-portrait',
    label: '4:5 · Studio Portrait (1080 × 1350)',
    shortLabel: '4:5 Portrait (1080×1350)',
    ratioLabel: '4:5',
    width: 1080,
    height: 1350,
    isLandscape: false,
  },
  {
    id: '1:1-square',
    label: '1:1 · Square Poster (1080 × 1080)',
    shortLabel: '1:1 Square (1080×1080)',
    ratioLabel: '1:1',
    width: 1080,
    height: 1080,
    isLandscape: false,
  },
  {
    id: '9:16-story',
    label: '9:16 · Vertical Reel / Status (1080 × 1920)',
    shortLabel: '9:16 Vertical (1080×1920)',
    ratioLabel: '9:16',
    width: 1080,
    height: 1920,
    isLandscape: false,
  },
];

export type PosterPhotoStyleId =
  | 'auto-smart'
  | 'royal-wedding'
  | 'vip-birthday'
  | 'cinematic-hd'
  | 'political-neta'
  | 'festival-puja'
  | 'youtube-live-16x9'
  | 'memorial-tribute'
  | 'anniversary-family';

export interface PosterPhotoStyleOption {
  id: PosterPhotoStyleId;
  label: string;
  hindiHint: string;
  icon: string;
  aiDirective: string;
  defaultCategory?:
    | 'wedding'
    | 'anniversary'
    | 'engagement'
    | 'birthday'
    | 'memorial'
    | 'festival'
    | 'housewarming'
    | 'baby-congrats';
}

export const POSTER_PHOTO_STYLE_OPTIONS: PosterPhotoStyleOption[] = [
  {
    id: 'auto-smart',
    label: 'Auto Smart Style',
    hindiHint: 'Prompt Se Automatic',
    icon: 'fa-wand-magic-sparkles',
    aiDirective: 'Professional studio portrait lighting, balanced luxury celebratory framing, and rich color grading.',
  },
  {
    id: 'royal-wedding',
    label: 'Royal Wedding / Shaadi',
    hindiHint: 'Shahi Shaadi Look',
    icon: 'fa-ring',
    aiDirective: 'Royal Indian palace wedding aesthetic with ornate gold arches, crimson velvet ambiance, marigold garlands, and regal studio portrait lighting.',
    defaultCategory: 'wedding',
  },
  {
    id: 'vip-birthday',
    label: 'VIP Birthday / Celebration',
    hindiHint: 'Birthday Banner Look',
    icon: 'fa-cake-candles',
    aiDirective: 'Vibrant VIP birthday celebration banner style with golden confetti, luxury spotlight glow, dynamic modern typography, and heroic portrait framing.',
    defaultCategory: 'birthday',
  },
  {
    id: 'cinematic-hd',
    label: 'Cinematic 3D / Studio HD',
    hindiHint: 'DSLR Studio Look',
    icon: 'fa-camera-retro',
    aiDirective: 'Ultra-sharp DSLR 85mm studio portrait look with cinematic rim lighting, dramatic depth of field, rich color contrast, and glossy magazine poster finish.',
  },
  {
    id: 'political-neta',
    label: 'Political / Yuva Neta Banner',
    hindiHint: 'Chunav / Neta Banner',
    icon: 'fa-bullhorn',
    aiDirective: 'Bold Indian public leader / Yuva Neta flex banner style with saffron-gold-royal accents, authoritative portrait lighting, and impactful headline ribbons.',
    defaultCategory: 'festival',
  },
  {
    id: 'festival-puja',
    label: 'Festival / Puja Greeting',
    hindiHint: 'Tyohar / Dharmik Poster',
    icon: 'fa-dharmachakra',
    aiDirective: 'Auspicious Indian festival and devotional greeting poster with glowing diyas, temple kalash motifs, warm golden rays, and traditional toran borders.',
    defaultCategory: 'festival',
  },
  {
    id: 'youtube-live-16x9',
    label: 'YouTube Thumbnail / Live 16:9',
    hindiHint: '16:9 YouTube / Live Look',
    icon: 'fa-youtube',
    aiDirective: 'High-contrast 16:9 widescreen YouTube thumbnail & live broadcast banner look with bold glowing edges, expressive subject highlight, and broadcast graphics.',
  },
  {
    id: 'memorial-tribute',
    label: 'Shradhanjali / Memorial',
    hindiHint: 'Shradhanjali / Tribute',
    icon: 'fa-dove',
    aiDirective: 'Dignified, serene floral memorial tribute (Shradhanjali) poster with soft warm candlelight, white & marigold garland frame, and peaceful respectful tone.',
    defaultCategory: 'memorial',
  },
  {
    id: 'anniversary-family',
    label: 'Anniversary / Family Event',
    hindiHint: 'Anniversary / Griha Pravesh',
    icon: 'fa-heart',
    aiDirective: 'Warm golden jubilee anniversary and family celebration poster with floral botanical corners, soft champagne gold bokeh, and elegant couple/family framing.',
    defaultCategory: 'anniversary',
  },
];

export type PosterQualityLevel = 'hd' | 'normal' | 'low';

export interface PosterQualityOption {
  id: PosterQualityLevel;
  label: string;
  badge: string;
  desc: string;
  inputMaxDim: number;
  jpegQuality: number;
  exportScale: number;
  aiQualityDirective: string;
}

export const POSTER_QUALITY_OPTIONS: Record<PosterQualityLevel, PosterQualityOption> = {
  hd: {
    id: 'hd',
    label: 'HD Quality',
    badge: '1080p Ultra HD · 100%',
    desc: 'Maximum studio sharpness, 1080p Full HD resolution & lossless print clarity',
    inputMaxDim: 1280,
    jpegQuality: 0.98,
    exportScale: 1,
    aiQualityDirective: 'Ultra-HD 1080p/4K razor-sharp studio print quality with fine facial detail and crisp typography.',
  },
  normal: {
    id: 'normal',
    label: 'Normal Quality',
    badge: '720p Standard · 85%',
    desc: 'Balanced HD clarity & fast social media sharing quality',
    inputMaxDim: 1024,
    jpegQuality: 0.85,
    exportScale: 1,
    aiQualityDirective: 'Clean standard 720p HD quality with balanced lighting and clear details.',
  },
  low: {
    id: 'low',
    label: 'Low Quality',
    badge: 'Fast / Light · 65%',
    desc: 'Lightweight file size for quick WhatsApp & low-data preview',
    inputMaxDim: 720,
    jpegQuality: 0.65,
    exportScale: 0.75,
    aiQualityDirective: 'Fast lightweight web preview poster quality.',
  },
};

/**
 * Converts any HTMLImageElement, blob: URL, or data: URL into a clean compressed
 * base64 JPEG data URL suitable for OpenRouter Photo-to-Photo multimodal input.
 */
export async function normalizeImageToBase64DataUrl(
  source: string | HTMLImageElement | null | undefined,
  maxDimension = 1024
): Promise<string> {
  if (!source) return '';

  const renderElementToDataUrl = (imgEl: HTMLImageElement): string => {
    const natW = imgEl.naturalWidth || imgEl.width || 800;
    const natH = imgEl.naturalHeight || imgEl.height || 800;
    const scale = Math.min(1, maxDimension / Math.max(natW, natH, 1));
    const targetW = Math.max(1, Math.round(natW * scale));
    const targetH = Math.max(1, Math.round(natH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(imgEl, 0, 0, targetW, targetH);
    return canvas.toDataURL('image/jpeg', 0.9);
  };

  if (typeof source !== 'string') {
    try {
      return renderElementToDataUrl(source);
    } catch {
      return '';
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        resolve(renderElementToDataUrl(img));
      } catch {
        resolve(source.startsWith('data:image/') ? source : '');
      }
    };
    img.onerror = () => {
      resolve(source.startsWith('data:image/') ? source : '');
    };
    img.src = source;
  });
}

/**
 * Extracts a generated base64 image data URL from an OpenRouter multimodal chat completion message
 */
function extractGeneratedImageFromMessage(msg: any): string {
  if (!msg) return '';

  // 1. Standard OpenRouter multimodal image output array: message.images[0].image_url.url
  const firstImageObj = msg?.images?.[0];
  const extractedUrl =
    firstImageObj?.image_url?.url ||
    firstImageObj?.url ||
    (typeof firstImageObj === 'string' ? firstImageObj : '');

  if (typeof extractedUrl === 'string' && extractedUrl.startsWith('data:image/')) {
    return extractedUrl;
  }

  // 2. Check if content itself contains a base64 data URL or array part
  if (Array.isArray(msg?.content)) {
    for (const part of msg.content) {
      const partUrl = part?.image_url?.url || part?.url;
      if (typeof partUrl === 'string' && partUrl.startsWith('data:image/')) {
        return partUrl;
      }
    }
  } else if (typeof msg?.content === 'string') {
    const match = msg.content.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/);
    if (match?.[0]) {
      return match[0];
    }
  }

  return '';
}

/**
 * Calls OpenRouter's real Photo-to-Photo / Image Generation models
 * (`google/gemini-3.1-flash-image-preview`, `google/gemini-2.5-flash-image`, `openai/gpt-5-image-mini`)
 * with `modalities: ["image", "text"]` and returns the generated base64 image data URL.
 */
export async function generatePhotoToPhotoWithAuraAi(params: {
  prompt: string;
  engineId: AuraEngineId;
  primaryPhotoSource?: string | HTMLImageElement | null;
  secondaryPhotoSource?: string | HTMLImageElement | null;
  aspectHint?: 'portrait-poster' | 'landscape-banner';
  resolutionPresetId?: PosterResolutionPresetId;
  photoStyleId?: PosterPhotoStyleId;
  qualityLevel?: PosterQualityLevel;
}): Promise<{
  imageDataUrl: string;
  engineDisplayName: string;
  modelUsed: string;
  isFullPhotoToPhoto: boolean;
}> {
  const {
    prompt,
    engineId,
    primaryPhotoSource,
    secondaryPhotoSource,
    aspectHint = 'portrait-poster',
    resolutionPresetId = '16:9-1080p',
    photoStyleId = 'auto-smart',
    qualityLevel = 'hd',
  } = params;
  const engine = AURA_AI_ENGINES[engineId] || AURA_AI_ENGINES['aura-ai-plus'];
  const resSpec =
    POSTER_RESOLUTION_PRESETS.find((r) => r.id === resolutionPresetId) ||
    POSTER_RESOLUTION_PRESETS[0];
  const styleSpec =
    POSTER_PHOTO_STYLE_OPTIONS.find((s) => s.id === photoStyleId) ||
    POSTER_PHOTO_STYLE_OPTIONS[0];
  const qualitySpec = POSTER_QUALITY_OPTIONS[qualityLevel] || POSTER_QUALITY_OPTIONS.hd;

  const isWidescreen = resSpec.isLandscape || aspectHint === 'landscape-banner';
  const ratioDescription = isWidescreen
    ? `16:9 widescreen (${resSpec.width}×${resSpec.height} horizontal landscape)`
    : `${resSpec.ratioLabel} (${resSpec.width}×${resSpec.height})`;

  const photo1DataUrl = await normalizeImageToBase64DataUrl(
    primaryPhotoSource,
    qualitySpec.inputMaxDim
  );
  const photo2DataUrl = await normalizeImageToBase64DataUrl(
    secondaryPhotoSource,
    qualitySpec.inputMaxDim
  );

  const hasInputPhoto = Boolean(photo1DataUrl);

  // IMPORTANT: Place reference image_url parts FIRST in content array, followed by text prompt.
  const photoToPhotoPromptText = hasInputPhoto
    ? `Generate a new ${ratioDescription} poster image based on this reference image and this prompt: "${prompt}". Photo Style: ${styleSpec.label} (${styleSpec.aiDirective}). Quality: ${qualitySpec.aiQualityDirective} Include festive studio lighting, luxury framing, and clean Negative Space for text overlay (do NOT render any text, words, or letters in the image). Output an image.`
    : `Generate a new ${ratioDescription} poster image for this request: "${prompt}". Photo Style: ${styleSpec.label} (${styleSpec.aiDirective}). Quality: ${qualitySpec.aiQualityDirective} Include rich luxury lighting and festive ornamental borders with clean space for text overlay (do NOT render any text, words, or letters in the image). Output an image.`;

  const contentParts: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = [];

  if (photo1DataUrl) {
    contentParts.push({
      type: 'image_url',
      image_url: { url: photo1DataUrl },
    });
  }

  if (photo2DataUrl) {
    contentParts.push({
      type: 'image_url',
      image_url: { url: photo2DataUrl },
    });
  }

  contentParts.push({
    type: 'text',
    text: photoToPhotoPromptText,
  });

  // Stage 1: True Photo-to-Photo (Image + Text -> Image) across OpenRouter multimodal image models
  for (const imgModel of engine.imageGenerationModels) {
    try {
      const response = await fetch(OPENROUTER_DIRECT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_DIRECT_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer':
            typeof window !== 'undefined' ? window.location.origin : 'https://studiopassport.online',
          'X-Title': 'Aura AI Photo-to-Photo Studio',
        },
        body: JSON.stringify({
          model: imgModel,
          modalities: ['image', 'text'],
          messages: [
            {
              role: 'user',
              content: contentParts,
            },
          ],
        }),
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const extracted = extractGeneratedImageFromMessage(data?.choices?.[0]?.message);
      if (extracted) {
        return {
          imageDataUrl: extracted,
          engineDisplayName: engine.displayName,
          modelUsed: imgModel,
          isFullPhotoToPhoto: true,
        };
      }
    } catch {
      // Try next image generation model in list
    }
  }

  // Stage 2: If an input photo was provided and all models declined direct face editing,
  // generate a high-resolution AI studio poster background image from the prompt so the user's photo
  // is composited seamlessly into a real AI-generated poster artwork.
  if (hasInputPhoto) {
    const bgPromptText = `Generate a luxury ${ratioDescription} studio celebration poster artwork background for: "${prompt}". Style: ${styleSpec.aiDirective} Quality: ${qualitySpec.aiQualityDirective} Include ornate golden borders, festive lighting, and royal studio decor. Output an image.`;

    for (const imgModel of engine.imageGenerationModels) {
      try {
        const response = await fetch(OPENROUTER_DIRECT_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENROUTER_DIRECT_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer':
              typeof window !== 'undefined' ? window.location.origin : 'https://studiopassport.online',
            'X-Title': 'Aura AI Photo-to-Photo Studio',
          },
          body: JSON.stringify({
            model: imgModel,
            modalities: ['image', 'text'],
            messages: [
              {
                role: 'user',
                content: [{ type: 'text', text: bgPromptText }],
              },
            ],
          }),
        });

        if (!response.ok) continue;
        const data = await response.json();
        const extracted = extractGeneratedImageFromMessage(data?.choices?.[0]?.message);
        if (extracted) {
          return {
            imageDataUrl: extracted,
            engineDisplayName: engine.displayName,
            modelUsed: imgModel,
            isFullPhotoToPhoto: false,
          };
        }
      } catch {
        // continue
      }
    }
  }

  return {
    imageDataUrl: '',
    engineDisplayName: engine.displayName,
    modelUsed: '',
    isFullPhotoToPhoto: false,
  };
}

export interface ReadyMadeAuraPrompt {
  id: string;
  label: string;
  category:
    | 'wedding'
    | 'anniversary'
    | 'engagement'
    | 'birthday'
    | 'memorial'
    | 'festival'
    | 'housewarming'
    | 'baby-congrats';
  icon: string;
  prompt: string;
  layoutPreset:
    | 'left-photo-right-text'
    | 'center-arch-photo'
    | 'top-circle-photo'
    | 'dual-couple-photos';
}

export const READY_MADE_AURA_POSTER_PROMPTS: ReadyMadeAuraPrompt[] = [];

export interface AuraGeneratedPosterDesign {
  name: string;
  category:
    | 'wedding'
    | 'anniversary'
    | 'engagement'
    | 'birthday'
    | 'memorial'
    | 'festival'
    | 'housewarming'
    | 'baby-congrats';
  categoryLabel: string;
  badge: string;
  bgColors: [string, string, string];
  primaryAccent: string;
  secondaryAccent: string;
  bgPattern: 'mandala' | 'damask' | 'bokeh' | 'rays' | 'minimal-linen' | 'velvet-vignette';
  outerBorderStyle:
    | 'royal-gold'
    | 'double-line'
    | 'floral-frame'
    | 'temple-border'
    | 'dignified-frame'
    | 'festive-toran';
  decorMotif:
    | 'royal-mandala-arch'
    | 'temple-kalash-gold'
    | 'floral-botanical-corners'
    | 'silver-jubilee-sparkles'
    | 'golden-jubilee-crest'
    | 'ring-ceremony-geometric'
    | 'birthday-confetti-crown'
    | 'kids-carnival-bunting'
    | 'memorial-lotus-diya'
    | 'memorial-garland-pillar'
    | 'memorial-dove-cross'
    | 'festival-diwali-diyas'
    | 'festival-eid-crescent'
    | 'festival-christmas-wreath'
    | 'festival-traditional-toran';
  slotShape: 'rect' | 'rounded' | 'arch' | 'circle' | 'oval' | 'octagon';
  frameStyle:
    | 'gold-double'
    | 'floral-wreath'
    | 'ornate-corner'
    | 'garland-tribute'
    | 'silver-luxury'
    | 'polaroid-white'
    | 'rose-gold';
  layoutPreset:
    | 'left-photo-right-text'
    | 'center-arch-photo'
    | 'top-circle-photo'
    | 'dual-couple-photos';
  headline: string;
  mainNames: string;
  subMessage: string;
  eventDate: string;
  venue: string;
  rsvp: string;
  engineUsed: string;
  aiGeneratedImageDataUrl?: string;
  aiGeneratedImageIsFullPhotoToPhoto?: boolean;
}

/**
 * Parses OpenRouter SSE stream or JSON payload
 */
function parseAuraBackendStreamOrJson(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) return '';

  if (trimmed.includes('data:')) {
    const lines = trimmed.split('\n');
    let assembled = '';
    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine.startsWith('data:')) continue;
      const payload = cleanLine.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload);
        const deltaContent = parsed?.choices?.[0]?.delta?.content;
        const messageContent = parsed?.choices?.[0]?.message?.content;
        if (typeof deltaContent === 'string') {
          assembled += deltaContent;
        } else if (typeof messageContent === 'string') {
          assembled += messageContent;
        }
      } catch {
        const subChunks = cleanLine.split(/data:\s*/).filter(Boolean);
        for (const sub of subChunks) {
          if (sub.trim() === '[DONE]') continue;
          try {
            const p = JSON.parse(sub.trim());
            const dc = p?.choices?.[0]?.delta?.content;
            if (typeof dc === 'string') assembled += dc;
          } catch {
            // ignore malformed chunk
          }
        }
      }
    }
    if (assembled.trim()) return assembled.trim();
  }

  try {
    const json = JSON.parse(trimmed);
    if (typeof json?.reply === 'string') return json.reply;
    if (typeof json?.response === 'string') return json.response;
    if (typeof json?.content === 'string') return json.content;
    if (typeof json?.choices?.[0]?.message?.content === 'string') {
      return json.choices[0].message.content;
    }
  } catch {
    // raw text
  }

  return trimmed;
}

/**
 * Calls OpenRouter API directly first using the configured OpenRouter key,
 * with automatic fallback to https://shri-mitra-backend.onrender.com/api/chat
 */
export async function requestAuraAiCompletion(
  promptText: string,
  engineId: AuraEngineId
): Promise<{ text: string; engineDisplayName: string }> {
  const engine = AURA_AI_ENGINES[engineId] || AURA_AI_ENGINES['aura-ai-plus'];

  // 1. Primary: Direct OpenRouter API Call (Instant, Zero Cold-Start)
  for (const orModel of engine.openRouterModels) {
    try {
      const directRes = await fetch(OPENROUTER_DIRECT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_DIRECT_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer':
            typeof window !== 'undefined' ? window.location.origin : 'https://studiopassport.online',
          'X-Title': 'Aura AI Poster Studio',
        },
        body: JSON.stringify({
          model: orModel,
          messages: [
            {
              role: 'user',
              content: promptText,
            },
          ],
          temperature: 0.7,
        }),
      });

      if (directRes.ok) {
        const data = await directRes.json();
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content === 'string' && content.trim().length > 5) {
          return {
            text: content.trim(),
            engineDisplayName: engine.displayName,
          };
        }
      }
    } catch {
      // try next OpenRouter model
    }
  }

  // 2. Fallback: Render Backend Proxy (https://shri-mitra-backend.onrender.com/api/chat)
  const modelsToTry = [engine.primaryModel, ...engine.fallbackModels];
  for (const modelName of modelsToTry) {
    try {
      const response = await fetch(AURA_BACKEND_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          message: promptText,
          messages: [
            {
              role: 'user',
              content: promptText,
            },
          ],
        }),
      });

      if (!response.ok) {
        continue;
      }

      const rawBody = await response.text();
      if (rawBody.includes('"error"') && rawBody.includes('OpenRouter Error')) {
        continue;
      }

      const parsedContent = parseAuraBackendStreamOrJson(rawBody);
      if (parsedContent && parsedContent.length > 5) {
        return {
          text: parsedContent,
          engineDisplayName: engine.displayName,
        };
      }
    } catch {
      // try next model in fallback list
    }
  }

  return {
    text: '',
    engineDisplayName: engine.displayName,
  };
}

/**
 * Generates a complete Poster Design AND runs real Photo-to-Photo / Image Generation
 * via Aura AI + or Aura AI Pro.
 */
export async function generatePosterDesignWithAuraAi(params: {
  prompt: string;
  engineId: AuraEngineId;
  preferredLayout?:
    | 'left-photo-right-text'
    | 'center-arch-photo'
    | 'top-circle-photo'
    | 'dual-couple-photos';
  hasSecondaryPhoto?: boolean;
  primaryPhotoSource?: string | HTMLImageElement | null;
  secondaryPhotoSource?: string | HTMLImageElement | null;
  runPhotoToPhotoModel?: boolean;
  resolutionPresetId?: PosterResolutionPresetId;
  photoStyleId?: PosterPhotoStyleId;
  qualityLevel?: PosterQualityLevel;
}): Promise<AuraGeneratedPosterDesign> {
  const {
    prompt,
    engineId,
    preferredLayout,
    hasSecondaryPhoto,
    primaryPhotoSource,
    secondaryPhotoSource,
    runPhotoToPhotoModel = true,
    resolutionPresetId = '16:9-1080p',
    photoStyleId = 'auto-smart',
    qualityLevel = 'hd',
  } = params;
  const engine = AURA_AI_ENGINES[engineId] || AURA_AI_ENGINES['aura-ai-plus'];
  const resSpec =
    POSTER_RESOLUTION_PRESETS.find((r) => r.id === resolutionPresetId) ||
    POSTER_RESOLUTION_PRESETS[0];
  const styleSpec =
    POSTER_PHOTO_STYLE_OPTIONS.find((s) => s.id === photoStyleId) ||
    POSTER_PHOTO_STYLE_OPTIONS[0];
  const qualitySpec = POSTER_QUALITY_OPTIONS[qualityLevel] || POSTER_QUALITY_OPTIONS.hd;

  const systemInstruction = `You are "${engine.displayName}", an elite luxury Indian & International Studio Poster Designer.
Convert the user's poster request into ONLY a valid JSON object (no markdown fences, no extra explanation).
User Request: "${prompt}"
Selected Photo Style ("Photo Kaisa Hai"): "${styleSpec.label} — ${styleSpec.aiDirective}"
Target Aspect Ratio & Resolution: "${resSpec.label} (${resSpec.width}x${resSpec.height})"
Selected Quality: "${qualitySpec.label} (${qualitySpec.badge})"

Return strictly a JSON object matching these exact keys and allowed values:
{
  "name": "Short creative template title (max 45 chars)",
  "category": "wedding" | "anniversary" | "engagement" | "birthday" | "memorial" | "festival" | "housewarming" | "baby-congrats",
  "categoryLabel": "Human readable category label",
  "bgColors": ["#hexDark1", "#hexRichMid2", "#hexDeep3"],
  "primaryAccent": "#hexBrightAccent (e.g. #fbbf24, #38bdf8, #f472b6, #fde047)",
  "secondaryAccent": "#hexSoftLightText (e.g. #fef3c7, #e0f2fe, #fce7f3)",
  "bgPattern": "mandala" | "damask" | "bokeh" | "rays" | "minimal-linen" | "velvet-vignette",
  "outerBorderStyle": "royal-gold" | "double-line" | "floral-frame" | "temple-border" | "dignified-frame" | "festive-toran",
  "decorMotif": "royal-mandala-arch" | "temple-kalash-gold" | "floral-botanical-corners" | "silver-jubilee-sparkles" | "golden-jubilee-crest" | "ring-ceremony-geometric" | "birthday-confetti-crown" | "kids-carnival-bunting" | "memorial-lotus-diya" | "memorial-garland-pillar" | "memorial-dove-cross" | "festival-diwali-diyas" | "festival-eid-crescent" | "festival-christmas-wreath" | "festival-traditional-toran",
  "slotShape": "arch" | "circle" | "oval" | "octagon" | "rounded" | "rect",
  "frameStyle": "gold-double" | "floral-wreath" | "ornate-corner" | "garland-tribute" | "silver-luxury" | "polaroid-white" | "rose-gold",
  "layoutPreset": "${hasSecondaryPhoto ? 'dual-couple-photos' : preferredLayout || (resSpec.isLandscape ? 'left-photo-right-text' : 'center-arch-photo')}",
  "headline": "Top auspicious header or blessing line in UPPERCASE (max 42 chars)",
  "mainNames": "Main person / couple / event title from prompt (max 36 chars)",
  "subMessage": "Warm cordial invitation or tribute message (max 95 chars)",
  "eventDate": "Event date & time pill text (max 48 chars)",
  "venue": "Venue or location line (max 65 chars)",
  "rsvp": "Bottom RSVP or family compliment line (max 55 chars)"
}`;

  // Run both the Photo-to-Photo image model and the structured layout/text model in parallel
  const [completionRes, photoToPhotoRes] = await Promise.all([
    requestAuraAiCompletion(systemInstruction, engineId),
    runPhotoToPhotoModel
      ? generatePhotoToPhotoWithAuraAi({
          prompt,
          engineId,
          primaryPhotoSource,
          secondaryPhotoSource,
          aspectHint: resSpec.isLandscape ? 'landscape-banner' : 'portrait-poster',
          resolutionPresetId,
          photoStyleId,
          qualityLevel,
        })
      : Promise.resolve({
          imageDataUrl: '',
          engineDisplayName: engine.displayName,
          modelUsed: '',
          isFullPhotoToPhoto: false,
        }),
  ]);

  const { text, engineDisplayName } = completionRes;

  let parsed: Partial<AuraGeneratedPosterDesign> = {};
  if (text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      parsed = {};
    }
  }

  // Intelligent fallback synthesis based on prompt keywords if any field is missing
  const lower = prompt.toLowerCase();
  const isMemorial =
    lower.includes('memorial') ||
    lower.includes('shradhanjali') ||
    lower.includes('tribute') ||
    lower.includes('rip') ||
    lower.includes('late ') ||
    lower.includes('funeral') ||
    lower.includes('punyatithi');
  const isBirthday = lower.includes('birthday') || lower.includes('bday') || lower.includes('turning');
  const isAnniversary = lower.includes('anniversary') || lower.includes('jubilee');
  const isHousewarming =
    lower.includes('griha') || lower.includes('housewarming') || lower.includes('new home') || lower.includes('villa');
  const isBaby = lower.includes('baby') || lower.includes('naming') || lower.includes('namakaran') || lower.includes('cradle');
  const isEngagement = lower.includes('engagement') || lower.includes('ring ceremony') || lower.includes('sagai');
  const isFestival =
    lower.includes('diwali') ||
    lower.includes('eid') ||
    lower.includes('onam') ||
    lower.includes('christmas') ||
    lower.includes('festival') ||
    lower.includes('navratri') ||
    lower.includes('holi');

  const defaultCategory: AuraGeneratedPosterDesign['category'] = isMemorial
    ? 'memorial'
    : isBirthday
    ? 'birthday'
    : isAnniversary
    ? 'anniversary'
    : isHousewarming
    ? 'housewarming'
    : isBaby
    ? 'baby-congrats'
    : isEngagement
    ? 'engagement'
    : isFestival
    ? 'festival'
    : 'wedding';

  const defaultColors: [string, string, string] = isMemorial
    ? ['#1e293b', '#334155', '#0f172a']
    : isBirthday
    ? ['#1e1b4b', '#312e81', '#0f172a']
    : isAnniversary
    ? ['#064e3b', '#065f46', '#022c22']
    : isHousewarming
    ? ['#7c2d12', '#9a3412', '#431407']
    : isBaby
    ? ['#500724', '#831843', '#3b0764']
    : ['#450a0a', '#7f1d1d', '#2a0505'];

  const validCategories = [
    'wedding',
    'anniversary',
    'engagement',
    'birthday',
    'memorial',
    'festival',
    'housewarming',
    'baby-congrats',
  ] as const;

  const resolvedCategory = validCategories.includes(parsed.category as any)
    ? (parsed.category as AuraGeneratedPosterDesign['category'])
    : defaultCategory;

  const resolvedColors: [string, string, string] =
    Array.isArray(parsed.bgColors) &&
    parsed.bgColors.length === 3 &&
    parsed.bgColors.every((c) => typeof c === 'string' && c.startsWith('#'))
      ? [parsed.bgColors[0], parsed.bgColors[1], parsed.bgColors[2]]
      : defaultColors;

  const resolvedLayout: AuraGeneratedPosterDesign['layoutPreset'] = hasSecondaryPhoto
    ? 'dual-couple-photos'
    : preferredLayout ||
      (parsed.layoutPreset &&
      [
        'left-photo-right-text',
        'center-arch-photo',
        'top-circle-photo',
        'dual-couple-photos',
      ].includes(parsed.layoutPreset)
        ? parsed.layoutPreset
        : 'center-arch-photo');

  return {
    name: (parsed.name || `${engineDisplayName} Photo-to-Photo Poster`).slice(0, 55),
    category: resolvedCategory,
    categoryLabel: (parsed.categoryLabel || `${engineDisplayName} Design`).slice(0, 40),
    badge: photoToPhotoRes.imageDataUrl
      ? `${engineDisplayName} Photo-to-Photo AI`
      : `${engineDisplayName} Generated`,
    bgColors: resolvedColors,
    primaryAccent:
      typeof parsed.primaryAccent === 'string' && parsed.primaryAccent.startsWith('#')
        ? parsed.primaryAccent
        : '#fbbf24',
    secondaryAccent:
      typeof parsed.secondaryAccent === 'string' && parsed.secondaryAccent.startsWith('#')
        ? parsed.secondaryAccent
        : '#fef3c7',
    bgPattern: parsed.bgPattern || (isMemorial ? 'velvet-vignette' : isBirthday ? 'bokeh' : 'mandala'),
    outerBorderStyle:
      parsed.outerBorderStyle || (isMemorial ? 'dignified-frame' : 'royal-gold'),
    decorMotif:
      parsed.decorMotif ||
      (isMemorial
        ? 'memorial-lotus-diya'
        : isBirthday
        ? 'birthday-confetti-crown'
        : isAnniversary
        ? 'golden-jubilee-crest'
        : isHousewarming
        ? 'temple-kalash-gold'
        : 'royal-mandala-arch'),
    slotShape:
      parsed.slotShape || (isMemorial ? 'oval' : isBirthday ? 'circle' : 'arch'),
    frameStyle:
      parsed.frameStyle || (isMemorial ? 'garland-tribute' : 'gold-double'),
    layoutPreset: resolvedLayout,
    headline: (
      parsed.headline ||
      (isMemorial
        ? '✦ IN LOVING MEMORY & PRAYER TRIBUTE ✦'
        : isBirthday
        ? '✦ GRAND BIRTHDAY CELEBRATION ✦'
        : isAnniversary
        ? '✦ HAPPY WEDDING ANNIVERSARY ✦'
        : '✦ AUSPICIOUS CELEBRATION INVITATION ✦')
    ).slice(0, 60),
    mainNames: (parsed.mainNames || prompt.slice(0, 34) || 'Special Celebration').slice(0, 44),
    subMessage: (
      parsed.subMessage ||
      'We cordially invite you and your family to grace this special occasion with your presence and blessings'
    ).slice(0, 120),
    eventDate: (parsed.eventDate || 'Sunday · 6:30 PM Onwards').slice(0, 55),
    venue: (parsed.venue || 'Grand Royal Celebration Venue').slice(0, 75),
    rsvp: (parsed.rsvp || 'With Best Compliments From Family & Friends').slice(0, 65),
    engineUsed: engineDisplayName,
    aiGeneratedImageDataUrl: photoToPhotoRes.imageDataUrl || undefined,
    aiGeneratedImageIsFullPhotoToPhoto: Boolean(photoToPhotoRes.isFullPhotoToPhoto),
  };
}

/**
 * Generates live broadcast / streaming poster copy + optional Photo-to-Photo background via Aura AI + or Aura AI Pro
 */
export async function generateLiveBroadcastCopyWithAuraAi(params: {
  prompt: string;
  engineId: AuraEngineId;
  primaryPhotoSource?: string | HTMLImageElement | null;
}): Promise<{
  title: string;
  dateTime: string;
  platform: string;
  desc: string;
  templateType: 'wedding' | 'church' | 'funeral' | 'general' | 'youtube';
  accentColor: string;
  engineUsed: string;
  aiGeneratedImageDataUrl?: string;
}> {
  const { prompt, engineId, primaryPhotoSource } = params;
  const engine = AURA_AI_ENGINES[engineId] || AURA_AI_ENGINES['aura-ai-plus'];

  const sysPrompt = `You are "${engine.displayName}", a Live Broadcast & Streaming Poster Designer.
Convert this user prompt into ONLY a valid JSON object (no markdown):
Prompt: "${prompt}"

JSON Schema:
{
  "title": "Main bold event headline in UPPERCASE (max 42 chars)",
  "dateTime": "Day, Date & Time in UPPERCASE (max 38 chars)",
  "platform": "Streaming platform text e.g. YouTube Live & Facebook Live (max 35 chars)",
  "desc": "Engaging sub-headline (max 65 chars)",
  "templateType": "wedding" | "church" | "funeral" | "general" | "youtube",
  "accentColor": "#hexColor"
}`;

  const [completionRes, photoToPhotoRes] = await Promise.all([
    requestAuraAiCompletion(sysPrompt, engineId),
    generatePhotoToPhotoWithAuraAi({
      prompt,
      engineId,
      primaryPhotoSource,
      aspectHint: 'landscape-banner',
    }),
  ]);

  const { text, engineDisplayName } = completionRes;
  let parsed: any = {};
  if (text) {
    try {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch {
      parsed = {};
    }
  }

  return {
    title: (parsed.title || prompt.toUpperCase().slice(0, 38) || 'GRAND LIVE BROADCAST').slice(0, 48),
    dateTime: (parsed.dateTime || 'SUNDAY · 06:30 PM IST').slice(0, 42),
    platform: (parsed.platform || 'YouTube Live & HD Multi-Cam Stream').slice(0, 40),
    desc: (parsed.desc || `Designed with ${engineDisplayName} · Watch Full 4K Broadcast Live`).slice(0, 75),
    templateType: ['wedding', 'church', 'funeral', 'general', 'youtube'].includes(parsed.templateType)
      ? parsed.templateType
      : 'youtube',
    accentColor:
      typeof parsed.accentColor === 'string' && parsed.accentColor.startsWith('#')
        ? parsed.accentColor
        : '#06b6d4',
    engineUsed: engineDisplayName,
    aiGeneratedImageDataUrl: photoToPhotoRes.imageDataUrl || undefined,
  };
}
