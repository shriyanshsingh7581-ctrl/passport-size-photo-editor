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
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseAppletConfig from '../firebase-applet-config.json';

export const firebaseConfig = firebaseAppletConfig;

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

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

    if (existingSnap.exists() && existingSnap.data()?.createdAt) {
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

/**
 * Syncs the Admin Credit Pool balance to Firestore `/siteSettings/global` via Admin Vault.
 */
export async function syncAdminPoolToFirestore(newPoolCredits: number): Promise<void> {
  const safePool = Math.max(0, Math.floor(Number(newPoolCredits) || 0));
  try {
    const adminDb = await ensureAdminVaultSession();
    const settingsRef = doc(adminDb, 'siteSettings', 'global');
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      await updateDoc(settingsRef, {
        adminCreditPool: safePool,
        updatedAt: serverTimestamp(),
      });
    }
  } catch {
    // ignore if offline
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
