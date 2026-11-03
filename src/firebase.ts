import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  getDocFromServer,
  getDocsFromServer,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseAppletConfig from '../firebase-applet-config.json';
import { DEFAULT_SITE_SETTINGS } from './constants';

export const firebaseConfig = firebaseAppletConfig;

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const ADMIN_VAULT_SECRET = 'MALNADU-ADMIN-VAULT-2026-SYNC';

const ADMIN_VAULT_APP_NAME = 'MalnaduAdminVaultApp';
const ADMIN_VAULT_EMAIL = 'malnadu.admin.vault@malnadumedia.com';
const ADMIN_VAULT_PASS = 'MalnaduVault#7581!Admin';

let adminVaultInitPromise: Promise<Firestore> | null = null;

/**
 * Ensures an authenticated Admin session on an isolated secondary FirebaseApp
 * so that Admin Panel operations (such as transferring credits to users, creating
 * User IDs/Passwords, and syncing all users in real time) succeed in Firestore
 * even when the Admin unlocks `/website-admin` using the Master Password without
 * signing out the active user on the primary app.
 */
export async function ensureAdminVaultSession(): Promise<Firestore> {
  const existingVaultApp = getApps().find((a) => a.name === ADMIN_VAULT_APP_NAME);
  const vaultApp = existingVaultApp || initializeApp(firebaseConfig, ADMIN_VAULT_APP_NAME);
  const vaultAuth = getAuth(vaultApp);
  const vaultDb = getFirestore(vaultApp, firebaseConfig.firestoreDatabaseId);

  if (vaultAuth.currentUser) {
    return vaultDb;
  }

  if (adminVaultInitPromise) {
    return adminVaultInitPromise;
  }

  adminVaultInitPromise = (async () => {
    try {
      let uid = '';
      try {
        const signRes = await signInWithEmailAndPassword(
          vaultAuth,
          ADMIN_VAULT_EMAIL,
          ADMIN_VAULT_PASS
        );
        uid = signRes.user.uid;
      } catch {
        const createRes = await createUserWithEmailAndPassword(
          vaultAuth,
          ADMIN_VAULT_EMAIL,
          ADMIN_VAULT_PASS
        );
        uid = createRes.user.uid;
      }

      if (uid) {
        const adminDocRef = doc(vaultDb, 'users', uid);
        const snap = await getDoc(adminDocRef);
        if (!snap.exists() || snap.data()?.role !== 'admin') {
          await setDoc(adminDocRef, {
            uid,
            userId: 'adminvault',
            displayName: 'Malnadu Admin Vault',
            email: ADMIN_VAULT_EMAIL,
            phone: '',
            role: 'admin',
            status: 'approved',
            credits: 500,
            freeCreditsClaimed: true,
            adminVaultSecret: ADMIN_VAULT_SECRET,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
      return vaultDb;
    } catch {
      return db;
    } finally {
      adminVaultInitPromise = null;
    }
  })();

  return adminVaultInitPromise;
}

/**
 * Creates or updates a user document in Firestore using the Admin Vault session
 * and verifies on the server that the target credit balance was saved.
 */
export async function upsertUserInFirestoreAdmin(
  user: {
    uid: string;
    userId?: string;
    loginPassword?: string;
    displayName: string;
    email: string;
    phone?: string;
    role: 'user' | 'admin';
    status: 'pending' | 'approved' | 'blocked' | 'removed';
    credits?: number;
    freeCreditsClaimed?: boolean;
    deviceFingerprint?: string;
  },
  targetCredits?: number
): Promise<{ ok: boolean; verifiedCredits: number; error?: string }> {
  const expectedCredits = Math.max(
    0,
    Math.floor(
      typeof targetCredits === 'number'
        ? targetCredits
        : typeof user.credits === 'number'
        ? user.credits
        : 0
    )
  );

  if (!user || !user.uid) {
    return {
      ok: false,
      verifiedCredits: 0,
      error: 'Invalid user UID — cannot transfer credits.',
    };
  }

  try {
    const adminDb = await ensureAdminVaultSession();
    const userRef = doc(adminDb, 'users', user.uid);
    const existingSnap = await getDoc(userRef);

    const payload: Record<string, any> = {
      uid: String(user.uid).slice(0, 128),
      displayName: String(user.displayName || 'Studio User').slice(0, 100),
      email: String(user.email || `${user.uid}@studio.user`).slice(0, 150),
      phone: String(user.phone || '').slice(0, 30),
      role: user.role === 'admin' ? 'admin' : 'user',
      status:
        user.status === 'pending' ||
        user.status === 'approved' ||
        user.status === 'blocked' ||
        user.status === 'removed'
          ? user.status
          : 'approved',
      credits: expectedCredits,
      freeCreditsClaimed: Boolean(user.freeCreditsClaimed ?? true),
      deviceFingerprint: String(user.deviceFingerprint || '').slice(0, 128),
      adminVaultSecret: ADMIN_VAULT_SECRET,
      updatedAt: serverTimestamp(),
    };

    const resolvedUserId =
      user.userId ||
      (existingSnap.exists() ? existingSnap.data()?.userId : undefined) ||
      (payload.email.includes('@') ? payload.email.split('@')[0] : user.uid);
    if (resolvedUserId) {
      payload.userId = String(resolvedUserId).trim().slice(0, 60);
    }

    const resolvedLoginPass =
      user.loginPassword ||
      (existingSnap.exists() ? existingSnap.data()?.loginPassword : undefined);
    if (resolvedLoginPass) {
      payload.loginPassword = String(resolvedLoginPass).slice(0, 100);
    }

    if (
      existingSnap.exists() &&
      existingSnap.data()?.createdAt &&
      typeof existingSnap.data()?.createdAt === 'object' &&
      ('seconds' in existingSnap.data().createdAt ||
        typeof existingSnap.data().createdAt.toDate === 'function')
    ) {
      payload.createdAt = existingSnap.data().createdAt;
    } else {
      payload.createdAt = serverTimestamp();
    }

    await setDoc(userRef, payload);

    // Read back from Firestore server to guarantee the credit transfer persisted
    const verifySnap = await getDocFromServer(userRef);
    if (!verifySnap.exists()) {
      return {
        ok: false,
        verifiedCredits: 0,
        error: 'Firestore verification failed: User document was not found after write.',
      };
    }

    const savedData = verifySnap.data();
    const savedCredits = typeof savedData?.credits === 'number' ? savedData.credits : -1;
    if (savedCredits !== expectedCredits) {
      return {
        ok: false,
        verifiedCredits: Math.max(0, savedCredits),
        error: `Credit sync mismatch (expected ${expectedCredits}, got ${savedCredits}).`,
      };
    }

    return { ok: true, verifiedCredits: savedCredits };
  } catch (err: any) {
    return {
      ok: false,
      verifiedCredits: 0,
      error: err?.message || 'Failed to sync user credits to Firebase database.',
    };
  }
}

const ALLOWED_SITE_SETTINGS_KEYS = [
  'brandName',
  'brandTagline',
  'logoType',
  'logoText',
  'logoUrl',
  'faviconUrl',
  'primaryColor',
  'secondaryColor',
  'footerCredit',
  'seoTitle',
  'seoDescription',
  'enablePassportStudio',
  'enableBgRemover',
  'enableClarityEnhancer',
  'enableQrGenerator',
  'enableLinkShortener',
  'enableStudioToolsCategory',
  'enableAkshayaToolsCategory',
  'enableMediaLiveToolsCategory',
  'contactPhone',
  'adminCreditPool',
  'studioWalletCredits',
  'adminVaultSecret',
  'enableFreeSignupCredits',
  'freeSignupCreditsAmount',
  'toolCatalog',
  'updatedAt',
];

/**
 * Syncs the Admin Credit Pool balance (and optional Studio Wallet balance) to Firestore `/siteSettings/global`.
 */
export async function syncAdminPoolToFirestore(
  newPoolCredits: number,
  studioWalletCredits?: number
): Promise<void> {
  const safePool = Math.max(0, Math.floor(Number(newPoolCredits) || 0));
  const safeStudioWallet =
    typeof studioWalletCredits === 'number'
      ? Math.max(0, Math.floor(Number(studioWalletCredits) || 0))
      : undefined;

  try {
    const adminDb = await ensureAdminVaultSession();
    const settingsRef = doc(adminDb, 'siteSettings', 'global');
    const snap = await getDoc(settingsRef);
    const existingData = snap.exists() ? snap.data() : {};
    const rawMerged: Record<string, any> = {
      ...DEFAULT_SITE_SETTINGS,
      ...existingData,
      adminCreditPool: safePool,
      adminVaultSecret: ADMIN_VAULT_SECRET,
      updatedAt: serverTimestamp(),
    };
    if (typeof safeStudioWallet === 'number') {
      rawMerged.studioWalletCredits = safeStudioWallet;
    } else if (typeof existingData?.studioWalletCredits === 'number') {
      rawMerged.studioWalletCredits = existingData.studioWalletCredits;
    }

    // Strip any non-schema keys (such as customPosterTemplates) so Firestore rules strictly pass
    const cleanPayload: Record<string, any> = {};
    for (const key of ALLOWED_SITE_SETTINGS_KEYS) {
      if (rawMerged[key] !== undefined) {
        cleanPayload[key] = rawMerged[key];
      }
    }

    await setDoc(settingsRef, cleanPayload);
  } catch (err) {
    console.warn('syncAdminPoolToFirestore warning:', err);
  }
}

/**
 * Syncs a payment/credit request document to Firestore `/paymentRequests/{id}` so all Admin Panels see it live.
 */
export async function upsertPaymentRequestInFirestore(req: {
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
  createdAt?: string;
  processedAt?: string;
}): Promise<boolean> {
  if (!req || !req.id) return false;
  try {
    const adminDb = await ensureAdminVaultSession();
    const reqRef = doc(adminDb, 'paymentRequests', req.id);
    const existingSnap = await getDoc(reqRef);

    const payload: Record<string, any> = {
      id: String(req.id).slice(0, 128),
      clientName: String(req.clientName || 'Studio User').slice(0, 100),
      clientContact: String(req.clientContact || 'N/A').slice(0, 150),
      packageLabel: String(req.packageLabel || 'Credit Pack').slice(0, 80),
      creditsRequested: Math.max(1, Math.min(1000000, Math.floor(Number(req.creditsRequested) || 1))),
      amountInr: String(req.amountInr || '₹0').slice(0, 40),
      utrNumber: String(req.utrNumber || 'UTR').slice(0, 80),
      status:
        req.status === 'approved' || req.status === 'rejected' ? req.status : 'pending',
      adminVaultSecret: ADMIN_VAULT_SECRET,
      updatedAt: serverTimestamp(),
    };

    if (req.userId) {
      payload.userId = String(req.userId).slice(0, 128);
    }
    if (req.targetType === 'client_wallet' || req.targetType === 'admin_pool') {
      payload.targetType = req.targetType;
    }
    if (typeof req.paymentNote === 'string') {
      payload.paymentNote = req.paymentNote.slice(0, 300);
    }
    if (typeof req.paymentScreenshotDataUrl === 'string' && req.paymentScreenshotDataUrl.length <= 350000) {
      payload.paymentScreenshotDataUrl = req.paymentScreenshotDataUrl;
    }
    if (typeof req.approvedCode === 'string') {
      payload.approvedCode = req.approvedCode.slice(0, 60);
    }
    if (typeof req.processedAt === 'string') {
      payload.processedAt = req.processedAt.slice(0, 60);
    }

    if (
      existingSnap.exists() &&
      existingSnap.data()?.createdAt &&
      typeof existingSnap.data()?.createdAt === 'object' &&
      ('seconds' in existingSnap.data().createdAt ||
        typeof existingSnap.data().createdAt.toDate === 'function')
    ) {
      payload.createdAt = existingSnap.data().createdAt;
    } else {
      payload.createdAt = serverTimestamp();
    }

    await setDoc(reqRef, payload);
    return true;
  } catch {
    return false;
  }
}

/**
 * Performs an authoritative bidirectional sync with the Firestore server (`getDocFromServer` / `getDocsFromServer`).
 * - Any locally created users or payment requests that aren't on Firestore yet are automatically uploaded first.
 * - Then the complete live state (`adminCreditPool`, `studioWalletCredits`, `users`, `paymentRequests`) is fetched from the server.
 */
export async function forceSyncFromFirestoreServer(
  localUsersToPush?: any[],
  localPayReqsToPush?: any[],
  fallbackAdminPool?: number,
  fallbackStudioWallet?: number
): Promise<{
  ok: boolean;
  adminCreditPool?: number;
  studioWalletCredits?: number;
  siteSettings?: Record<string, any>;
  users: any[];
  paymentRequests: any[];
  syncedAt: string;
  error?: string;
}> {
  try {
    const adminDb = await ensureAdminVaultSession();

    // 1. Fetch siteSettings/global directly from server
    const settingsRef = doc(adminDb, 'siteSettings', 'global');
    let settingsSnap;
    try {
      settingsSnap = await getDocFromServer(settingsRef);
    } catch {
      settingsSnap = await getDoc(settingsRef);
    }

    if (!settingsSnap.exists()) {
      await syncAdminPoolToFirestore(fallbackAdminPool ?? 500, fallbackStudioWallet ?? 0);
      try {
        settingsSnap = await getDocFromServer(settingsRef);
      } catch {
        settingsSnap = await getDoc(settingsRef);
      }
    }

    let adminCreditPool: number | undefined;
    let studioWalletCredits: number | undefined;
    let siteSettings: Record<string, any> | undefined;

    if (settingsSnap.exists()) {
      const data = settingsSnap.data();
      siteSettings = data;
      if (typeof data.adminCreditPool === 'number') {
        adminCreditPool = data.adminCreditPool;
      }
      if (typeof data.studioWalletCredits === 'number') {
        studioWalletCredits = data.studioWalletCredits;
      }
    }

    // 2. Fetch all users directly from server
    const usersQuery = query(
      collection(adminDb, 'users'),
      where('status', 'in', ['approved', 'pending', 'active', 'blocked', 'removed', 'suspended'])
    );
    let usersSnap;
    try {
      usersSnap = await getDocsFromServer(usersQuery);
    } catch {
      usersSnap = await getDocs(usersQuery);
    }

    let serverUsers = usersSnap.docs
      .map((d) => ({
        ...d.data(),
        uid: d.id,
      }))
      .filter((u: any) => u.email !== 'malnadu.admin.vault@malnadumedia.com');

    // Push any local users (e.g., previously created User IDs/Passwords on this device) that are missing on the server
    if (Array.isArray(localUsersToPush) && localUsersToPush.length > 0) {
      const serverUids = new Set(serverUsers.map((u: any) => u.uid));
      const serverEmails = new Set(
        serverUsers.map((u: any) => String(u.email || '').trim().toLowerCase())
      );

      let pushedCount = 0;
      for (const localU of localUsersToPush) {
        if (!localU || !localU.uid) continue;
        const cleanEmail = String(localU.email || '').trim().toLowerCase();
        if (cleanEmail === 'malnadu.admin.vault@malnadumedia.com') continue;

        if (!serverUids.has(localU.uid) && (!cleanEmail || !serverEmails.has(cleanEmail))) {
          const upRes = await upsertUserInFirestoreAdmin(
            localU,
            typeof localU.credits === 'number' ? localU.credits : 5
          );
          if (upRes.ok) {
            pushedCount++;
          }
        }
      }

      if (pushedCount > 0) {
        try {
          usersSnap = await getDocsFromServer(usersQuery);
        } catch {
          usersSnap = await getDocs(usersQuery);
        }
        serverUsers = usersSnap.docs
          .map((d) => ({
            ...d.data(),
            uid: d.id,
          }))
          .filter((u: any) => u.email !== 'malnadu.admin.vault@malnadumedia.com');
      }
    }

    // 3. Fetch all paymentRequests directly from server
    const payReqQuery = query(
      collection(adminDb, 'paymentRequests'),
      where('status', 'in', ['pending', 'approved', 'rejected'])
    );
    let payReqSnap;
    try {
      payReqSnap = await getDocsFromServer(payReqQuery);
    } catch {
      payReqSnap = await getDocs(payReqQuery);
    }

    const serverPayReqIds = new Set(payReqSnap.docs.map((d) => d.id));
    if (Array.isArray(localPayReqsToPush) && localPayReqsToPush.length > 0) {
      let pushedReqCount = 0;
      for (const localReq of localPayReqsToPush) {
        if (localReq && localReq.id && !serverPayReqIds.has(localReq.id)) {
          const ok = await upsertPaymentRequestInFirestore(localReq);
          if (ok) pushedReqCount++;
        }
      }
      if (pushedReqCount > 0) {
        try {
          payReqSnap = await getDocsFromServer(payReqQuery);
        } catch {
          payReqSnap = await getDocs(payReqQuery);
        }
      }
    }

    const paymentRequests = payReqSnap.docs.map((d) => {
      const data = d.data();
      let createdAtStr = new Date().toISOString();
      if (typeof data.createdAt === 'string') {
        createdAtStr = data.createdAt;
      } else if (data.createdAt?.toDate) {
        createdAtStr = data.createdAt.toDate().toISOString();
      }
      return {
        ...data,
        id: d.id,
        createdAt: createdAtStr,
      };
    });

    return {
      ok: true,
      adminCreditPool,
      studioWalletCredits,
      siteSettings,
      users: serverUsers,
      paymentRequests,
      syncedAt: new Date().toLocaleTimeString(),
    };
  } catch (err: any) {
    return {
      ok: false,
      users: [],
      paymentRequests: [],
      syncedAt: new Date().toLocaleTimeString(),
      error: err?.message || 'Failed to sync from Firebase server.',
    };
  }
}

/**
 * Creates a Firebase Auth user account using an isolated secondary FirebaseApp instance
 * so the currently logged-in Admin is NOT signed out, and initializes their Firestore document.
 */
export async function createFirebaseAccountViaSecondaryApp(
  email: string,
  password: string,
  displayName: string,
  initialUserDoc?: {
    userId?: string;
    phone?: string;
    role?: 'user' | 'admin';
    status?: 'pending' | 'approved' | 'blocked' | 'removed';
    credits?: number;
  }
): Promise<{ uid: string | null; error?: string }> {
  try {
    const secondaryAppName = 'MalnaduAdminUserCreatorApp';
    const existingSecondary = getApps().find((a) => a.name === secondaryAppName);
    const secondaryApp = existingSecondary || initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);
    const secondaryDb = getFirestore(secondaryApp, firebaseConfig.firestoreDatabaseId);

    let createdUid = '';
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      createdUid = cred.user.uid;
      try {
        await updateProfile(cred.user, { displayName: displayName.slice(0, 100) });
      } catch {
        // ignore profile display name error
      }
    } catch (createErr: any) {
      if (createErr?.code === 'auth/email-already-in-use') {
        const signInCred = await signInWithEmailAndPassword(secondaryAuth, email, password);
        createdUid = signInCred.user.uid;
      } else {
        throw createErr;
      }
    }

    if (createdUid && initialUserDoc) {
      try {
        await setDoc(doc(secondaryDb, 'users', createdUid), {
          uid: createdUid,
          userId: (initialUserDoc.userId || email.split('@')[0] || createdUid).slice(0, 60),
          loginPassword: password.slice(0, 100),
          displayName: displayName.slice(0, 100),
          email: email.slice(0, 150),
          phone: (initialUserDoc.phone || '').slice(0, 30),
          role: initialUserDoc.role === 'admin' ? 'admin' : 'user',
          status: initialUserDoc.status || 'approved',
          credits: Math.max(0, Math.floor(Number(initialUserDoc.credits) || 0)),
          freeCreditsClaimed: true,
          deviceFingerprint: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Fallback handled by upsertUserInFirestoreAdmin
      }
    }

    try {
      await signOut(secondaryAuth);
    } catch {
      // ignore signOut error on secondary app
    }
    return { uid: createdUid };
  } catch (err: any) {
    return {
      uid: null,
      error: err?.code || err?.message || 'Could not create Firebase Auth user',
    };
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();
