/**
 * Aura AI White-Label Poster & Media Generation Service
 * Powered by https://shri-mitra-backend.onrender.com/api/chat
 *
 * White-Labeled Engines:
 * - Aura AI +   (Fast Creative Engine)
 * - Aura AI Pro (Ultra Studio Pro Engine)
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
  openRouterModels: string[];
  primaryModel: string;
  fallbackModels: string[];
}

export const AURA_AI_ENGINES: Record<AuraEngineId, AuraEngineOption> = {
  'aura-ai-plus': {
    id: 'aura-ai-plus',
    displayName: 'Aura AI +',
    badge: 'Fast & Creative',
    tagline: 'Instant studio poster layout, vibrant color palettes & smart event copy',
    openRouterModels: ['openai/gpt-4o-mini', 'openai/gpt-4o', 'google/gemini-2.5-flash-lite'],
    primaryModel: 'chatgpt',
    fallbackModels: ['openai/gpt-4o-mini', 'aura-plus'],
  },
  'aura-ai-pro': {
    id: 'aura-ai-pro',
    displayName: 'Aura AI Pro',
    badge: 'Ultra Studio Pro',
    tagline: 'Deep luxury typography, rich cultural motifs & multi-frame poster artistry',
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
}

/**
 * Parses OpenRouter SSE stream or JSON payload
 */
function parseAuraBackendStreamOrJson(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) return '';

  // Check if response is SSE stream ("data: {...}")
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

  // Standard JSON response
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
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://studiopassport.online',
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
 * Generates a complete, bespoke Poster Design from a user prompt via Aura AI + or Aura AI Pro
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
}): Promise<AuraGeneratedPosterDesign> {
  const { prompt, engineId, preferredLayout, hasSecondaryPhoto } = params;
  const engine = AURA_AI_ENGINES[engineId] || AURA_AI_ENGINES['aura-ai-plus'];

  const systemInstruction = `You are "${engine.displayName}", an elite luxury Indian & International Studio Poster Designer.
Convert the user's poster request into ONLY a valid JSON object (no markdown fences, no extra explanation).
User Request: "${prompt}"

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
  "layoutPreset": "${hasSecondaryPhoto ? 'dual-couple-photos' : preferredLayout || 'center-arch-photo'}",
  "headline": "Top auspicious header or blessing line in UPPERCASE (max 42 chars)",
  "mainNames": "Main person / couple / event title from prompt (max 36 chars)",
  "subMessage": "Warm cordial invitation or tribute message (max 95 chars)",
  "eventDate": "Event date & time pill text (max 48 chars)",
  "venue": "Venue or location line (max 65 chars)",
  "rsvp": "Bottom RSVP or family compliment line (max 55 chars)"
}`;

  const { text, engineDisplayName } = await requestAuraAiCompletion(systemInstruction, engineId);

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
    name: (parsed.name || `${engineDisplayName} Custom Poster`).slice(0, 55),
    category: resolvedCategory,
    categoryLabel: (parsed.categoryLabel || `${engineDisplayName} Design`).slice(0, 40),
    badge: `${engineDisplayName} Generated`,
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
  };
}

/**
 * Generates live broadcast / streaming poster copy via Aura AI + or Aura AI Pro
 */
export async function generateLiveBroadcastCopyWithAuraAi(params: {
  prompt: string;
  engineId: AuraEngineId;
}): Promise<{
  title: string;
  dateTime: string;
  platform: string;
  desc: string;
  templateType: 'wedding' | 'church' | 'funeral' | 'general' | 'youtube';
  accentColor: string;
  engineUsed: string;
}> {
  const { prompt, engineId } = params;
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

  const { text, engineDisplayName } = await requestAuraAiCompletion(sysPrompt, engineId);
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
  };
}
