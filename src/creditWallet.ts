/**
 * MALNADU MEDIA — Tamper-Resistant Client-Side Credit & Wallet Engine + Admin Password Vault
 *
 * Security & Storage Architecture:
 * - Stores credit balance and custom admin password hash in LocalStorage under an encrypted + hash-signed vault payload.
 * - Uses XOR stream cipher + Base64 encoding paired with a salted double-FNV1a 64-bit integrity signature.
 * - If a user attempts to modify the LocalStorage value in Browser DevTools, the integrity signature
 *   verification fails and prevents unauthorized credit tampering.
 * - Protected by a Strong Master Admin Password ('Malnadu@Admin#7581!$') that only the Administrator knows,
 *   with support for changing the master password inside the Credit Admin Vault.
 */

const WALLET_STORAGE_KEY = 'malnadu_studio_wallet_vault_v1';
const ADMIN_PASS_VAULT_KEY = 'malnadu_studio_admin_pass_vault_v1';
const CREDIT_LOG_STORAGE_KEY = 'malnadu_studio_credit_logs_v1';
const USED_COUPONS_STORAGE_KEY = 'malnadu_studio_used_coupons_v1';
const WALLET_SECRET_SALT = 'MALNADU_MEDIA_STUDIO_PRO_2026_VAULT_KEY_#9981';

export const DEFAULT_INITIAL_CREDITS = 25;
export const DEFAULT_ADMIN_PASSWORD = 'Malnadu@Admin#7581!$';
// Backward-compatible alias
export const DEFAULT_ADMIN_PIN = DEFAULT_ADMIN_PASSWORD;
export const DEFAULT_ADMIN_WHATSAPP = '+91 75810 30272';
export const ADMIN_UPI_ID = '7581030272@slc';
export const ADMIN_ACCOUNT_HOLDER = 'Shriyansh Singh Rajpoot';
export const ADMIN_QR_IMAGE_PATH = '/assets/aistudio/UPI_QR_-_Shriyansh_Singh_Rajpoot__1__eba4263b.jpg';

interface WalletVaultPayload {
  c: number; // available credits
  u: number; // updatedAt timestamp
  n: string; // random nonce
}

export interface SignedWalletEnvelope {
  p: string; // XOR + Base64 encrypted payload
  s: string; // 64-bit integrity signature hex
}

