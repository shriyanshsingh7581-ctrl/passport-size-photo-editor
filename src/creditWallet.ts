/**
 * MALNADU MEDIA — Tamper-Resistant Client-Side Credit & Wallet Engine
 *
 * Security & Storage Architecture:
 * - Stores credit balance in LocalStorage under an encrypted + hash-signed vault payload.
 * - Uses XOR stream cipher + Base64 encoding paired with a salted double-FNV1a 64-bit integrity signature.
 * - If a user attempts to modify the LocalStorage value in Browser DevTools, the integrity signature
 *   verification fails and prevents unauthorized credit tampering.
 * - Supports instant Admin PIN ('1234') recharge (+500, +800, +1000 credits) via Alt+A or 5 clicks on the Wallet Badge.
 */

const WALLET_STORAGE_KEY = 'malnadu_studio_wallet_vault_v1';
const WALLET_SECRET_SALT = 'MALNADU_MEDIA_STUDIO_PRO_2026_VAULT_KEY_#9981';
export const DEFAULT_INITIAL_CREDITS = 25;
export const DEFAULT_ADMIN_PIN = '1234';
export const DEFAULT_ADMIN_WHATSAPP = '+91 98450 11223';

interface WalletVaultPayload {
  c: number; // available credits
  u: number; // updatedAt timestamp
  n: string; // random nonce
}

export interface SignedWalletEnvelope {
  p: string; // XOR + Base64 encrypted payload
  s: string; // 64-bit integrity signature hex
}

/**
 * Computes a deterministic salted 64-bit integrity signature (dual FNV-1a 32-bit rounds)
 */
function computeVaultSignature(encryptedPayload: string): string {
  const input = `${WALLET_SECRET_SALT}::${encryptedPayload}::${WALLET_SECRET_SALT.length}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;

  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= (ch + i) & 0xff;
    h2 = Math.imul(h2, 0x811c9dc5);
  }

  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${hex1}${hex2}`;
}

/**
 * XOR + Base64 obfuscation so raw numbers are not visible in DevTools LocalStorage
 */
function encryptPayloadString(rawJson: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < rawJson.length; i++) {
    const keyChar = WALLET_SECRET_SALT.charCodeAt(i % WALLET_SECRET_SALT.length);
    bytes.push(rawJson.charCodeAt(i) ^ (keyChar & 0x7f));
  }
  return btoa(String.fromCharCode(...bytes));
}

function decryptPayloadString(encoded: string): string {
  const binary = atob(encoded);
  const chars: string[] = [];
  for (let i = 0; i < binary.length; i++) {
    const keyChar = WALLET_SECRET_SALT.charCodeAt(i % WALLET_SECRET_SALT.length);
    chars.push(String.fromCharCode(binary.charCodeAt(i) ^ (keyChar & 0x7f)));
  }
  return chars.join('');
}

/**
 * Saves the credit balance into the signed & encrypted LocalStorage vault.
 */
export function saveWalletCredits(credits: number): number {
  const safeCredits = Math.max(0, Math.floor(Number(credits) || 0));
  const payload: WalletVaultPayload = {
    c: safeCredits,
    u: Date.now(),
    n: Math.random().toString(36).slice(2, 10),
  };

  try {
    const rawJson = JSON.stringify(payload);
    const p = encryptPayloadString(rawJson);
    const s = computeVaultSignature(p);
    const envelope: SignedWalletEnvelope = { p, s };
    localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(envelope));
    window.dispatchEvent(
      new CustomEvent('malnadu-wallet-updated', { detail: { credits: safeCredits } })
    );
  } catch (err) {
    console.warn('Unable to persist wallet credits:', err);
  }

  return safeCredits;
}

/**
 * Loads and verifies the credit balance from LocalStorage.
 * If tampering is detected, resets to 0 to protect studio quota.
 */
export function loadWalletCredits(): number {
  try {
    const raw = localStorage.getItem(WALLET_STORAGE_KEY);
    if (!raw) {
      return saveWalletCredits(DEFAULT_INITIAL_CREDITS);
    }

    const envelope = JSON.parse(raw) as SignedWalletEnvelope;
    if (!envelope || typeof envelope.p !== 'string' || typeof envelope.s !== 'string') {
      console.warn('Wallet vault malformed — resetting to 0 credits.');
      return saveWalletCredits(0);
    }

    const expectedSig = computeVaultSignature(envelope.p);
    if (expectedSig !== envelope.s) {
      console.warn('Wallet tampering detected! Signature mismatch — locking credits to 0.');
      return saveWalletCredits(0);
    }

    const decryptedJson = decryptPayloadString(envelope.p);
    const parsed = JSON.parse(decryptedJson) as WalletVaultPayload;
    if (typeof parsed.c !== 'number' || isNaN(parsed.c) || parsed.c < 0) {
      return saveWalletCredits(0);
    }

    return Math.floor(parsed.c);
  } catch (err) {
    console.warn('Wallet vault read error — resetting to 0 credits:', err);
    return saveWalletCredits(0);
  }
}

/**
 * Deducts 1 credit after a successful AI Background Removal.
 */
export function deductWalletCredit(): { success: boolean; remaining: number } {
  const current = loadWalletCredits();
  if (current <= 0) {
    return { success: false, remaining: 0 };
  }
  const next = saveWalletCredits(current - 1);
  return { success: true, remaining: next };
}

/**
 * Verifies the Admin Secret PIN (default '1234').
 */
export function verifyAdminSecretPin(pin: string): boolean {
  return pin.trim() === DEFAULT_ADMIN_PIN;
}

/**
 * Recharges the studio wallet with +500, +800, +1000 (or custom amount) when a valid Admin PIN is supplied.
 */
export function rechargeWalletWithPin(
  pin: string,
  amountToAdd: number
): { ok: boolean; newBalance: number; error?: string } {
  if (!verifyAdminSecretPin(pin)) {
    return {
      ok: false,
      newBalance: loadWalletCredits(),
      error: 'Invalid Secret Admin PIN! Please enter the valid 4-digit studio PIN.',
    };
  }

  const add = Math.max(1, Math.floor(Number(amountToAdd) || 0));
  const current = loadWalletCredits();
  const next = saveWalletCredits(current + add);
  return {
    ok: true,
    newBalance: next,
  };
}
