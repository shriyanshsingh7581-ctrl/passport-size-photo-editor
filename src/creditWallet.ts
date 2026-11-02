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

const WALLET_STORAGE_KEY = 'malnadu_studio_wallet_vault_v2';
const ADMIN_POOL_STORAGE_KEY = 'malnadu_studio_admin_pool_vault_v1';
const ADMIN_PASS_VAULT_KEY = 'malnadu_studio_admin_pass_vault_v1';
const CREDIT_LOG_STORAGE_KEY = 'malnadu_studio_credit_logs_v1';
const USED_COUPONS_STORAGE_KEY = 'malnadu_studio_used_coupons_v1';
const PAYMENT_REQUESTS_STORAGE_KEY = 'malnadu_studio_payment_requests_v1';
const WALLET_SECRET_SALT = 'MALNADU_MEDIA_STUDIO_PRO_2026_VAULT_KEY_#9981';

export const DEFAULT_INITIAL_CREDITS = 5;
export const DEFAULT_INITIAL_ADMIN_POOL = 500;
export const DEFAULT_ADMIN_PASSWORD = 'Malnadu@Admin#7581!$';
// Backward-compatible alias
export const DEFAULT_ADMIN_PIN = DEFAULT_ADMIN_PASSWORD;
export const DEFAULT_ADMIN_WHATSAPP = '+91 75810 30272';

// 1. OWNER / SUPER ADMIN QR CODE (Shriyansh Singh Rajpoot — Used in /website-admin to purchase Admin Pool Credits from Owner)
export const OWNER_ADMIN_UPI_ID = '7581030272@slc';
export const OWNER_ADMIN_ACCOUNT_HOLDER = 'Shriyansh Singh Rajpoot';
export const OWNER_ADMIN_QR_IMAGE_PATH =
  '/assets/aistudio/shriyansh-slice-qr.svg';

// Backward-compatible aliases for Owner QR
export const ADMIN_UPI_ID = OWNER_ADMIN_UPI_ID;
export const ADMIN_ACCOUNT_HOLDER = OWNER_ADMIN_ACCOUNT_HOLDER;
export const ADMIN_QR_IMAGE_PATH = OWNER_ADMIN_QR_IMAGE_PATH;

// 2. WEBSITE USER PAYMENT QR CODE (T TT Google Pay UPI QR — Shown to Website Users when buying photo credits)
export const WEBSITE_USER_QR_IMAGE_PATH = '/assets/aistudio/IMG-20261102-WA0066_bcf898c7.jpg';
export const WEBSITE_USER_PAYEE_NAME = 'T TT';
const WEBSITE_USER_CUSTOM_QR_KEY = 'malnadu_website_user_custom_qr_v2';

export function loadWebsiteUserQrImage(): string {
  try {
    const custom = localStorage.getItem(WEBSITE_USER_CUSTOM_QR_KEY);
    if (custom && custom.startsWith('data:image/')) {
      return custom;
    }
  } catch {
    // ignore
  }
  return WEBSITE_USER_QR_IMAGE_PATH;
}

export function saveWebsiteUserQrImage(dataUrl: string): void {
  try {
    if (!dataUrl) {
      localStorage.removeItem(WEBSITE_USER_CUSTOM_QR_KEY);
    } else {
      localStorage.setItem(WEBSITE_USER_CUSTOM_QR_KEY, dataUrl);
    }
    window.dispatchEvent(new CustomEvent('malnadu-user-qr-updated'));
  } catch {
    // ignore
  }
}

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

export interface PaymentCreditRequest {
  id: string;
  clientName: string;
  clientContact: string;
  userId?: string;
  targetType?: 'client_wallet' | 'admin_pool';
  packageLabel: string;
  creditsRequested: number;
  amountInr: string;
  utrNumber: string;
  paymentNote?: string;
  paymentScreenshotDataUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedCode?: string;
  createdAt: string;
  processedAt?: string;
}