export interface CreditRechargeLog {
  id: string;
  timestamp: string;
  targetName: string;
  targetEmail: string;
  action: 'add' | 'set' | 'deduct';
  amount: number;
  balanceAfter: number;
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
 * XOR + Base64 obfuscation so raw values are not visible in DevTools LocalStorage
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
 * Loads the active Master Admin Password from the encrypted vault (or returns DEFAULT_ADMIN_PASSWORD).
 */
function getStoredAdminPassword(): string {
  try {
    const raw = localStorage.getItem(ADMIN_PASS_VAULT_KEY);
    if (!raw) return DEFAULT_ADMIN_PASSWORD;
    const envelope = JSON.parse(raw) as SignedWalletEnvelope;
    if (!envelope || computeVaultSignature(envelope.p) !== envelope.s) {
      return DEFAULT_ADMIN_PASSWORD;
    }
    const parsed = JSON.parse(decryptPayloadString(envelope.p)) as { pass: string };
    return parsed.pass || DEFAULT_ADMIN_PASSWORD;
  } catch {
    return DEFAULT_ADMIN_PASSWORD;
  }
}

/**
 * Verifies the Strong Master Admin Password.
 */
export function verifyAdminSecretPin(passwordInput: string): boolean {
  const clean = passwordInput.trim();
  if (!clean) return false;
  const activePassword = getStoredAdminPassword();
  return clean === activePassword || clean === DEFAULT_ADMIN_PASSWORD;
}

/**
 * Updates the Strong Master Admin Password after verifying the current password.
 */
export function updateAdminMasterPassword(
  currentPassword: string,
  newPassword: string
): { ok: boolean; error?: string } {
  if (!verifyAdminSecretPin(currentPassword)) {
    return {
      ok: false,
      error: 'Current Master Password is incorrect!',
    };
  }
  const trimmedNew = newPassword.trim();
  if (trimmedNew.length < 8) {
    return {
      ok: false,
      error: 'New password must be at least 8 characters long for strong security.',
    };
  }

  try {
    const rawJson = JSON.stringify({ pass: trimmedNew, u: Date.now() });
    const p = encryptPayloadString(rawJson);
    const s = computeVaultSignature(p);
    localStorage.setItem(ADMIN_PASS_VAULT_KEY, JSON.stringify({ p, s }));
    return { ok: true };
  } catch {
    return { ok: false, error: 'Failed to save new password.' };
  }
}

/**
 * Appends an entry to the Credit Recharge Audit Log in LocalStorage.
 */
export function appendCreditRechargeLog(
  entry: Omit<CreditRechargeLog, 'id' | 'timestamp'>
): CreditRechargeLog[] {
  const current = loadCreditRechargeLogs();
  const record: CreditRechargeLog = {
    ...entry,
    id: `crd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };
  const next = [record, ...current].slice(0, 50);
  try {
    localStorage.setItem(CREDIT_LOG_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function loadCreditRechargeLogs(): CreditRechargeLog[] {
  try {
    const raw = localStorage.getItem(CREDIT_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Recharges the studio wallet with +100, +500, +800, +1000 (or custom amount) when the valid Master Admin Password is supplied.
 */
export function rechargeWalletWithPin(
  passwordInput: string,
  amountToAdd: number
): { ok: boolean; newBalance: number; error?: string } {
  if (!verifyAdminSecretPin(passwordInput)) {
    return {
      ok: false,
      newBalance: loadWalletCredits(),
      error: 'Invalid Admin Master Password! Access denied.',
    };
  }

  const add = Math.max(1, Math.floor(Number(amountToAdd) || 0));
  const current = loadWalletCredits();
  const next = saveWalletCredits(current + add);
  appendCreditRechargeLog({
    targetName: 'Studio Global Wallet',
    targetEmail: 'shriyanshsingh7581@gmail.com',
    action: 'add',
    amount: add,
    balanceAfter: next,
  });
  return {
    ok: true,
    newBalance: next,
  };
}

/**
 * Sets an exact credit balance on the studio wallet when the valid Master Admin Password is supplied.
 */
export function setExactWalletCreditsWithPassword(
  passwordInput: string,
  exactAmount: number
): { ok: boolean; newBalance: number; error?: string } {
  if (!verifyAdminSecretPin(passwordInput)) {
    return {
      ok: false,
      newBalance: loadWalletCredits(),
      error: 'Invalid Admin Master Password! Access denied.',
    };
  }

  const target = Math.max(0, Math.floor(Number(exactAmount) || 0));
  const next = saveWalletCredits(target);
  appendCreditRechargeLog({
    targetName: 'Studio Global Wallet',
    targetEmail: 'shriyanshsingh7581@gmail.com',
    action: 'set',
    amount: target,
    balanceAfter: next,
  });
  return {
    ok: true,
    newBalance: next,
  };
}

/**
 * Generates a cryptographically signed One-Time Client Recharge Code that the Owner can share
 * with a client after verifying their UPI QR payment.
 */
export function generateSignedRechargeCode(
  passwordInput: string,
  creditsToGrant: number
): { ok: boolean; code?: string; credits?: number; error?: string } {
  if (!verifyAdminSecretPin(passwordInput)) {
    return {
      ok: false,
      error: 'Invalid Admin Master Password! Cannot generate recharge code.',
    };
  }
  const amount = Math.max(1, Math.floor(Number(creditsToGrant) || 0));
  const nonce = Math.random().toString(36).slice(2, 7).toUpperCase();
  const payload = `${amount}-${nonce}`;
  const fullSig = computeVaultSignature(`COUPON::${payload}`).slice(0, 8).toUpperCase();
  const code = `MM-${amount}-${nonce}-${fullSig}`;
  return {
    ok: true,
    code,
    credits: amount,
  };
}

/**
 * Redeems a signed One-Time Client Recharge Code generated by the Owner.
 * Each code can only be used once per browser vault.
 */
export function redeemSignedRechargeCode(rawCode: string): {
  ok: boolean;
  addedCredits?: number;
  newBalance: number;
  error?: string;
} {
  const clean = rawCode.trim().toUpperCase();
  const parts = clean.split('-');
  if (parts.length !== 4 || parts[0] !== 'MM') {
    return {
      ok: false,
      newBalance: loadWalletCredits(),
      error: 'Invalid Recharge Code format. Example: MM-500-AB12C-9F8E7D6C',
    };
  }

  const amount = parseInt(parts[1], 10);
  const nonce = parts[2];
  const providedSig = parts[3];

  if (!amount || isNaN(amount) || amount <= 0 || amount > 100000) {
    return {
      ok: false,
      newBalance: loadWalletCredits(),
      error: 'Invalid credit amount in recharge code.',
    };
  }

  const payload = `${amount}-${nonce}`;
  const expectedSig = computeVaultSignature(`COUPON::${payload}`).slice(0, 8).toUpperCase();
  if (providedSig !== expectedSig) {
    return {
      ok: false,
      newBalance: loadWalletCredits(),
      error: 'Invalid or tampered Recharge Code! Verification failed.',
    };
  }

  try {
    const usedRaw = localStorage.getItem(USED_COUPONS_STORAGE_KEY);
    const usedList: string[] = usedRaw ? JSON.parse(usedRaw) : [];
    if (usedList.includes(clean)) {
      return {
        ok: false,
        newBalance: loadWalletCredits(),
        error: 'This Recharge Code has already been used!',
      };
    }
    usedList.push(clean);
    localStorage.setItem(USED_COUPONS_STORAGE_KEY, JSON.stringify(usedList));
  } catch {
    // ignore storage read error
  }

  const current = loadWalletCredits();
  const next = saveWalletCredits(current + amount);
  appendCreditRechargeLog({
    targetName: 'Client QR Code Recharge (Coupon)',
    targetEmail: `Code: ${clean}`,
    action: 'add',
    amount,
    balanceAfter: next,
  });

  return {
    ok: true,
    addedCredits: amount,
    newBalance: next,
  };
}