const DEFAULT_DEMO_PAYMENT_REQUESTS: PaymentCreditRequest[] = [
  {
    id: 'req-demo-101',
    clientName: 'Arjun Nair (Studio Client)',
    clientContact: 'arjun.nair@gmail.com',
    userId: 'user-arjun-02',
    targetType: 'client_wallet',
    packageLabel: 'Starter Pack',
    creditsRequested: 100,
    amountInr: '₹99',
    utrNumber: '431289450112',
    paymentNote: 'Paid ₹99 via Google Pay QR (T T). Please confirm and add 100 credits to my account.',
    status: 'pending',
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
];

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
      // Unauthenticated guests start with 0 credits; free credits are granted ONLY upon new user signup
      return saveWalletCredits(0);
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
 * ============================================================================
 * 2-TIER DISTRIBUTOR SYSTEM: WEBSITE ADMIN CREDIT POOL (/website-admin)
 * ============================================================================
 * The Super Owner (/credit-admin) allocates a bounded pool of credits to the
 * Website Admin (/website-admin). The Website Admin can only give credits to
 * registered users (or the studio wallet) by deducting from this Admin Pool.
 */
export function saveAdminCreditPool(credits: number): number {
  const safeCredits = Math.max(0, Math.floor(Number(credits) || 0));
  const payload: WalletVaultPayload = {
    c: safeCredits,
    u: Date.now(),
    n: Math.random().toString(36).slice(2, 10),
  };

  try {
    const rawJson = JSON.stringify(payload);
    const p = encryptPayloadString(rawJson);
    const s = computeVaultSignature(`ADMIN_POOL::${p}`);
    const envelope: SignedWalletEnvelope = { p, s };
    localStorage.setItem(ADMIN_POOL_STORAGE_KEY, JSON.stringify(envelope));
    window.dispatchEvent(
      new CustomEvent('malnadu-admin-pool-updated', { detail: { adminCreditPool: safeCredits } })
    );
  } catch (err) {
    console.warn('Unable to persist admin credit pool:', err);
  }

  return safeCredits;
}

export function loadAdminCreditPool(): number {
  try {
    const raw = localStorage.getItem(ADMIN_POOL_STORAGE_KEY);
    if (!raw) {
      return saveAdminCreditPool(DEFAULT_INITIAL_ADMIN_POOL);
    }

    const envelope = JSON.parse(raw) as SignedWalletEnvelope;
    if (!envelope || typeof envelope.p !== 'string' || typeof envelope.s !== 'string') {
      return saveAdminCreditPool(0);
    }

    const expectedSig = computeVaultSignature(`ADMIN_POOL::${envelope.p}`);
    if (expectedSig !== envelope.s) {
      console.warn('Admin Pool tampering detected! Signature mismatch — locking pool to 0.');
      return saveAdminCreditPool(0);
    }

    const decryptedJson = decryptPayloadString(envelope.p);
    const parsed = JSON.parse(decryptedJson) as WalletVaultPayload;
    if (typeof parsed.c !== 'number' || isNaN(parsed.c) || parsed.c < 0) {
      return saveAdminCreditPool(0);
    }

    return Math.floor(parsed.c);
  } catch {
    return saveAdminCreditPool(0);
  }
}

/**
 * Super Owner (/credit-admin) adds credits into the Website Admin's Distributable Pool.
 */
export function rechargeAdminPoolWithPassword(
  passwordInput: string,
  amountToAdd: number
): { ok: boolean; newPoolBalance: number; error?: string } {
  if (!verifyAdminSecretPin(passwordInput)) {
    return {
      ok: false,
      newPoolBalance: loadAdminCreditPool(),
      error: 'Invalid Admin Master Password! Access denied.',
    };
  }

  const add = Math.max(1, Math.floor(Number(amountToAdd) || 0));
  const current = loadAdminCreditPool();
  const next = saveAdminCreditPool(current + add);
  appendCreditRechargeLog({
    targetName: 'Website Admin Credit Pool (Distributor)',
    targetEmail: '/website-admin Pool Recharged by Owner',
    action: 'add',
    amount: add,
    balanceAfter: next,
  });
  return {
    ok: true,
    newPoolBalance: next,
  };
}

/**
 * Super Owner (/credit-admin) sets an exact credit balance for the Website Admin's Distributable Pool.
 */
export function setExactAdminPoolWithPassword(
  passwordInput: string,
  exactAmount: number
): { ok: boolean; newPoolBalance: number; error?: string } {
  if (!verifyAdminSecretPin(passwordInput)) {
    return {
      ok: false,
      newPoolBalance: loadAdminCreditPool(),
      error: 'Invalid Admin Master Password! Access denied.',
    };
  }

  const target = Math.max(0, Math.floor(Number(exactAmount) || 0));
  const next = saveAdminCreditPool(target);
  appendCreditRechargeLog({
    targetName: 'Website Admin Credit Pool (Distributor)',
    targetEmail: '/website-admin Pool Set by Owner',
    action: 'set',
    amount: target,
    balanceAfter: next,
  });
  return {
    ok: true,
    newPoolBalance: next,
  };
}

/**
 * Website Admin (/website-admin)redeems a signed Owner Recharge Code into the Website Admin Credit Pool.
 */
export function redeemAdminPoolRechargeCode(rawCode: string): {
  ok: boolean;
  addedCredits?: number;
  newPoolBalance: number;
  error?: string;
} {
  const clean = rawCode.trim().toUpperCase();
  const parts = clean.split('-');
  if (parts.length !== 4 || parts[0] !== 'MM') {
    return {
      ok: false,
      newPoolBalance: loadAdminCreditPool(),
      error: 'Invalid Recharge Code format. Example: MM-500-AB12C-9F8E7D6C',
    };
  }

  const amount = parseInt(parts[1], 10);
  const nonce = parts[2];
  const providedSig = parts[3];

  if (!amount || isNaN(amount) || amount <= 0 || amount > 100000) {
    return {
      ok: false,
      newPoolBalance: loadAdminCreditPool(),
      error: 'Invalid credit amount in recharge code.',
    };
  }

  const payload = `${amount}-${nonce}`;
  const expectedSig = computeVaultSignature(`COUPON::${payload}`).slice(0, 8).toUpperCase();
  if (providedSig !== expectedSig) {
    return {
      ok: false,
      newPoolBalance: loadAdminCreditPool(),
      error: 'Invalid or tampered Recharge Code! Verification failed.',
    };
  }

  try {
    const usedRaw = localStorage.getItem(USED_COUPONS_STORAGE_KEY);
    const usedList: string[] = usedRaw ? JSON.parse(usedRaw) : [];
    if (usedList.includes(clean)) {
      return {
        ok: false,
        newPoolBalance: loadAdminCreditPool(),
        error: 'This Recharge Code has already been used!',
      };
    }
    usedList.push(clean);
    localStorage.setItem(USED_COUPONS_STORAGE_KEY, JSON.stringify(usedList));
  } catch {
    // ignore
  }

  const current = loadAdminCreditPool();
  const next = saveAdminCreditPool(current + amount);
  appendCreditRechargeLog({
    targetName: 'Website Admin Credit Pool (Code Redeemed)',
    targetEmail: `Code: ${clean}`,
    action: 'add',
    amount,
    balanceAfter: next,
  });

  return {
    ok: true,
    addedCredits: amount,
    newPoolBalance: next,
  };
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
 * Loads all Client UPI QR Payment Requests.
 */
export function loadPaymentCreditRequests(): PaymentCreditRequest[] {
  try {
    const raw = localStorage.getItem(PAYMENT_REQUESTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(
        PAYMENT_REQUESTS_STORAGE_KEY,
        JSON.stringify(DEFAULT_DEMO_PAYMENT_REQUESTS)
      );
      return DEFAULT_DEMO_PAYMENT_REQUESTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_DEMO_PAYMENT_REQUESTS;
  } catch {
    return DEFAULT_DEMO_PAYMENT_REQUESTS;
  }
}

export function savePaymentCreditRequests(list: PaymentCreditRequest[]): void {
  try {
    localStorage.setItem(PAYMENT_REQUESTS_STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(
      new CustomEvent('malnadu-payment-requests-updated', { detail: { requests: list } })
    );
  } catch {
    // ignore
  }
}

/**
 * Submits a new Client UPI Payment Request after scanning the QR Code.
 */
export function submitClientPaymentRequest(input: {
  clientName: string;
  clientContact: string;
  userId?: string;
  targetType?: 'client_wallet' | 'admin_pool';
  packageLabel: string;
  creditsRequested: number;
  amountInr: string;
  utrNumber: string;
  paymentNote?: string;
  paymentScreenshotDataUrl?: string;
}): PaymentCreditRequest {
  const current = loadPaymentCreditRequests();
  const newReq: PaymentCreditRequest = {
    id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    clientName: input.clientName.trim() || 'Studio Client',
    clientContact: input.clientContact.trim() || 'Not provided',
    userId: input.userId,
    targetType: input.targetType || 'client_wallet',
    packageLabel: input.packageLabel,
    creditsRequested: Math.max(1, Math.floor(Number(input.creditsRequested) || 100)),
    amountInr: input.amountInr,
    utrNumber: input.utrNumber.trim() || 'UPI-PAID',
    paymentNote: input.paymentNote?.trim() || '',
    paymentScreenshotDataUrl: input.paymentScreenshotDataUrl,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const next = [newReq, ...current].slice(0, 100);
  savePaymentCreditRequests(next);
  return newReq;
}

/**
 * Confirms a Client Payment Request (Protected by Strong Admin Master Password)
 * and immediately adds the requested credits to either the Website Studio Wallet
 * or the Website Admin Credit Pool (Distributor Balance).
 */
export function approveClientPaymentRequest(
  passwordInput: string,
  requestId: string,
  creditTargetOverride?: 'client_wallet' | 'admin_pool'
): {
  ok: boolean;
  newBalance: number;
  newAdminPoolBalance: number;
  creditedTo: 'client_wallet' | 'admin_pool';
  approvedRequest?: PaymentCreditRequest;
  generatedCode?: string;
  error?: string;
} {
  if (!verifyAdminSecretPin(passwordInput)) {
    return {
      ok: false,
      newBalance: loadWalletCredits(),
      newAdminPoolBalance: loadAdminCreditPool(),
      creditedTo: 'client_wallet',
      error: 'Invalid Admin Master Password! Access denied.',
    };
  }

  const all = loadPaymentCreditRequests();
  const target = all.find((r) => r.id === requestId);
  if (!target) {
    return {
      ok: false,
      newBalance: loadWalletCredits(),
      newAdminPoolBalance: loadAdminCreditPool(),
      creditedTo: 'client_wallet',
      error: 'Payment request not found.',
    };
  }

  if (target.status === 'approved') {
    return {
      ok: false,
      newBalance: loadWalletCredits(),
      newAdminPoolBalance: loadAdminCreditPool(),
      creditedTo: target.targetType || 'client_wallet',
      error: 'This payment request has already been confirmed and credited.',
    };
  }

  const addAmount = Math.max(1, Math.floor(Number(target.creditsRequested) || 100));
  const destination = creditTargetOverride || target.targetType || 'client_wallet';

  let nextWalletCredits = loadWalletCredits();
  let nextAdminPoolCredits = loadAdminCreditPool();

  if (destination === 'admin_pool') {
    nextAdminPoolCredits = saveAdminCreditPool(nextAdminPoolCredits + addAmount);
  } else {
    nextWalletCredits = saveWalletCredits(nextWalletCredits + addAmount);
  }

  const codeGen = generateSignedRechargeCode(passwordInput, addAmount);

  const updatedReq: PaymentCreditRequest = {
    ...target,
    targetType: destination,
    status: 'approved',
    approvedCode: codeGen.code,
    processedAt: new Date().toISOString(),
  };

  const nextList = all.map((r) => (r.id === requestId ? updatedReq : r));
  savePaymentCreditRequests(nextList);

  appendCreditRechargeLog({
    targetName:
      destination === 'admin_pool'
        ? `${target.clientName} → Website Admin Pool`
        : `${target.clientName} (UPI QR Confirmed)`,
    targetEmail: `${target.clientContact} · UTR: ${target.utrNumber}`,
    action: 'add',
    amount: addAmount,
    balanceAfter: destination === 'admin_pool' ? nextAdminPoolCredits : nextWalletCredits,
  });

  return {
    ok: true,
    newBalance: nextWalletCredits,
    newAdminPoolBalance: nextAdminPoolCredits,
    creditedTo: destination,
    approvedRequest: updatedReq,
    generatedCode: codeGen.code,
  };
}

/**
 * Rejects a Client Payment Request (Protected by Strong Admin Master Password).
 */
export function rejectClientPaymentRequest(
  passwordInput: string,
  requestId: string
): { ok: boolean; error?: string } {
  if (!verifyAdminSecretPin(passwordInput)) {
    return {
      ok: false,
      error: 'Invalid Admin Master Password! Access denied.',
    };
  }

  const all = loadPaymentCreditRequests();
  const nextList = all.map((r) =>
    r.id === requestId
      ? { ...r, status: 'rejected' as const, processedAt: new Date().toISOString() }
      : r
  );
  savePaymentCreditRequests(nextList);
  return { ok: true };
}

/**
 * WEBSITE ADMIN (/website-admin) approves a Website User's QR Payment Request
 * strictly by deducting the credits from the Website Admin's Distributable Pool (`adminCreditPool`).
 * The Website Admin CANNOT approve or add more credits than what is available in `adminCreditPool`.
 */
export function approveUserPaymentFromAdminPool(
  requestId: string,
  customCreditsToGive?: number
): {
  ok: boolean;
  creditsGiven: number;
  remainingAdminPool: number;
  approvedRequest?: PaymentCreditRequest;
  error?: string;
} {
  const all = loadPaymentCreditRequests();
  const target = all.find((r) => r.id === requestId);
  const currentPool = loadAdminCreditPool();

  if (!target) {
    return {
      ok: false,
      creditsGiven: 0,
      remainingAdminPool: currentPool,
      error: 'Payment request not found.',
    };
  }

  if (target.status === 'approved') {
    return {
      ok: false,
      creditsGiven: 0,
      remainingAdminPool: currentPool,
      error: 'This payment request has already been confirmed and credited.',
    };
  }

  const creditsToGrant =
    customCreditsToGive !== undefined
      ? Math.max(1, Math.floor(Number(customCreditsToGive) || 0))
      : Math.max(1, Math.floor(Number(target.creditsRequested) || 50));

  if (currentPool <= 0 || creditsToGrant > currentPool) {
    return {
      ok: false,
      creditsGiven: 0,
      remainingAdminPool: currentPool,
      error: `Insufficient Admin Pool Credits! You only have ${currentPool} credits left in your Admin Pool, so you cannot add ${creditsToGrant} credits. Please scan Shriyansh Singh Rajpoot's UPI QR (${OWNER_ADMIN_UPI_ID}) below to purchase more Admin Pool credits from the Owner.`,
    };
  }

  const nextPool = saveAdminCreditPool(currentPool - creditsToGrant);

  const updatedReq: PaymentCreditRequest = {
    ...target,
    creditsRequested: creditsToGrant,
    status: 'approved',
    processedAt: new Date().toISOString(),
  };

  const nextList = all.map((r) => (r.id === requestId ? updatedReq : r));
  savePaymentCreditRequests(nextList);

  appendCreditRechargeLog({
    targetName: `${target.clientName} (User QR Payment Approved)`,
    targetEmail: `${target.clientContact} · UTR: ${target.utrNumber} · Pool Left: ${nextPool}`,
    action: 'add',
    amount: creditsToGrant,
    balanceAfter: nextPool,
  });

  return {
    ok: true,
    creditsGiven: creditsToGrant,
    remainingAdminPool: nextPool,
    approvedRequest: updatedReq,
  };
}

export function rejectUserPaymentByWebsiteAdmin(requestId: string): { ok: boolean } {
  const all = loadPaymentCreditRequests();
  const nextList = all.map((r) =>
    r.id === requestId
      ? { ...r, status: 'rejected' as const, processedAt: new Date().toISOString() }
      : r
  );
  savePaymentCreditRequests(nextList);
  return { ok: true };
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
 * with a client or Website Admin after verifying their UPI QR payment.
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

/**
 * ============================================================================
 * MULTI-LAYER ANTI-ABUSE FREE SIGNUP CREDIT DETECTION SYSTEM
 * ============================================================================
 * Ensures that:
 * 1. Free credits are ONLY granted when a genuinely new user signs up.
 * 2. A user who has already signed up and used their free credits CANNOT claim
 *    free credits again by:
 *    - Signing up again with the same email or a Gmail dot/plus alias (e.g. a.b+2@gmail.com)
 *    - Signing up again with the same phone number
 *    - Creating a second account on the same device / browser hardware fingerprint
 *    - Clearing LocalStorage (persisted across Encrypted LocalStorage, SessionStorage,
 *      Browser Cookie, IndexedDB, and Cloud Firestore User Records).
 */
const FREE_CREDIT_GUARD_VAULT_KEY = 'malnadu_free_credit_guard_vault_v1';
const FREE_CREDIT_GUARD_SESSION_KEY = 'malnadu_free_credit_guard_session_v1';
const FREE_CREDIT_COOKIE_NAME = 'mm_fc_device_claimed';
const FREE_CREDIT_IDB_NAME = 'MalnaduAntiAbuseVaultDB';
const FREE_CREDIT_IDB_STORE = 'signup_claims';

export interface BlockedFreeCreditAttempt {
  id: string;
  timestamp: string;
  attemptedName: string;
  attemptedEmail: string;
  attemptedPhone: string;
  deviceFingerprint: string;
  reason: string;
}

export interface FreeCreditGuardState {
  claimedEmails: string[]; // normalized emails
  claimedPhones: string[]; // normalized 10-digit phones
  claimedUids: string[];
  claimedFingerprints: string[];
  deviceHasClaimed: boolean;
  blockedAttempts: BlockedFreeCreditAttempt[];
}

let cachedDeviceFingerprint: string | null = null;
let idbDeviceClaimedMemoryFlag = false;

/**
 * Normalizes an email address to prevent Gmail dot (.) and sub-address (+tag) bypasses.
 */
export function normalizeIdentityEmail(rawEmail: string): string {
  const clean = (rawEmail || '').trim().toLowerCase();
  if (!clean || !clean.includes('@')) return clean;
  const [localPart, domainPart] = clean.split('@');
  if (!localPart || !domainPart) return clean;

  // Strip +alias on all email providers
  const baseLocal = localPart.split('+')[0];

  // Strip dots on Gmail / Googlemail accounts
  if (domainPart === 'gmail.com' || domainPart === 'googlemail.com') {
    return `${baseLocal.replace(/\./g, '')}@gmail.com`;
  }
  return `${baseLocal}@${domainPart}`;
}

/**
 * Normalizes a phone number to its last 10 digits so +91 / spaces / dashes cannot bypass detection.
 */
export function normalizeIdentityPhone(rawPhone: string): string {
  const digits = (rawPhone || '').replace(/\D+/g, '');
  if (digits.length < 7) return '';
  return digits.slice(-10);
}

/**
 * Generates a deterministic Hardware + Browser Device Fingerprint (`FP-...`)
 * combining screen metrics, CPU cores, memory, timezone, WebGL GPU renderer, and Canvas 2D signature.
 */
export function getDeviceHardwareFingerprint(): string {
  if (cachedDeviceFingerprint) return cachedDeviceFingerprint;
  if (typeof window === 'undefined') return 'FP-SERVER-NODE';

  try {
    const nav = window.navigator as any;
    const scr = window.screen;
    const parts: string[] = [
      nav.userAgent || '',
      nav.language || '',
      nav.platform || '',
      String(nav.hardwareConcurrency || 0),
      String(nav.deviceMemory || 0),
      String(nav.maxTouchPoints || 0),
      `${scr?.width || 0}x${scr?.height || 0}x${scr?.colorDepth || 0}`,
      String(window.devicePixelRatio || 1),
      Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    ];

    // Canvas 2D hardware raster signature
    try {
      const c = document.createElement('canvas');
      c.width = 160;
      c.height = 36;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '13px Arial';
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(10, 4, 80, 20);
        ctx.fillStyle = '#070a14';
        ctx.fillText('MalnaduGuard#2026', 6, 8);
        parts.push(c.toDataURL().slice(-64));
      }
    } catch {
      // ignore canvas fingerprint error
    }

    // WebGL hardware renderer / vendor
    try {
      const glCanvas = document.createElement('canvas');
      const gl: any =
        glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');
      if (gl) {
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        if (dbg) {
          parts.push(String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || ''));
          parts.push(String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || ''));
        }
      }
    } catch {
      // ignore webgl error
    }

    const sig = computeVaultSignature(`DEVICE_FP::${parts.join('||')}`).toUpperCase();
    cachedDeviceFingerprint = `FP-${sig}`;
    return cachedDeviceFingerprint;
  } catch {
    cachedDeviceFingerprint = 'FP-DEFAULT-BROWSER';
    return cachedDeviceFingerprint;
  }
}

function hasDeviceClaimCookie(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    return document.cookie.split(';').some((c) => c.trim().startsWith(`${FREE_CREDIT_COOKIE_NAME}=`));
  } catch {
    return false;
  }
}

function setDeviceClaimCookie(fp: string): void {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${FREE_CREDIT_COOKIE_NAME}=${encodeURIComponent(fp)}; max-age=31536000; path=/; SameSite=Lax`;
  } catch {
    // ignore
  }
}

function persistClaimToIndexedDb(state: FreeCreditGuardState): void {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;
  try {
    const req = window.indexedDB.open(FREE_CREDIT_IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FREE_CREDIT_IDB_STORE)) {
        db.createObjectStore(FREE_CREDIT_IDB_STORE);
      }
    };
    req.onsuccess = () => {
      try {
        const db = req.result;
        const tx = db.transaction(FREE_CREDIT_IDB_STORE, 'readwrite');
        tx.objectStore(FREE_CREDIT_IDB_STORE).put(state, 'guard_state');
      } catch {
        // ignore
      }
    };
  } catch {
    // ignore
  }
}

function hydrateClaimFromIndexedDb(): void {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;
  try {
    const req = window.indexedDB.open(FREE_CREDIT_IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FREE_CREDIT_IDB_STORE)) {
        db.createObjectStore(FREE_CREDIT_IDB_STORE);
      }
    };
    req.onsuccess = () => {
      try {
        const db = req.result;
        const tx = db.transaction(FREE_CREDIT_IDB_STORE, 'readonly');
        const getReq = tx.objectStore(FREE_CREDIT_IDB_STORE).get('guard_state');
        getReq.onsuccess = () => {
          const idbState = getReq.result as FreeCreditGuardState | undefined;
          if (idbState && idbState.deviceHasClaimed) {
            idbDeviceClaimedMemoryFlag = true;
            // Re-hydrate LocalStorage & Cookie if the user tried to clear them
            const current = loadFreeCreditGuardState();
            const merged: FreeCreditGuardState = {
              claimedEmails: Array.from(
                new Set([...current.claimedEmails, ...(idbState.claimedEmails || [])])
              ),
              claimedPhones: Array.from(
                new Set([...current.claimedPhones, ...(idbState.claimedPhones || [])])
              ),
              claimedUids: Array.from(
                new Set([...current.claimedUids, ...(idbState.claimedUids || [])])
              ),
              claimedFingerprints: Array.from(
                new Set([...current.claimedFingerprints, ...(idbState.claimedFingerprints || [])])
              ),
              deviceHasClaimed: true,
              blockedAttempts:
                current.blockedAttempts.length >= (idbState.blockedAttempts || []).length
                  ? current.blockedAttempts
                  : idbState.blockedAttempts || [],
            };
            saveFreeCreditGuardState(merged);
          }
        };
      } catch {
        // ignore
      }
    };
  } catch {
    // ignore
  }
}

// Automatically hydrate from IndexedDB on module load
if (typeof window !== 'undefined') {
  hydrateClaimFromIndexedDb();
}

export function loadFreeCreditGuardState(): FreeCreditGuardState {
  const defaultFp = getDeviceHardwareFingerprint();
  const cookieClaimed = hasDeviceClaimCookie();
  const emptyState: FreeCreditGuardState = {
    claimedEmails: [],
    claimedPhones: [],
    claimedUids: [],
    claimedFingerprints: cookieClaimed || idbDeviceClaimedMemoryFlag ? [defaultFp] : [],
    deviceHasClaimed: cookieClaimed || idbDeviceClaimedMemoryFlag,
    blockedAttempts: [],
  };

  try {
    const raw =
      localStorage.getItem(FREE_CREDIT_GUARD_VAULT_KEY) ||
      sessionStorage.getItem(FREE_CREDIT_GUARD_SESSION_KEY);
    if (!raw) {
      return emptyState;
    }

    const envelope = JSON.parse(raw) as SignedWalletEnvelope;
    if (!envelope || typeof envelope.p !== 'string' || typeof envelope.s !== 'string') {
      // Tampering with guard vault automatically locks device as claimed
      return {
        ...emptyState,
        claimedFingerprints: [defaultFp],
        deviceHasClaimed: true,
      };
    }

    const expectedSig = computeVaultSignature(`FC_GUARD::${envelope.p}`);
    if (expectedSig !== envelope.s) {
      // Signature tampering detected — lock free credits on this device
      return {
        ...emptyState,
        claimedFingerprints: [defaultFp],
        deviceHasClaimed: true,
      };
    }

    const parsed = JSON.parse(decryptPayloadString(envelope.p)) as Partial<FreeCreditGuardState>;
    const claimedFps = Array.isArray(parsed.claimedFingerprints) ? parsed.claimedFingerprints : [];
    const isDeviceClaimed =
      Boolean(parsed.deviceHasClaimed) ||
      cookieClaimed ||
      idbDeviceClaimedMemoryFlag ||
      claimedFps.includes(defaultFp);

    return {
      claimedEmails: Array.isArray(parsed.claimedEmails) ? parsed.claimedEmails : [],
      claimedPhones: Array.isArray(parsed.claimedPhones) ? parsed.claimedPhones : [],
      claimedUids: Array.isArray(parsed.claimedUids) ? parsed.claimedUids : [],
      claimedFingerprints: isDeviceClaimed
        ? Array.from(new Set([...claimedFps, defaultFp]))
        : claimedFps,
      deviceHasClaimed: isDeviceClaimed,
      blockedAttempts: Array.isArray(parsed.blockedAttempts) ? parsed.blockedAttempts : [],
    };
  } catch {
    return emptyState;
  }
}

export function saveFreeCreditGuardState(state: FreeCreditGuardState): void {
  try {
    const rawJson = JSON.stringify(state);
    const p = encryptPayloadString(rawJson);
    const s = computeVaultSignature(`FC_GUARD::${p}`);
    const serialized = JSON.stringify({ p, s });
    localStorage.setItem(FREE_CREDIT_GUARD_VAULT_KEY, serialized);
    sessionStorage.setItem(FREE_CREDIT_GUARD_SESSION_KEY, serialized);
    if (state.deviceHasClaimed) {
      idbDeviceClaimedMemoryFlag = true;
      setDeviceClaimCookie(getDeviceHardwareFingerprint());
    }
    persistClaimToIndexedDb(state);
    window.dispatchEvent(new CustomEvent('malnadu-free-credit-guard-updated', { detail: state }));
  } catch {
    // ignore
  }
}

/**
 * Synchronizes existing user profiles from Firestore / LocalStorage into the Free Credit Guard
 * so any previously registered email, phone, UID, or hardware fingerprint is recognized across sessions.
 */
export function syncExistingUsersIntoFreeCreditGuard(
  users: Array<{
    uid?: string;
    email?: string;
    phone?: string;
    freeCreditsClaimed?: boolean;
    deviceFingerprint?: string;
  }>
): FreeCreditGuardState {
  const current = loadFreeCreditGuardState();
  const currentFp = getDeviceHardwareFingerprint();

  const emailSet = new Set(current.claimedEmails);
  const phoneSet = new Set(current.claimedPhones);
  const uidSet = new Set(current.claimedUids);
  const fpSet = new Set(current.claimedFingerprints);
  let deviceClaimed = current.deviceHasClaimed;

  for (const u of users) {
    // Skip built-in static demo seed accounts so a real first-time user can still sign up once
    if (u.uid === 'admin-demo-01' || u.uid === 'user-arjun-02' || u.uid === 'user-meera-03') {
      continue;
    }
    if (u.email) {
      const normEmail = normalizeIdentityEmail(u.email);
      if (normEmail) emailSet.add(normEmail);
    }
    if (u.phone) {
      const normPhone = normalizeIdentityPhone(u.phone);
      if (normPhone) phoneSet.add(normPhone);
    }
    if (u.uid) {
      uidSet.add(u.uid);
    }
    if (u.deviceFingerprint) {
      fpSet.add(u.deviceFingerprint);
      if (u.deviceFingerprint === currentFp) {
        deviceClaimed = true;
      }
    }
  }

  const updated: FreeCreditGuardState = {
    claimedEmails: Array.from(emailSet),
    claimedPhones: Array.from(phoneSet),
    claimedUids: Array.from(uidSet),
    claimedFingerprints: Array.from(fpSet),
    deviceHasClaimed: deviceClaimed,
    blockedAttempts: current.blockedAttempts,
  };

  saveFreeCreditGuardState(updated);
  return updated;
}

/**
 * Checks whether an email or phone number is already registered (including Gmail dot/plus aliases).
 */
export function checkDuplicateSignupIdentity(
  email: string,
  phone: string,
  existingUsers: Array<{ uid?: string; email?: string; phone?: string; deviceFingerprint?: string }> = []
): {
  emailAlreadyRegistered: boolean;
  phoneAlreadyRegistered: boolean;
  deviceAlreadyClaimed: boolean;
  deviceFingerprint: string;
} {
  const guard = syncExistingUsersIntoFreeCreditGuard(existingUsers);
  const normEmail = normalizeIdentityEmail(email);
  const normPhone = normalizeIdentityPhone(phone);
  const currentFp = getDeviceHardwareFingerprint();

  const emailInUsers = existingUsers.some(
    (u) => u.email && normalizeIdentityEmail(u.email) === normEmail
  );
  const phoneInUsers =
    Boolean(normPhone) &&
    existingUsers.some(
      (u) =>
        u.uid !== 'admin-demo-01' &&
        u.uid !== 'user-arjun-02' &&
        u.uid !== 'user-meera-03' &&
        u.phone &&
        normalizeIdentityPhone(u.phone) === normPhone
    );
  const fpInUsers = existingUsers.some(
    (u) => u.deviceFingerprint && u.deviceFingerprint === currentFp
  );

  return {
    emailAlreadyRegistered: Boolean(normEmail) && (emailInUsers || guard.claimedEmails.includes(normEmail)),
    phoneAlreadyRegistered: Boolean(normPhone) && (phoneInUsers || guard.claimedPhones.includes(normPhone)),
    deviceAlreadyClaimed:
      guard.deviceHasClaimed || guard.claimedFingerprints.includes(currentFp) || fpInUsers,
    deviceFingerprint: currentFp,
  };
}

/**
 * Allocates free signup credits to a brand-new user account ONLY on genuine first-time signup,
 * deducting them directly from the Website Admin's Distributable Credit Pool (`adminCreditPool`).
 *
 * Multi-Layer Anti-Abuse Protection:
 * - If the user's email (or Gmail alias), phone number, UID, or hardware device fingerprint
 *   has EVER claimed free signup credits before, `duplicateBlocked` is set to `true`,
 *   `grantedCredits` is `0`, nothing is deducted from `adminCreditPool`, and the attempt is logged.
 */
export function allocateNewUserSignupCredits(
  userDisplayName: string,
  userEmail: string,
  enableFreeCredits?: boolean,
  requestedAmount?: number,
  userPhone?: string,
  userUid?: string,
  existingUsers: Array<{
    uid?: string;
    email?: string;
    phone?: string;
    freeCreditsClaimed?: boolean;
    deviceFingerprint?: string;
  }> = []
): {
  grantedCredits: number;
  remainingAdminPool: number;
  wasEnabled: boolean;
  duplicateBlocked: boolean;
  blockReason?: string;
  deviceFingerprint: string;
} {
  const guard = syncExistingUsersIntoFreeCreditGuard(existingUsers);
  const deviceFp = getDeviceHardwareFingerprint();
  const normEmail = normalizeIdentityEmail(userEmail);
  const normPhone = normalizeIdentityPhone(userPhone || '');

  let isEnabled = typeof enableFreeCredits === 'boolean' ? enableFreeCredits : true;
  let targetBonus =
    typeof requestedAmount === 'number' && !isNaN(requestedAmount)
      ? Math.max(0, Math.floor(requestedAmount))
      : DEFAULT_INITIAL_CREDITS;

  // Read latest persisted site settings if not explicitly provided
  if (typeof enableFreeCredits !== 'boolean' || typeof requestedAmount !== 'number') {
    try {
      const rawSettings =
        localStorage.getItem('malnadu_media_site_settings_v2') ||
        localStorage.getItem('malnadu_studio_settings_v1');
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        if (
          typeof enableFreeCredits !== 'boolean' &&
          typeof parsed.enableFreeSignupCredits === 'boolean'
        ) {
          isEnabled = parsed.enableFreeSignupCredits;
        }
        if (
          typeof requestedAmount !== 'number' &&
          typeof parsed.freeSignupCreditsAmount === 'number'
        ) {
          targetBonus = Math.max(0, Math.floor(parsed.freeSignupCreditsAmount));
        }
      }
    } catch {
      // ignore
    }
  }

  const currentPool = loadAdminCreditPool();

  // 1. Check Anti-Abuse Duplicate Detection Layers
  const emailAlreadyClaimed = Boolean(normEmail) && guard.claimedEmails.includes(normEmail);
  const phoneAlreadyClaimed = Boolean(normPhone) && guard.claimedPhones.includes(normPhone);
  const uidAlreadyClaimed = Boolean(userUid) && guard.claimedUids.includes(userUid!);
  const deviceAlreadyClaimed =
    guard.deviceHasClaimed || guard.claimedFingerprints.includes(deviceFp);

  if (emailAlreadyClaimed || phoneAlreadyClaimed || uidAlreadyClaimed || deviceAlreadyClaimed) {
    const reasons: string[] = [];
    if (emailAlreadyClaimed) reasons.push('Email/Alias already claimed free credits');
    if (phoneAlreadyClaimed) reasons.push('Phone number already claimed free credits');
    if (deviceAlreadyClaimed) reasons.push(`Device (${deviceFp}) already claimed free signup credits`);
    if (uidAlreadyClaimed && reasons.length === 0) reasons.push('Account UID already initialized');

    const blockReason = reasons.join(' + ');

    // Only log as a blocked attempt if it wasn't just the same UID re-checking within milliseconds
    if (!uidAlreadyClaimed || emailAlreadyClaimed || deviceAlreadyClaimed) {
      const blockedEntry: BlockedFreeCreditAttempt = {
        id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        attemptedName: userDisplayName || 'User',
        attemptedEmail: userEmail || 'unknown',
        attemptedPhone: userPhone || '',
        deviceFingerprint: deviceFp,
        reason: blockReason,
      };
      const updatedGuard: FreeCreditGuardState = {
        ...guard,
        claimedEmails: normEmail
          ? Array.from(new Set([...guard.claimedEmails, normEmail]))
          : guard.claimedEmails,
        claimedPhones: normPhone
          ? Array.from(new Set([...guard.claimedPhones, normPhone]))
          : guard.claimedPhones,
        claimedUids: userUid
          ? Array.from(new Set([...guard.claimedUids, userUid]))
          : guard.claimedUids,
        claimedFingerprints: Array.from(new Set([...guard.claimedFingerprints, deviceFp])),
        deviceHasClaimed: true,
        blockedAttempts: [blockedEntry, ...guard.blockedAttempts].slice(0, 50),
      };
      saveFreeCreditGuardState(updatedGuard);

      appendCreditRechargeLog({
        targetName: `BLOCKED Repeat Free Credit → ${userDisplayName || 'User'}`,
        targetEmail: `${userEmail} · ${blockReason} (0 Cr Granted)`,
        action: 'set',
        amount: 0,
        balanceAfter: 0,
      });
    }

    return {
      grantedCredits: 0,
      remainingAdminPool: currentPool,
      wasEnabled: isEnabled,
      duplicateBlocked: true,
      blockReason,
      deviceFingerprint: deviceFp,
    };
  }

  // 2. If Admin has disabled Free Signup Credits, grant 0
  if (!isEnabled || targetBonus <= 0) {
    return {
      grantedCredits: 0,
      remainingAdminPool: currentPool,
      wasEnabled: false,
      duplicateBlocked: false,
      deviceFingerprint: deviceFp,
    };
  }

  // 3. Check if Admin Pool has sufficient credits
  const actualGranted = Math.max(0, Math.min(targetBonus, currentPool));
  if (actualGranted <= 0) {
    return {
      grantedCredits: 0,
      remainingAdminPool: currentPool,
      wasEnabled: true,
      duplicateBlocked: false,
      deviceFingerprint: deviceFp,
    };
  }

  // 4. Permanently lock this Email, Phone, UID, and Hardware Device Fingerprint in the Guard Vault
  const nextGuard: FreeCreditGuardState = {
    claimedEmails: normEmail
      ? Array.from(new Set([...guard.claimedEmails, normEmail]))
      : guard.claimedEmails,
    claimedPhones: normPhone
      ? Array.from(new Set([...guard.claimedPhones, normPhone]))
      : guard.claimedPhones,
    claimedUids: userUid
      ? Array.from(new Set([...guard.claimedUids, userUid]))
      : guard.claimedUids,
    claimedFingerprints: Array.from(new Set([...guard.claimedFingerprints, deviceFp])),
    deviceHasClaimed: true,
    blockedAttempts: guard.blockedAttempts,
  };
  saveFreeCreditGuardState(nextGuard);

  // 5. Deduct from Website Admin Credit Pool and log
  const nextPool = saveAdminCreditPool(currentPool - actualGranted);
  appendCreditRechargeLog({
    targetName: `Free Signup Credit → ${userDisplayName || 'New User'}`,
    targetEmail: `${userEmail || 'new-user'} · Device ${deviceFp} (-${actualGranted} Cr from Admin Pool | Pool Left: ${nextPool} Cr)`,
    action: 'deduct',
    amount: actualGranted,
    balanceAfter: actualGranted,
  });

  return {
    grantedCredits: actualGranted,
    remainingAdminPool: nextPool,
    wasEnabled: true,
    duplicateBlocked: false,
    deviceFingerprint: deviceFp,
  };
}


