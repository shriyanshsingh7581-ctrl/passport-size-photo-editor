import React, { useState, useEffect, useRef } from 'react';
import {
  UserProfile,
  AccountStatus,
  SiteSettings,
  ShortLinkRecord,
  AppointmentRecord,
  DocumentVerificationRecord,
  DEFAULT_SITE_SETTINGS,
  DEFAULT_TOOL_CATALOG,
  ToolCatalogItem,
  ToolCategoryId,
  CustomPosterTemplate,
  loadCustomPosterTemplates,
  saveCustomPosterTemplates,
} from '../constants';
import {
  ADMIN_ACCOUNT_HOLDER,
  ADMIN_QR_IMAGE_PATH,
  ADMIN_UPI_ID,
  DEFAULT_ADMIN_WHATSAPP,
  WEBSITE_USER_PAYEE_NAME,
  loadWebsiteUserQrImage,
  saveWebsiteUserQrImage,
  verifyAdminSecretPin,
  saveWalletCredits,
  saveAdminCreditPool,
  redeemAdminPoolRechargeCode,
  submitClientPaymentRequest,
  loadPaymentCreditRequests,
  approveUserPaymentFromAdminPool,
  rejectUserPaymentByWebsiteAdmin,
  PaymentCreditRequest,
  updateAdminMasterPassword,
  loadCreditRechargeLogs,
  appendCreditRechargeLog,
  CreditRechargeLog,
  loadFreeCreditGuardState,
  FreeCreditGuardState,
} from '../creditWallet';

export type AdminTab =
  | 'credits'
  | 'users'
  | 'templates'
  | 'tools'
  | 'branding'
  | 'links'
  | 'operations';

interface AdminPanelProps {
  currentUserProfile: UserProfile | null;
  users: UserProfile[];
  siteSettings: SiteSettings;
  shortLinks: ShortLinkRecord[];
  appointments: AppointmentRecord[];
  verifications: DocumentVerificationRecord[];
  availableCredits: number;
  adminCreditPool: number;
  initialAdminTab?: AdminTab;
  isCloudSyncing?: boolean;
  lastCloudSyncedAt?: string;
  onForceCloudSync?: () => Promise<void> | void;
  onUpdateWalletCredits: (newCredits: number) => void;
  onUpdateAdminCreditPool: (newPoolCredits: number) => void;
  onUpdateUserCredits: (
    uid: string,
    newCredits: number
  ) => Promise<{ ok: boolean; verifiedCredits?: number; error?: string } | void>;
  onUpdateUserStatus: (uid: string, status: AccountStatus) => Promise<void>;
  onUpdateUserRole: (uid: string, role: 'user' | 'admin') => Promise<void>;
  onDeleteUserRecord: (uid: string) => Promise<void>;
  onCreateManagedUser: (
    displayName: string,
    email: string,
    phone: string,
    role: 'user' | 'admin',
    status: AccountStatus,
    initialCredits?: number,
    userId?: string,
    loginPassword?: string
  ) => Promise<{ ok: boolean; uid: string; verifiedCredits: number; error?: string } | void>;
  onUpdateUserCredentials?: (
    uid: string,
    userId: string,
    loginPassword: string
  ) => Promise<void>;
  onSaveSiteSettings: (newSettings: SiteSettings) => Promise<void>;
  onToggleShortLinkStatus: (slug: string, currentActive: boolean) => Promise<void>;
  onDeleteShortLink: (slug: string) => Promise<void>;
  onUpdateAppointmentStatus: (
    id: string,
    status: AppointmentRecord['status'],
    notes: string
  ) => Promise<void>;
  onUpdateVerificationStatus: (
    id: string,
    status: DocumentVerificationRecord['status'],
    remarks: string
  ) => Promise<void>;
  onNavigateToStudio: () => void;
  showToast: (msg: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUserProfile,
  users,
  siteSettings,
  shortLinks,
  appointments,
  verifications,
  availableCredits,
  adminCreditPool,
  initialAdminTab,
  isCloudSyncing = false,
  lastCloudSyncedAt = 'Live',
  onForceCloudSync,
  onUpdateWalletCredits,
  onUpdateAdminCreditPool,
  onUpdateUserCredits,
  onUpdateUserStatus,
  onUpdateUserRole,
  onDeleteUserRecord,
  onCreateManagedUser,
  onUpdateUserCredentials,
  onSaveSiteSettings,
  onToggleShortLinkStatus,
  onDeleteShortLink,
  onUpdateAppointmentStatus,
  onUpdateVerificationStatus,
  onNavigateToStudio,
  showToast,
}) => {
  const [adminTab, setAdminTab] = useState<AdminTab>(initialAdminTab || 'users');

  useEffect(() => {
    if (initialAdminTab) {
      setAdminTab(initialAdminTab);
    }
  }, [initialAdminTab]);

  // Dedicated Credit Admin Vault Lock & Password State
  const [isCreditVaultUnlocked, setIsCreditVaultUnlocked] = useState(false);
  const [vaultPasswordInput, setVaultPasswordInput] = useState('');
  const [showVaultPassword, setShowVaultPassword] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [unlockedPasswordCache, setUnlockedPasswordCache] = useState('');
  const [customCreditAddInput, setCustomCreditAddInput] = useState('100');
  const [exactCreditSetInput, setExactCreditSetInput] = useState(String(availableCredits));
  const [freeCreditGuard, setFreeCreditGuard] = useState<FreeCreditGuardState>(() =>
    loadFreeCreditGuardState()
  );

  useEffect(() => {
    const syncGuard = () => setFreeCreditGuard(loadFreeCreditGuardState());
    window.addEventListener('malnadu-free-credit-guard-updated', syncGuard);
    return () => window.removeEventListener('malnadu-free-credit-guard-updated', syncGuard);
  }, []);
  const [creditLogs, setCreditLogs] = useState<CreditRechargeLog[]>(() => loadCreditRechargeLogs());
  const [userCustomCreditInputs, setUserCustomCreditInputs] = useState<Record<string, string>>({});
  const [poolActionNotice, setPoolActionNotice] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Simple 1-Click Credit Transfer & Pool Top-Up Box State
  const [quickTargetUid, setQuickTargetUid] = useState<string>('');
  const [quickCreditAmount, setQuickCreditAmount] = useState<string>('50');
  const [quickAdminTopUpAmount, setQuickAdminTopUpAmount] = useState<string>('500');
  const [isTransferringCredits, setIsTransferringCredits] = useState(false);

  useEffect(() => {
    if (users.length > 0 && (!quickTargetUid || !users.some((u) => u.uid === quickTargetUid))) {
      setQuickTargetUid(users[0].uid);
    }
  }, [users, quickTargetUid]);

  // Redeem Owner Code / Request Admin Pool Top-Up State
  const [adminPoolCouponInput, setAdminPoolCouponInput] = useState('');
  const [showAdminPoolQrModal, setShowAdminPoolQrModal] = useState(true);
  const [poolReqAmount, setPoolReqAmount] = useState<number>(1000);
  const [poolReqUtr, setPoolReqUtr] = useState('');
  const [poolReqNote, setPoolReqNote] = useState('');

  // Website User QR Payment Requests Queue (Users who paid on T TT QR code)
  const [userPaymentRequests, setUserPaymentRequests] = useState<PaymentCreditRequest[]>(() =>
    loadPaymentCreditRequests()
  );
  const [reqGrantInputs, setReqGrantInputs] = useState<Record<string, string>>({});
  const [websiteUserQrUrl, setWebsiteUserQrUrl] = useState<string>(() => loadWebsiteUserQrImage());
  const userQrUploadInputRef = useRef<HTMLInputElement | null>(null);

  // Change Master Password Form State
  const [showChangePassForm, setShowChangePassForm] = useState(false);
  const [currentPassForChange, setCurrentPassForChange] = useState('');
  const [newStrongPassword, setNewStrongPassword] = useState('');
  const [changePassMsg, setChangePassMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  useEffect(() => {
    setExactCreditSetInput(String(availableCredits));
  }, [availableCredits]);

  useEffect(() => {
    const syncPayReqs = () => {
      setUserPaymentRequests(loadPaymentCreditRequests());
    };
    const syncUserQr = () => {
      setWebsiteUserQrUrl(loadWebsiteUserQrImage());
    };
    window.addEventListener('malnadu-payment-requests-updated', syncPayReqs);
    window.addEventListener('malnadu-user-qr-updated', syncUserQr);
    window.addEventListener('storage', syncPayReqs);
    window.addEventListener('storage', syncUserQr);
    return () => {
      window.removeEventListener('malnadu-payment-requests-updated', syncPayReqs);
      window.removeEventListener('malnadu-user-qr-updated', syncUserQr);
      window.removeEventListener('storage', syncPayReqs);
      window.removeEventListener('storage', syncUserQr);
    };
  }, []);

  const handleUploadCustomUserQr = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        saveWebsiteUserQrImage(dataUrl);
        setWebsiteUserQrUrl(dataUrl);
        showToast('Updated Website User Payment QR Code!');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  /**
   * Website Admin approves a Website User's QR Payment Request strictly by deducting
   * the credits from `adminCreditPool` and adding them to that user's account.
   */
  const handleApproveUserQrPayment = async (req: PaymentCreditRequest) => {
    setPoolActionNotice(null);
    const customAmtStr = reqGrantInputs[req.id];
    const creditsToGive =
      customAmtStr !== undefined && customAmtStr.trim() !== ''
        ? Math.max(1, parseInt(customAmtStr, 10) || req.creditsRequested)
        : req.creditsRequested;

    const previousPool = adminCreditPool;
    const res = approveUserPaymentFromAdminPool(req.id, creditsToGive);
    if (!res.ok) {
      setPoolActionNotice({
        type: 'err',
        text:
          res.error ||
          'Insufficient Admin Pool Credits! Please add more credits to your Admin Pool.',
      });
      setShowAdminPoolQrModal(true);
      showToast(`Insufficient Admin Pool (${adminCreditPool} left)!`);
      return;
    }

    // Find matching user account by userId, email, or name and add the approved credits
    const matchedUser = users.find(
      (u) =>
        (req.userId && u.uid === req.userId) ||
        (req.userId && u.userId && u.userId.toLowerCase() === req.userId.toLowerCase()) ||
        (req.clientContact &&
          (u.email.toLowerCase() === req.clientContact.toLowerCase() ||
            (u.phone && u.phone === req.clientContact))) ||
        u.displayName.toLowerCase() === req.clientName.toLowerCase()
    );

    if (matchedUser) {
      const currentUserCredits = typeof matchedUser.credits === 'number' ? matchedUser.credits : 0;
      const nextUserCredits = currentUserCredits + res.creditsGiven;
      const syncRes = await onUpdateUserCredits(matchedUser.uid, nextUserCredits);

      if (syncRes && syncRes.ok === false) {
        // Automatic Rollback: return deducted credits back to Admin Pool
        const refundedPool = saveAdminCreditPool(previousPool);
        onUpdateAdminCreditPool(refundedPool);
        appendCreditRechargeLog({
          targetName: `AUTO-REFUND TO ADMIN POOL (${matchedUser.displayName})`,
          targetEmail: `Transfer failed · Returned +${res.creditsGiven} to Pool (${refundedPool})`,
          action: 'add',
          amount: res.creditsGiven,
          balanceAfter: refundedPool,
        });
        setCreditLogs(loadCreditRechargeLogs());
        setPoolActionNotice({
          type: 'err',
          text: `Credit Transfer Failed for ${matchedUser.displayName}! Deducted ${res.creditsGiven} Credits were AUTOMATICALLY RETURNED back to your Admin Pool (${refundedPool} Credits).`,
        });
        showToast(
          `Transfer Failed! +${res.creditsGiven} Credits Returned to Admin Pool (${refundedPool})`
        );
        return;
      }

      onUpdateAdminCreditPool(res.remainingAdminPool);
      setUserPaymentRequests(loadPaymentCreditRequests());
      setCreditLogs(loadCreditRechargeLogs());
      const finalCredits =
        typeof syncRes?.verifiedCredits === 'number' ? syncRes.verifiedCredits : nextUserCredits;
      setPoolActionNotice({
        type: 'ok',
        text: `Approved Payment (#${req.id.slice(-5).toUpperCase()})! Transferred & Verified +${res.creditsGiven} Credits to ${matchedUser.displayName}'s account (${finalCredits} total in Firebase). Remaining Admin Pool: ${res.remainingAdminPool} Credits.`,
      });
      showToast(
        `Added +${res.creditsGiven} Credits to ${matchedUser.displayName} (Pool Left: ${res.remainingAdminPool})`
      );
    } else {
      onUpdateAdminCreditPool(res.remainingAdminPool);
      setUserPaymentRequests(loadPaymentCreditRequests());
      setCreditLogs(loadCreditRechargeLogs());
      const nextWallet = saveWalletCredits(availableCredits + res.creditsGiven);
      onUpdateWalletCredits(nextWallet);
      setPoolActionNotice({
        type: 'ok',
        text: `Approved Payment (#${req.id.slice(-5).toUpperCase()}) for ${req.clientName}! Added +${res.creditsGiven} Credits from Admin Pool (Remaining Pool: ${res.remainingAdminPool} Credits).`,
      });
      showToast(
        `Approved +${res.creditsGiven} Credits for ${req.clientName} (Pool Left: ${res.remainingAdminPool})`
      );
    }
  };

  const handleRejectUserQrPayment = (reqId: string) => {
    rejectUserPaymentByWebsiteAdmin(reqId);
    setUserPaymentRequests(loadPaymentCreditRequests());
    showToast('Rejected user payment request.');
  };

  const handleUnlockCreditVault = (e: React.FormEvent) => {
    e.preventDefault();
    setVaultError(null);
    if (!verifyAdminSecretPin(vaultPasswordInput)) {
      setVaultError(
        'Incorrect Admin Master Password! Only the authorized Administrator can unlock the Website Admin Panel.'
      );
      return;
    }
    setUnlockedPasswordCache(vaultPasswordInput.trim());
    setIsCreditVaultUnlocked(true);
    setVaultPasswordInput('');
    setCreditLogs(loadCreditRechargeLogs());
    if (onForceCloudSync) {
      onForceCloudSync();
    }
    showToast('Website Admin Panel Unlocked & Synced with Realtime Database!');
  };

  const handleLockCreditVault = () => {
    setIsCreditVaultUnlocked(false);
    setUnlockedPasswordCache('');
    setVaultPasswordInput('');
    setVaultError(null);
    showToast('Website Admin Panel Locked');
  };

  /**
   * Transfers credits from the Website Admin's Distributable Credit Pool to the Local Studio Wallet.
   */
  const handleStudioWalletAddCredits = (amount: number) => {
    if (!isCreditVaultUnlocked) return;
    setPoolActionNotice(null);
    const addAmt = Math.max(1, Math.floor(amount));
    if (addAmt > adminCreditPool) {
      const msg = `Insufficient Website Admin Credit Pool! You only have ${adminCreditPool} credits available, but tried to allocate ${addAmt} credits. Please get more credits from the Owner.`;
      setPoolActionNotice({ type: 'err', text: msg });
      showToast(`Insufficient Admin Pool (${adminCreditPool} Credits left)`);
      return;
    }

    const nextPool = saveAdminCreditPool(adminCreditPool - addAmt);
    const nextWallet = saveWalletCredits(availableCredits + addAmt);
    onUpdateAdminCreditPool(nextPool);
    onUpdateWalletCredits(nextWallet);

    const updatedLogs = appendCreditRechargeLog({
      targetName: 'Studio Wallet (From Admin Pool)',
      targetEmail: `Admin Pool Remaining: ${nextPool}`,
      action: 'add',
      amount: addAmt,
      balanceAfter: nextWallet,
    });
    setCreditLogs(updatedLogs);
    setPoolActionNotice({
      type: 'ok',
      text: `Transferred +${addAmt} Credits from Website Admin Pool to Studio Wallet! Remaining Admin Pool: ${nextPool} Photos.`,
    });
    showToast(`Allocated +${addAmt} Credits! (Admin Pool Left: ${nextPool})`);
  };

  const handleStudioWalletSetExact = (exactAmount: number) => {
    if (!isCreditVaultUnlocked) return;
    setPoolActionNotice(null);
    const target = Math.max(0, Math.floor(exactAmount));
    const delta = target - availableCredits;
    if (delta === 0) return;

    if (delta > 0 && delta > adminCreditPool) {
      const msg = `Insufficient Website Admin Credit Pool! Adding +${delta} credits requires ${delta} credits in your Admin Pool (Available: ${adminCreditPool}).`;
      setPoolActionNotice({ type: 'err', text: msg });
      showToast(`Insufficient Admin Pool (${adminCreditPool} Credits left)`);
      return;
    }

    const nextPool = saveAdminCreditPool(adminCreditPool - delta);
    const nextWallet = saveWalletCredits(target);
    onUpdateAdminCreditPool(nextPool);
    onUpdateWalletCredits(nextWallet);

    const updatedLogs = appendCreditRechargeLog({
      targetName: 'Studio Wallet (Pool Adjusted)',
      targetEmail: `Admin Pool Remaining: ${nextPool}`,
      action: 'set',
      amount: target,
      balanceAfter: nextWallet,
    });
    setCreditLogs(updatedLogs);
    setPoolActionNotice({
      type: 'ok',
      text:
        delta > 0
          ? `Allocated +${delta} Credits from Admin Pool to Studio Wallet. Remaining Pool: ${nextPool} Photos.`
          : `Reclaimed ${Math.abs(delta)} Credits back into Website Admin Pool. New Pool: ${nextPool} Photos.`,
    });
    showToast(`Studio Balance Set to ${nextWallet} (Admin Pool: ${nextPool})`);
  };

  /**
   * Direct 1-Click Top-Up for Admin Credit Pool so Admin can easily add credits to the pool anytime.
   */
  const handleQuickTopUpAdminPool = (addAmount: number) => {
    if (!isCreditVaultUnlocked) return;
    const safeAdd = Math.max(1, Math.floor(Number(addAmount) || 0));
    const nextPool = saveAdminCreditPool(adminCreditPool + safeAdd);
    onUpdateAdminCreditPool(nextPool);
    const updatedLogs = appendCreditRechargeLog({
      targetName: 'Admin Credit Pool (Direct Top-Up)',
      targetEmail: `Pool Increased by +${safeAdd} · New Pool: ${nextPool}`,
      action: 'add',
      amount: safeAdd,
      balanceAfter: nextPool,
    });
    setCreditLogs(updatedLogs);
    setPoolActionNotice({
      type: 'ok',
      text: `Added +${safeAdd} Credits directly to your Admin Credit Pool! New Distributable Pool Balance: ${nextPool} Credits.`,
    });
    showToast(`+${safeAdd} Credits Added to Admin Pool (Total: ${nextPool})`);
  };

  /**
   * Distributes credits to a Registered User strictly from the Website Admin's Credit Pool,
   * verifies the write in Firebase Realtime/Firestore Database, and AUTOMATICALLY REFUNDS
   * the Admin Pool if the transfer to the user fails for any reason.
   */
  const handleAdjustUserCredits = async (
    user: UserProfile,
    mode: 'add' | 'set' | 'deduct',
    amount: number
  ) => {
    if (!isCreditVaultUnlocked) {
      setAdminTab('credits');
      showToast('Please unlock the Website Admin Panel with your Master Password first.');
      return;
    }
    setPoolActionNotice(null);

    if (!user || !user.uid) {
      setPoolActionNotice({
        type: 'err',
        text: 'Invalid user selected! No credits were deducted from your Admin Pool.',
      });
      return;
    }

    const currentUserCredits = typeof user.credits === 'number' ? user.credits : 0;
    let nextUserCredits = currentUserCredits;
    if (mode === 'add') {
      nextUserCredits = currentUserCredits + Math.max(1, Math.floor(amount));
    } else if (mode === 'deduct') {
      nextUserCredits = Math.max(0, currentUserCredits - Math.max(1, Math.floor(amount)));
    } else {
      nextUserCredits = Math.max(0, Math.floor(amount));
    }

    const deltaNeeded = nextUserCredits - currentUserCredits;
    if (deltaNeeded === 0) return;

    if (deltaNeeded > 0 && deltaNeeded > adminCreditPool) {
      const msg = `Insufficient Website Admin Credit Pool! Giving +${deltaNeeded} credits to ${user.displayName} requires ${deltaNeeded} credits, but your Admin Pool only has ${adminCreditPool} credits left. Click "+ Add Pool Credits" above to top up.`;
      setPoolActionNotice({ type: 'err', text: msg });
      showToast(`Insufficient Admin Pool! Only ${adminCreditPool} Credits available.`);
      return;
    }

    const previousPool = adminCreditPool;
    const tentativePool = saveAdminCreditPool(previousPool - deltaNeeded);
    onUpdateAdminCreditPool(tentativePool);
    setIsTransferringCredits(true);

    try {
      const syncRes = await onUpdateUserCredits(user.uid, nextUserCredits);

      // If Firebase transfer failed or could not be verified, AUTOMATICALLY RETURN credits to Admin Pool!
      if (syncRes && syncRes.ok === false) {
        const refundedPool = saveAdminCreditPool(previousPool);
        onUpdateAdminCreditPool(refundedPool);
        const rollbackLogs = appendCreditRechargeLog({
          targetName: `AUTO-REFUND TO ADMIN POOL (${user.displayName})`,
          targetEmail: `${user.email} · Transfer Failed — Returned to Pool (${refundedPool})`,
          action: 'add',
          amount: Math.abs(deltaNeeded),
          balanceAfter: refundedPool,
        });
        setCreditLogs(rollbackLogs);
        setPoolActionNotice({
          type: 'err',
          text: `Credit transfer to ${user.displayName} failed (${syncRes.error || 'Sync error'})! Your ${Math.abs(deltaNeeded)} Credits have been AUTOMATICALLY RETURNED back to the Admin Pool (${refundedPool} Credits).`,
        });
        showToast(
          `Transfer Failed! ${Math.abs(deltaNeeded)} Credits Returned to Admin Pool (${refundedPool})`
        );
        return;
      }

      const verifiedBalance =
        typeof syncRes?.verifiedCredits === 'number' ? syncRes.verifiedCredits : nextUserCredits;

      const updatedLogs = appendCreditRechargeLog({
        targetName: `${user.displayName || 'User'} (${
          deltaNeeded > 0 ? 'Transferred & Verified' : 'Returned to Admin Pool'
        })`,
        targetEmail: `${user.userId ? `ID: ${user.userId} · ` : ''}${user.email} · Pool Left: ${tentativePool}`,
        action: deltaNeeded > 0 ? 'add' : 'deduct',
        amount: Math.abs(deltaNeeded),
        balanceAfter: verifiedBalance,
      });
      setCreditLogs(updatedLogs);

      if (deltaNeeded > 0) {
        setPoolActionNotice({
          type: 'ok',
          text: `✓ Live Firebase Sync Complete: Transferred +${deltaNeeded} Credits to ${user.displayName} (ID: ${
            user.userId || user.email.split('@')[0]
          }). User's Live Balance is now ${verifiedBalance} Credits. Remaining Admin Pool: ${tentativePool} Credits.`,
        });
        showToast(
          `Transferred +${deltaNeeded} Credits to ${user.displayName} (Live Balance: ${verifiedBalance})`
        );
      } else {
        setPoolActionNotice({
          type: 'ok',
          text: `✓ Returned ${Math.abs(deltaNeeded)} Credits from ${user.displayName} back into your Website Admin Pool! New Admin Pool: ${tentativePool} Credits (User Balance: ${verifiedBalance}).`,
        });
        showToast(
          `Returned ${Math.abs(deltaNeeded)} Credits back to Admin Pool! (Pool: ${tentativePool})`
        );
      }
    } catch (err: any) {
      // Automatic Rollback on unexpected exception
      const refundedPool = saveAdminCreditPool(previousPool);
      onUpdateAdminCreditPool(refundedPool);
      setPoolActionNotice({
        type: 'err',
        text: `Unexpected error during transfer (${err?.message || 'Network error'}). Deducted ${Math.abs(
          deltaNeeded
        )} Credits were AUTOMATICALLY RETURNED to your Admin Pool (${refundedPool} Credits).`,
      });
      showToast(`Error! Credits Returned to Admin Pool (${refundedPool})`);
    } finally {
      setIsTransferringCredits(false);
    }
  };

  const handleRedeemOwnerCodeForAdminPool = (e: React.FormEvent) => {
    e.preventDefault();
    setPoolActionNotice(null);
    if (!adminPoolCouponInput.trim()) return;
    const res = redeemAdminPoolRechargeCode(adminPoolCouponInput);
    if (!res.ok) {
      setPoolActionNotice({ type: 'err', text: res.error || 'Invalid Owner Activation Code.' });
      return;
    }
    onUpdateAdminCreditPool(res.newPoolBalance);
    setCreditLogs(loadCreditRechargeLogs());
    setAdminPoolCouponInput('');
    setPoolActionNotice({
      type: 'ok',
      text: `Owner Code Redeemed! Added +${res.addedCredits} Credits to your Website Admin Pool. Total Distributable Pool: ${res.newPoolBalance} Photos.`,
    });
    showToast(`+${res.addedCredits} Credits Added to Website Admin Pool!`);
  };

  const handleRequestAdminPoolFromOwner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!poolReqUtr.trim()) {
      setPoolActionNotice({
        type: 'err',
        text: 'Please enter the UPI UTR / Reference ID for your payment to the Owner.',
      });
      return;
    }
    const created = submitClientPaymentRequest({
      clientName: `${siteSettings.brandName} — Website Admin`,
      clientContact: currentUserProfile?.email || siteSettings.contactPhone || 'Website Admin',
      targetType: 'admin_pool',
      packageLabel: 'Website Admin Distributor Pool Top-Up',
      creditsRequested: poolReqAmount,
      amountInr: `Pool +${poolReqAmount}`,
      utrNumber: poolReqUtr.trim(),
      paymentNote: poolReqNote.trim() || 'Website Admin Pool Recharge Request',
    });
    setPoolReqUtr('');
    setPoolReqNote('');
    setShowAdminPoolQrModal(false);
    setPoolActionNotice({
      type: 'ok',
      text: `Admin Pool Recharge Request (#${created.id.slice(-5).toUpperCase()}) for +${poolReqAmount} Credits submitted to Owner! Once confirmed by the Owner, your Admin Pool will be updated.`,
    });
    showToast(`Submitted +${poolReqAmount} Admin Pool Request to Owner!`);
  };

  const handleChangeMasterPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setChangePassMsg(null);
    const res = updateAdminMasterPassword(currentPassForChange, newStrongPassword);
    if (!res.ok) {
      setChangePassMsg({ type: 'err', text: res.error || 'Failed to update password' });
      return;
    }
    setUnlockedPasswordCache(newStrongPassword.trim());
    setCurrentPassForChange('');
    setNewStrongPassword('');
    setChangePassMsg({
      type: 'ok',
      text: 'Strong Master Password updated successfully!',
    });
    showToast('Admin Master Password Updated!');
  };

  // User Management Filters & Modal
  const [userSearch, setUserSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AccountStatus>('all');
  const [selectedUserModal, setSelectedUserModal] = useState<UserProfile | null>(null);
  const [showAddUserForm, setShowAddUserForm] = useState(true);

  // Add User ID & Password Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserCustomId, setNewUserCustomId] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showNewUserPassword, setShowNewUserPassword] = useState(true);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [newUserStatus, setNewUserStatus] = useState<AccountStatus>('approved');
  const [newUserInitialCredits, setNewUserInitialCredits] = useState('5');
  const [isCreatingManagedUser, setIsCreatingManagedUser] = useState(false);

  // Recently created user credentials card & per-row password visibility/edit state
  const [lastCreatedUserCreds, setLastCreatedUserCreds] = useState<{
    displayName: string;
    userId: string;
    email: string;
    password: string;
    phone: string;
    credits: number;
  } | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [modalEditUserId, setModalEditUserId] = useState('');
  const [modalEditPassword, setModalEditPassword] = useState('');

  const generateRandomUserPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pass = 'St@';
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewUserPassword(pass);
    setShowNewUserPassword(true);
  };

  const generateAutoUserIdFromName = (nameVal = newUserName) => {
    const base =
      nameVal
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 10) || 'user';
    const randNum = Math.floor(100 + Math.random() * 900);
    setNewUserCustomId(`${base}${randNum}`);
  };

  // Branding & Footer Credit Form State
  const [formSettings, setFormSettings] = useState<SiteSettings>(() => ({
    ...siteSettings,
    toolCatalog: siteSettings.toolCatalog?.length
      ? siteSettings.toolCatalog
      : DEFAULT_TOOL_CATALOG,
  }));
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [toolCategoryFilter, setToolCategoryFilter] = useState<'all' | ToolCategoryId>('all');
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setFormSettings({
      ...siteSettings,
      toolCatalog: siteSettings.toolCatalog?.length
        ? siteSettings.toolCatalog
        : DEFAULT_TOOL_CATALOG,
    });
  }, [siteSettings]);

  const totalUsersCount = users.length;
  const approvedUsersCount = users.filter((u) => u.status === 'approved').length;
  const pendingUsersCount = users.filter((u) => u.status === 'pending').length;
  const blockedUsersCount = users.filter(
    (u) => u.status === 'blocked' || u.status === 'removed'
  ).length;

  const filteredUsers = users.filter((u) => {
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    const q = userSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      u.displayName?.toLowerCase().includes(q) ||
      u.userId?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.uid?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newUserName.trim();
    const cleanCustomId = newUserCustomId.trim().replace(/\s+/g, '');
    const cleanPass = newUserPassword.trim();
    const rawEmail = newUserEmail.trim();

    if (!cleanName) {
      showToast('Please enter the user Full Name.');
      return;
    }
    if (!cleanCustomId && !rawEmail) {
      showToast('Please enter a User ID or Email Address.');
      return;
    }
    if (!cleanPass || cleanPass.length < 6) {
      showToast('Password must be at least 6 characters long.');
      return;
    }

    const resolvedUserId =
      cleanCustomId || (rawEmail.includes('@') ? rawEmail.split('@')[0] : rawEmail);
    const resolvedEmail = rawEmail
      ? rawEmail.includes('@')
        ? rawEmail
        : `${rawEmail}@studio.user`
      : cleanCustomId.includes('@')
      ? cleanCustomId
      : `${cleanCustomId.toLowerCase()}@studio.user`;

    // Check duplicate User ID or Email
    const duplicate = users.find(
      (u) =>
        u.email.toLowerCase() === resolvedEmail.toLowerCase() ||
        (u.userId && u.userId.toLowerCase() === resolvedUserId.toLowerCase())
    );
    if (duplicate) {
      showToast('This User ID or Email is already registered! Please choose another ID.');
      return;
    }

    const initCredits = Math.max(0, parseInt(newUserInitialCredits, 10) || 0);
    if (initCredits > adminCreditPool) {
      showToast(
        `Insufficient Website Admin Pool! You only have ${adminCreditPool} credits available to assign.`
      );
      return;
    }

    setIsCreatingManagedUser(true);
    const previousPool = adminCreditPool;
    try {
      if (initCredits > 0) {
        const nextPool = saveAdminCreditPool(previousPool - initCredits);
        onUpdateAdminCreditPool(nextPool);
      }

      const createRes = await onCreateManagedUser(
        cleanName,
        resolvedEmail,
        newUserPhone.trim(),
        newUserRole,
        newUserStatus,
        initCredits,
        resolvedUserId,
        cleanPass
      );

      if (createRes && createRes.ok === false) {
        // Automatic Rollback if user creation / credit sync failed
        if (initCredits > 0) {
          const refundedPool = saveAdminCreditPool(previousPool);
          onUpdateAdminCreditPool(refundedPool);
        }
        setPoolActionNotice({
          type: 'err',
          text: `Failed to create user in Firebase (${createRes.error || 'Sync error'}). Deducted ${initCredits} Credits were AUTOMATICALLY RETURNED to your Admin Pool (${previousPool} Credits).`,
        });
        showToast(`Creation failed! ${initCredits} Credits returned to Admin Pool.`);
        return;
      }

      if (initCredits > 0) {
        const finalPool = previousPool - initCredits;
        const updatedLogs = appendCreditRechargeLog({
          targetName: `${cleanName} (ID: ${resolvedUserId})`,
          targetEmail: `${resolvedEmail} · Pool Left: ${finalPool}`,
          action: 'add',
          amount: initCredits,
          balanceAfter: initCredits,
        });
        setCreditLogs(updatedLogs);
      }

      setLastCreatedUserCreds({
        displayName: cleanName,
        userId: resolvedUserId,
        email: resolvedEmail,
        password: cleanPass,
        phone: newUserPhone.trim(),
        credits: initCredits,
      });

      setNewUserName('');
      setNewUserCustomId('');
      setNewUserPassword('');
      setNewUserEmail('');
      setNewUserPhone('');
      setNewUserRole('user');
      setNewUserStatus('approved');
      setNewUserInitialCredits('5');
    } catch {
      if (initCredits > 0) {
        const refundedPool = saveAdminCreditPool(previousPool);
        onUpdateAdminCreditPool(refundedPool);
      }
    } finally {
      setIsCreatingManagedUser(false);
    }
  };

  // Custom Poster Templates State (Website Admin Panel)
  const [customTemplates, setCustomTemplates] = useState<CustomPosterTemplate[]>(() =>
    loadCustomPosterTemplates()
  );
  const [tplName, setTplName] = useState('');
  const [tplCategory, setTplCategory] = useState<CustomPosterTemplate['category']>('wedding');
  const [tplBadge, setTplBadge] = useState('Admin Custom HD');
  const [tplLayoutPreset, setTplLayoutPreset] =
    useState<CustomPosterTemplate['layoutPreset']>('left-photo-right-text');
  const [tplSlotShape, setTplSlotShape] =
    useState<CustomPosterTemplate['slotShape']>('arch');
  const [tplBgImageDataUrl, setTplBgImageDataUrl] = useState('');
  const [tplBgColor1, setTplBgColor1] = useState('#3b0764');
  const [tplBgColor2, setTplBgColor2] = useState('#4c0519');
  const [tplBgColor3, setTplBgColor3] = useState('#1e1b4b');
  const [tplPrimaryAccent, setTplPrimaryAccent] = useState('#fbbf24');
  const [tplHeadline, setTplHeadline] = useState('SHUBH VIVAH · WEDDING INVITATION');
  const [tplNames, setTplNames] = useState('Aarav & Ananya');
  const [tplSubText, setTplSubText] = useState(
    'Cordially invite you and your family to grace this joyous celebration'
  );
  const [tplDateTime, setTplDateTime] = useState('Sunday, 24th November · 6:30 PM Onwards');
  const [tplVenue, setTplVenue] = useState('Grand Royal Convention Hall, Main Road');
  const customTplBgInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const syncCustomTemplates = () => {
      setCustomTemplates(loadCustomPosterTemplates());
    };
    window.addEventListener('malnadu-custom-templates-updated', syncCustomTemplates);
    window.addEventListener('storage', syncCustomTemplates);
    return () => {
      window.removeEventListener('malnadu-custom-templates-updated', syncCustomTemplates);
      window.removeEventListener('storage', syncCustomTemplates);
    };
  }, []);

  const handleCustomTemplateBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const res = ev.target?.result as string;
      if (res) {
        setTplBgImageDataUrl(res);
        showToast('Custom template background design loaded!');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCreateCustomTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = tplName.trim();
    if (!cleanName) {
      showToast('Please enter a Template Name.');
      return;
    }

    const categoryLabels: Record<CustomPosterTemplate['category'], string> = {
      wedding: 'Wedding Invitation',
      anniversary: 'Wedding Anniversary',
      engagement: 'Engagement Ceremony',
      birthday: 'Birthday Celebration',
      memorial: 'Memorial Tribute',
      festival: 'Festival Greeting',
      housewarming: 'Housewarming (Griha Pravesh)',
      'baby-congrats': 'Baby & Congratulations',
    };

    const isLeft = tplLayoutPreset === 'left-photo-right-text';

    const newTemplate: CustomPosterTemplate = {
      id: `custom-tpl-${Date.now()}`,
      name: cleanName,
      category: tplCategory,
      categoryLabel: categoryLabels[tplCategory] || 'Custom Studio Poster',
      badge: tplBadge.trim() || 'Admin Custom',
      bgColors: [tplBgColor1, tplBgColor2, tplBgColor3],
      primaryAccent: tplPrimaryAccent,
      secondaryAccent: '#fef3c7',
      bgImageDataUrl: tplBgImageDataUrl || undefined,
      layoutPreset: tplLayoutPreset,
      slotShape: tplSlotShape,
      slotX: isLeft ? 65 : 310,
      slotY: isLeft ? 270 : 230,
      slotWidth: isLeft ? 430 : 460,
      slotHeight: isLeft ? 680 : 540,
      headlineText: tplHeadline.trim() || 'AUSPICIOUS CELEBRATION',
      namesText: tplNames.trim() || 'Aarav & Ananya',
      subText:
        tplSubText.trim() ||
        'Cordially invite you and your family to grace this joyous occasion',
      dateTimeText: tplDateTime.trim() || 'Sunday, 24th November · 6:30 PM Onwards',
      venueText: tplVenue.trim() || 'Grand Royal Convention Hall, Main Road',
      createdAt: new Date().toISOString(),
    };

    const updated = [newTemplate, ...customTemplates];
    setCustomTemplates(updated);
    saveCustomPosterTemplates(updated);
    setTplName('');
    setTplBgImageDataUrl('');
    showToast(`Added Custom Template "${newTemplate.name}" to Poster Maker!`);
  };

  const handleDeleteCustomTemplate = (id: string) => {
    const updated = customTemplates.filter((t) => t.id !== id);
    setCustomTemplates(updated);
    saveCustomPosterTemplates(updated);
    showToast('Removed custom poster template.');
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await onSaveSiteSettings(formSettings);
      showToast('Brand & Footer Settings Saved!');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setFormSettings((prev) => ({
          ...prev,
          logoType: 'url',
          logoUrl: dataUrl,
        }));
        showToast('Logo image loaded! Click Save to apply.');
      }
    };
    reader.readAsDataURL(file);
  };

  const getStatusBadge = (status: AccountStatus) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <i className="fa-solid fa-circle-check text-emerald-600"></i> Approved (Active)
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <i className="fa-solid fa-clock text-amber-600"></i> Pending Approval
          </span>
        );
      case 'blocked':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <i className="fa-solid fa-ban text-rose-600"></i> Blocked
          </span>
        );
      case 'removed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
            <i className="fa-solid fa-user-slash text-slate-600"></i> Removed
          </span>
        );
    }
  };

  const formatDateString = (createdAt: any) => {
    if (!createdAt) return 'Recent';
    if (typeof createdAt === 'string') {
      const d = new Date(createdAt);
      if (!isNaN(d.getTime())) return d.toLocaleDateString();
      return createdAt;
    }
    if (createdAt?.seconds) {
      return new Date(createdAt.seconds * 1000).toLocaleDateString();
    }
    return 'Active';
  };

  const baseOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'https://malnadumedia.com';

  // Require Strong Master Password to unlock the Website Control Admin Panel
  if (!isCreditVaultUnlocked) {
    return (
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="bg-[#070a14] text-white rounded-3xl border border-cyan-500/40 p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-cyan-500 via-blue-600 to-purple-600 flex items-center justify-center text-2xl text-white shadow-lg">
              <i className="fa-solid fa-sliders"></i>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-[10px] font-extrabold uppercase tracking-wider">
                Website Control Admin Panel
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 border border-purple-400/40 text-purple-300 font-mono text-[10px] font-extrabold">
                /website-admin
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-white">
              {siteSettings.brandName} — Website Control Center
            </h1>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              Protected by Strong Master Password. Unlock this panel to manage website branding, theme colors, registered users, tool categories, custom tool thumbnails, and short links.
            </p>
          </div>

          <form onSubmit={handleUnlockCreditVault} className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold text-slate-300 mb-2">
                Strong Admin Master Password
              </label>
              <div className="relative">
                <i className="fa-solid fa-key absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400 text-xs"></i>
                <input
                  type={showVaultPassword ? 'text' : 'password'}
                  required
                  value={vaultPasswordInput}
                  onChange={(e) => {
                    setVaultPasswordInput(e.target.value);
                    setVaultError(null);
                  }}
                  placeholder="Enter Strong Master Password..."
                  className="w-full min-h-[48px] pl-10 pr-12 py-2.5 rounded-2xl bg-slate-900 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-cyan-400"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowVaultPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center text-xs"
                  title={showVaultPassword ? 'Hide Password' : 'Show Password'}
                >
                  <i className={`fa-solid ${showVaultPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            {vaultError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation text-sm shrink-0"></i>
                <span>{vaultError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full min-h-[48px] py-3 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-extrabold text-sm shadow-lg active:scale-[0.99] transition flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-unlock-keyhole"></i>
              <span>Unlock Website Control Admin Panel</span>
            </button>
          </form>

          <div className="pt-3 border-t border-white/10 flex items-center justify-center">
            <button
              type="button"
              onClick={onNavigateToStudio}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold transition"
            >
              ← Back to Website
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selectedQuickUser = users.find((u) => u.uid === quickTargetUid) || users[0] || null;

  return (
    <div className="w-full max-w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 lg:pb-8 space-y-5">
      {/* Top Admin Header Banner — MALNADU MEDIA Butterfly-Camera Logo Theme */}
      <div className="bg-[#070a14] text-white rounded-3xl p-4 sm:p-6 shadow-md border border-cyan-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="flex items-center gap-3.5">
          <div className="h-12 px-2 py-1 rounded-2xl bg-[#070a14] border border-cyan-400/40 flex items-center justify-center shrink-0 shadow-md overflow-hidden">
            <img
              src={siteSettings.logoUrl || '/assets/aistudio/malnadu-logo.svg'}
              alt={siteSettings.brandName}
              className="h-full w-auto max-w-[110px] object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-xl font-extrabold tracking-tight">
                {siteSettings.brandName} — Website Control Admin Panel
              </h1>
              <span className="px-2.5 py-0.5 rounded-lg font-mono text-[10px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                /website-admin
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Control website branding, users, tool catalog, custom thumbnails, short links, and appointments.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 1-Click Real-Time Database Sync Button (Ensures all Admin Panels show identical credits & users) */}
          {onForceCloudSync && (
            <button
              type="button"
              onClick={() => onForceCloudSync()}
              disabled={isCloudSyncing}
              className="min-h-[42px] px-3.5 py-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 text-xs font-extrabold transition flex items-center gap-2 shadow-md active:scale-95 cursor-pointer"
              title="Force sync all Admin Pool credits, Studio Wallet, and User Credits directly from Firebase Realtime Database"
            >
              <i className={`fa-solid fa-rotate ${isCloudSyncing ? 'fa-spin' : ''}`}></i>
              <span>{isCloudSyncing ? 'Syncing Database...' : 'Sync Live Database'}</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-950/20 font-mono text-[10px]">
                {lastCloudSyncedAt}
              </span>
            </button>
          )}

          {/* 1-Click Free Signup Credit Enable / Disable Toggle right on Admin Banner */}
          <button
            type="button"
            onClick={async () => {
              const nextEnabled = siteSettings.enableFreeSignupCredits === false;
              const updatedSettings: SiteSettings = {
                ...siteSettings,
                enableFreeSignupCredits: nextEnabled,
                freeSignupCreditsAmount: siteSettings.freeSignupCreditsAmount ?? 5,
              };
              setFormSettings(updatedSettings);
              await onSaveSiteSettings(updatedSettings);
              showToast(
                nextEnabled
                  ? `Free Signup Credits ENABLED (${updatedSettings.freeSignupCreditsAmount} Cr per new user — deducted from Admin Pool)`
                  : 'Free Signup Credits DISABLED (New users start with 0 credits)'
              );
            }}
            className={`min-h-[42px] px-3.5 py-2 rounded-2xl text-xs font-extrabold transition flex items-center gap-2 border shadow-sm ${
              siteSettings.enableFreeSignupCredits !== false
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-400/50'
                : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-400/50'
            }`}
            title="Toggle whether new user accounts get free signup credits (deducted from your Admin Credit Pool)"
          >
            <i
              className={`fa-solid ${
                siteSettings.enableFreeSignupCredits !== false ? 'fa-toggle-on text-emerald-400 text-base' : 'fa-toggle-off text-rose-400 text-base'
              }`}
            ></i>
            <span>
              {siteSettings.enableFreeSignupCredits !== false
                ? `Free Signup Credit: ON (${siteSettings.freeSignupCreditsAmount ?? 5} Cr from Pool)`
                : 'Free Signup Credit: OFF (Disabled)'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleLockCreditVault}
            className="min-h-[42px] px-3.5 py-2 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold transition flex items-center gap-1.5"
          >
            <i className="fa-solid fa-lock"></i>
            <span>Lock Admin</span>
          </button>

          <button
            onClick={onNavigateToStudio}
            className="min-h-[42px] px-4 py-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white text-xs font-bold shadow-sm transition flex items-center gap-2"
          >
            <i className="fa-solid fa-camera"></i>
            <span>Return to Studio</span>
          </button>
        </div>
      </div>

      {/* Summary Statistics Cards (Website Admin Pool, Studio Credits, Total, Approved, Pending, Blocked) */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <button
          onClick={() => setAdminTab('credits')}
          className="bg-[#070a14] text-white rounded-3xl p-4 border border-cyan-400/50 text-left hover:border-cyan-300 transition shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-300">Admin Credit Pool</span>
            <span className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-xs">
              <i className="fa-solid fa-boxes-stacked"></i>
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-cyan-400 mt-2 tabular-nums">
            {adminCreditPool}
          </div>
          <div className="text-[11px] text-slate-300 font-semibold mt-0.5">
            Available to Give Users
          </div>
        </button>

        <button
          onClick={() => setAdminTab('credits')}
          className="bg-[#070a14] text-white rounded-3xl p-4 border border-amber-400/40 text-left hover:border-amber-400 transition shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300">Studio Wallet</span>
            <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs">
              <i className={`fa-solid ${isCreditVaultUnlocked ? 'fa-coins' : 'fa-lock'}`}></i>
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-2 tabular-nums">
            {availableCredits}
          </div>
          <div className="text-[11px] text-amber-300 font-semibold mt-0.5">
            Local Studio Photos
          </div>
        </button>

        <button
          onClick={() => {
            setAdminTab('users');
            setStatusFilter('all');
          }}
          className="bg-white rounded-3xl p-4 border border-slate-200 text-left hover:border-cyan-400 transition shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Users</span>
            <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center text-xs">
              <i className="fa-solid fa-users"></i>
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-slate-900 mt-2">
            {totalUsersCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Registered accounts</div>
        </button>

        <button
          onClick={() => {
            setAdminTab('users');
            setStatusFilter('approved');
          }}
          className="bg-white rounded-3xl p-4 border border-slate-200 text-left hover:border-emerald-400 transition shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Approved Users</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs">
              <i className="fa-solid fa-user-check"></i>
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-emerald-700 mt-2">
            {approvedUsersCount}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">Active studio access</div>
        </button>

        <button
          onClick={() => {
            setAdminTab('users');
            setStatusFilter('pending');
          }}
          className="bg-white rounded-3xl p-4 border border-slate-200 text-left hover:border-amber-400 transition shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Pending Approval</span>
            <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xs">
              <i className="fa-solid fa-user-clock"></i>
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-amber-600 mt-2">
            {pendingUsersCount}
          </div>
          <div className="text-[11px] text-amber-700 font-semibold mt-0.5">Awaiting admin review</div>
        </button>

        <button
          onClick={() => {
            setAdminTab('users');
            setStatusFilter('blocked');
          }}
          className="bg-white rounded-3xl p-4 border border-slate-200 text-left hover:border-rose-400 transition shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Blocked / Removed</span>
            <span className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xs">
              <i className="fa-solid fa-user-lock"></i>
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-rose-600 mt-2">
            {blockedUsersCount}
          </div>
          <div className="text-[11px] text-rose-600 font-semibold mt-0.5">Restricted accounts</div>
        </button>
      </div>

      {/* =====================================================================
          SUPER SIMPLE 1-CLICK CREDIT ADD & TRANSFER BAR (ALWAYS VISIBLE ON MOBILE & DESKTOP)
         ===================================================================== */}
      <div className="bg-gradient-to-br from-[#070a14] via-slate-900 to-[#111827] text-white rounded-3xl p-4 sm:p-6 border-2 border-cyan-500/50 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-white/10 pb-3.5">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 flex items-center justify-center text-lg font-extrabold shrink-0 shadow-md">
              <i className="fa-solid fa-bolt"></i>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider">
                  Firebase Realtime Sync Active · Auto-Refund Protected
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-mono text-[11px] font-extrabold tabular-nums">
                  Admin Pool: {adminCreditPool} Credits
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-white mt-1">
                Simple 1-Click Credit Add &amp; User Credit Transfer (Real-Time Firebase Sync)
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-300">
                Select any user below to transfer credits immediately. If a transfer ever fails to reach the user, deducted credits automatically return to your Admin Pool.
              </p>
            </div>
          </div>

          {/* Quick Top-Up Admin Pool Bar + 1-Click Realtime Sync Button */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white/5 border border-white/10 p-2 rounded-2xl">
            {onForceCloudSync && (
              <button
                type="button"
                onClick={() => onForceCloudSync()}
                disabled={isCloudSyncing}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold transition flex items-center gap-1.5 active:scale-95 shadow-sm"
                title="Click to sync all credits and users across all devices from Firebase Realtime Database"
              >
                <i className={`fa-solid fa-rotate ${isCloudSyncing ? 'fa-spin' : ''}`}></i>
                <span>{isCloudSyncing ? 'Syncing...' : 'Sync Credits Now'}</span>
              </button>
            )}
            <span className="text-[11px] font-extrabold text-amber-300 px-1.5">
              + Add to Admin Pool:
            </span>
            {[100, 500, 1000].map((poolAmt) => (
              <button
                key={poolAmt}
                type="button"
                onClick={() => handleQuickTopUpAdminPool(poolAmt)}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-extrabold transition active:scale-95"
              >
                +{poolAmt}
              </button>
            ))}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-xl px-2 py-1">
              <input
                type="number"
                min={1}
                max={100000}
                value={quickAdminTopUpAmount}
                onChange={(e) => setQuickAdminTopUpAmount(e.target.value)}
                className="w-16 text-xs font-mono font-bold text-white bg-transparent focus:outline-none tabular-nums"
                placeholder="500"
              />
              <button
                type="button"
                onClick={() =>
                  handleQuickTopUpAdminPool(Math.max(1, parseInt(quickAdminTopUpAmount, 10) || 500))
                }
                className="px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[11px] font-extrabold"
              >
                Add Pool
              </button>
            </div>
          </div>
        </div>

        {/* Pool Action Feedback Banner right inside the Quick Box */}
        {poolActionNotice && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-extrabold flex items-center justify-between gap-3 ${
              poolActionNotice.type === 'ok'
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                : 'bg-rose-500/25 border-rose-400/60 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <i
                className={`fa-solid ${
                  poolActionNotice.type === 'ok'
                    ? 'fa-circle-check text-emerald-400'
                    : 'fa-rotate-left text-rose-400'
                } text-sm shrink-0`}
              ></i>
              <span>{poolActionNotice.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setPoolActionNotice(null)}
              className="text-[11px] underline shrink-0"
            >
              Close
            </button>
          </div>
        )}

        {/* Main 3-Step Simple User Credit Transfer Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-end">
          {/* Step 1: Select User */}
          <div className="lg:col-span-5">
            <label className="block text-[11px] font-extrabold text-cyan-300 mb-1.5">
              1. Select User Account (Name · User ID · Live Credits)
            </label>
            <select
              value={selectedQuickUser?.uid || ''}
              onChange={(e) => setQuickTargetUid(e.target.value)}
              className="w-full min-h-[46px] px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-cyan-500/40 text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-cyan-400"
            >
              {users.length === 0 ? (
                <option value="">No users registered yet</option>
              ) : (
                users.map((u) => {
                  const uIdLabel = u.userId || u.email.split('@')[0];
                  const uCreds = typeof u.credits === 'number' ? u.credits : 0;
                  return (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName} (ID: {uIdLabel}) — Live Balance: {uCreds} Credits
                    </option>
                  );
                })
              )}
            </select>
          </div>

          {/* Step 2: 1-Click Preset Credit Buttons */}
          <div className="lg:col-span-4">
            <label className="block text-[11px] font-extrabold text-emerald-300 mb-1.5">
              2. Tap Preset Credits to Send Immediately
            </label>
            <div className="grid grid-cols-6 gap-1.5">
              {[5, 10, 25, 50, 100, 250].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  disabled={!selectedQuickUser || isTransferringCredits || adminCreditPool < amt}
                  onClick={() => {
                    if (selectedQuickUser) {
                      setQuickCreditAmount(String(amt));
                      handleAdjustUserCredits(selectedQuickUser, 'add', amt);
                    }
                  }}
                  className="min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-mono text-xs font-extrabold transition active:scale-95 flex items-center justify-center shadow-xs tabular-nums"
                >
                  +{amt}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Custom Credit Input + Send & Return to Pool Buttons */}
          <div className="lg:col-span-3 flex flex-col sm:flex-row lg:flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={100000}
                value={quickCreditAmount}
                onChange={(e) => setQuickCreditAmount(e.target.value)}
                placeholder="Credits"
                className="w-24 min-h-[44px] px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm font-extrabold focus:outline-none focus:border-emerald-400 tabular-nums"
              />
              <button
                type="button"
                disabled={!selectedQuickUser || isTransferringCredits}
                onClick={() => {
                  if (selectedQuickUser) {
                    const amt = Math.max(1, parseInt(quickCreditAmount, 10) || 50);
                    handleAdjustUserCredits(selectedQuickUser, 'add', amt);
                  }
                }}
                className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50 text-slate-950 text-xs font-extrabold transition active:scale-95 flex items-center justify-center gap-1.5 shadow-md"
              >
                <i
                  className={`fa-solid ${
                    isTransferringCredits ? 'fa-spinner fa-spin' : 'fa-paper-plane'
                  }`}
                ></i>
                <span>{isTransferringCredits ? 'Syncing...' : `Send +${quickCreditAmount || 0}`}</span>
              </button>
            </div>

            {selectedQuickUser && (selectedQuickUser.credits ?? 0) > 0 && (
              <button
                type="button"
                disabled={isTransferringCredits}
                onClick={() => handleAdjustUserCredits(selectedQuickUser, 'set', 0)}
                className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 text-[11px] font-extrabold transition flex items-center justify-center gap-1.5"
                title="Pull all credits from this user back into your Admin Pool"
              >
                <i className="fa-solid fa-rotate-left"></i>
                <span>
                  Return User&apos;s {selectedQuickUser.credits} Credits to Admin Pool
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar bg-[#070a14] p-2 rounded-2xl border border-cyan-500/30">
        {[
          {
            id: 'credits',
            label: `Admin Credit Pool (${adminCreditPool}) & User Credits`,
            icon: 'fa-coins',
          },
          {
            id: 'users',
            label: `Logged-In Users (${totalUsersCount}) & Approvals`,
            icon: 'fa-users-gear',
          },
          {
            id: 'templates',
            label: `Custom Poster Templates (${customTemplates.length})`,
            icon: 'fa-wand-magic-sparkles',
          },
          { id: 'tools', label: 'Tools & Categories Manager', icon: 'fa-layer-group' },
          { id: 'branding', label: 'Brand, Theme & Footer Credit', icon: 'fa-palette' },
          { id: 'links', label: `Short Links (${shortLinks.length})`, icon: 'fa-link' },
          { id: 'operations', label: 'Appointments & IDs', icon: 'fa-calendar-check' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setAdminTab(t.id as AdminTab)}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 whitespace-nowrap ${
              adminTab === t.id
                ? t.id === 'credits'
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-white shadow-sm'
                  : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            <i className={`fa-solid ${t.icon}`}></i>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* =====================================================================
          TAB 0: WEBSITE ADMIN DISTRIBUTOR CREDIT POOL & USER ALLOCATION
         ===================================================================== */}
      {adminTab === 'credits' && (
        <div className="space-y-5">
          {/* Top Distributor Pool Banner & Controls */}
          <div className="bg-[#070a14] text-white rounded-3xl p-5 sm:p-6 border border-cyan-500/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-md">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center text-xl shrink-0">
                <i className="fa-solid fa-boxes-stacked"></i>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-extrabold text-white">
                    Website Admin Credit Pool & User Credit Distributor
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                    Distributor System Active
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  The Owner allocates credits to your <strong>Website Admin Credit Pool</strong>. You can distribute these credits to your registered users or to the local Studio Wallet. When your Admin Pool reaches 0, request a top-up or redeem an Owner Activation Code.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
              <div className="px-4 py-2 rounded-2xl bg-cyan-950/80 border border-cyan-400/40 text-right">
                <div className="text-[10px] font-extrabold uppercase text-cyan-300">
                  Admin Pool Balance
                </div>
                <div className="text-lg font-mono font-extrabold text-cyan-400 tabular-nums">
                  {adminCreditPool} Photos
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAdminPoolQrModal((v) => !v)}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-extrabold transition flex items-center gap-1.5 shadow-sm"
              >
                <i className="fa-solid fa-qrcode"></i>
                <span>Get More Pool Credits (UPI QR)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowChangePassForm((v) => !v)}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-amber-300 border border-amber-400/30 text-xs font-bold transition flex items-center gap-1.5"
              >
                <i className="fa-solid fa-key"></i>
                <span>Change Password</span>
              </button>
            </div>
          </div>

          {/* NEW USER FREE SIGNUP CREDITS CONTROL BANNER (DEDUCTS FROM ADMIN POOL) */}
          <div
            className={`rounded-3xl p-4 sm:p-5 border flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs transition ${
              siteSettings.enableFreeSignupCredits !== false
                ? 'bg-emerald-50/90 border-emerald-300'
                : 'bg-slate-100 border-slate-300'
            }`}
          >
            <div className="flex items-start sm:items-center gap-3.5">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg shrink-0 font-bold ${
                  siteSettings.enableFreeSignupCredits !== false
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-400 text-white'
                }`}
              >
                <i
                  className={`fa-solid ${
                    siteSettings.enableFreeSignupCredits !== false ? 'fa-gift' : 'fa-ban'
                  }`}
                ></i>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    New Account Free Signup Credit Control
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase ${
                      siteSettings.enableFreeSignupCredits !== false
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {siteSettings.enableFreeSignupCredits !== false
                      ? `ACTIVE (${siteSettings.freeSignupCreditsAmount ?? 5} Free Credits / New User)`
                      : 'DISABLED (0 Free Credits)'}
                  </span>
                </div>
                <p className="text-xs text-slate-700 mt-1 max-w-2xl leading-relaxed">
                  {siteSettings.enableFreeSignupCredits !== false ? (
                    <>
                      Every genuinely new user who signs up receives{' '}
                      <strong>{siteSettings.freeSignupCreditsAmount ?? 5} free photo credits</strong>, which are{' '}
                      <strong>automatically deducted from your Website Admin Credit Pool ({adminCreditPool} Credits left)</strong>.
                    </>
                  ) : (
                    <>
                      Free signup credits are currently <strong>DISABLED</strong>. New accounts start with{' '}
                      <strong>0 credits</strong> and must pay via your QR code or receive credits manually from your Admin Pool.
                    </>
                  )}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] font-extrabold">
                  <span className="px-2.5 py-1 rounded-xl bg-slate-900 text-cyan-300 flex items-center gap-1.5">
                    <i className="fa-solid fa-shield-halved"></i>
                    <span>Anti-Abuse Device & Email Guard: ACTIVE</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-700">
                    Claimed Devices/Accounts: {Math.max(freeCreditGuard.claimedEmails.length, freeCreditGuard.claimedFingerprints.length)}
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-rose-100 border border-rose-200 text-rose-800">
                    Blocked Repeat Attempts: {freeCreditGuard.blockedAttempts.length}
                  </span>
                </div>
                {freeCreditGuard.blockedAttempts.length > 0 && (
                  <div className="mt-2 p-2.5 rounded-xl bg-white/90 border border-rose-200 space-y-1 max-w-2xl">
                    <div className="text-[10px] font-extrabold uppercase text-rose-700">
                      Recent Blocked Repeat Free-Credit Signup Attempts:
                    </div>
                    {freeCreditGuard.blockedAttempts.slice(0, 3).map((blk) => (
                      <div key={blk.id} className="text-[11px] text-slate-700 font-mono flex flex-wrap items-center gap-2">
                        <span className="font-bold text-rose-700">BLOCKED (0 Cr)</span>
                        <span>{blk.attemptedEmail}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500">{blk.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
              <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200">
                {[5, 3, 2, 1].map((amt) => {
                  const isActive =
                    siteSettings.enableFreeSignupCredits !== false &&
                    (siteSettings.freeSignupCreditsAmount ?? 5) === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={async () => {
                        const updated: SiteSettings = {
                          ...siteSettings,
                          enableFreeSignupCredits: true,
                          freeSignupCreditsAmount: amt,
                        };
                        setFormSettings(updated);
                        await onSaveSiteSettings(updated);
                        showToast(
                          `New User Free Signup Credit set to ${amt} Credits (deducted from Admin Pool)`
                        );
                      }}
                      className={`min-h-[34px] px-2.5 py-1 rounded-xl text-xs font-extrabold transition ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      +{amt} Free
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={async () => {
                  const nextEnabled = siteSettings.enableFreeSignupCredits === false;
                  const updated: SiteSettings = {
                    ...siteSettings,
                    enableFreeSignupCredits: nextEnabled,
                    freeSignupCreditsAmount: siteSettings.freeSignupCreditsAmount ?? 5,
                  };
                  setFormSettings(updated);
                  await onSaveSiteSettings(updated);
                  showToast(
                    nextEnabled
                      ? `Enabled Free Signup Credits (${updated.freeSignupCreditsAmount} Cr per new user from Admin Pool)`
                      : 'Disabled Free Signup Credits (New accounts start with 0 credits)'
                  );
                }}
                className={`min-h-[40px] px-4 py-2 rounded-2xl text-xs font-extrabold transition flex items-center gap-2 shadow-xs ${
                  siteSettings.enableFreeSignupCredits !== false
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                <i
                  className={`fa-solid ${
                    siteSettings.enableFreeSignupCredits !== false ? 'fa-power-off' : 'fa-check'
                  }`}
                ></i>
                <span>
                  {siteSettings.enableFreeSignupCredits !== false
                    ? 'Disable Free Credits'
                    : 'Enable Free Credits'}
                </span>
              </button>
            </div>
          </div>

          {/* Pool Action Feedback Notice Banner */}
          {poolActionNotice && (
            <div
              className={`p-4 rounded-2xl border text-xs font-extrabold flex items-center justify-between gap-3 ${
                poolActionNotice.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <i
                  className={`fa-solid ${
                    poolActionNotice.type === 'ok'
                      ? 'fa-circle-check text-emerald-600'
                      : 'fa-triangle-exclamation text-rose-600'
                  } text-base`}
                ></i>
                <span>{poolActionNotice.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setPoolActionNotice(null)}
                className="text-xs font-bold underline opacity-75 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* SECTION 0: INCOMING WEBSITE USER QR PAYMENT REQUESTS (FROM T TT GOOGLE PAY QR) */}
          <div className="bg-white rounded-3xl border-2 border-teal-500/30 p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#1e1f22] text-teal-300 border border-teal-500/40 flex items-center justify-center text-xl shrink-0">
                  <i className="fa-solid fa-qrcode"></i>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-extrabold uppercase">
                      Website User Payments ({WEBSITE_USER_PAYEE_NAME} UPI QR)
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-mono text-[11px] font-extrabold">
                      Pending Approvals:{' '}
                      {
                        userPaymentRequests.filter(
                          (r) => r.targetType !== 'admin_pool' && r.status === 'pending'
                        ).length
                      }
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 mt-1">
                    Incoming User QR Payment Requests — Confirm &amp; Add Credits from Your Admin Pool
                  </h3>
                  <p className="text-xs text-slate-500 max-w-3xl">
                    When any user on the website scans the <strong>{WEBSITE_USER_PAYEE_NAME} UPI QR Code</strong> and submits payment, their request appears below. Confirming a request deducts those credits from your <strong>Admin Pool ({adminCreditPool} available)</strong> and adds them to the user's account. You cannot add more credits than what the Owner has allocated to your pool.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <div className="bg-[#1e1f22] p-1.5 rounded-xl border border-slate-700 w-14 h-14 shrink-0 flex items-center justify-center overflow-hidden">
                  <img
                    src={websiteUserQrUrl}
                    alt="Website User QR"
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <input
                    ref={userQrUploadInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadCustomUserQr}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => userQrUploadInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-teal-300 text-[11px] font-extrabold transition flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-upload"></i>
                    <span>Update User QR Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      saveWebsiteUserQrImage('');
                      setWebsiteUserQrUrl(loadWebsiteUserQrImage());
                      showToast('Restored Default T TT Google Pay QR Code');
                    }}
                    className="block text-[10px] font-bold text-slate-500 hover:text-slate-800"
                  >
                    Reset to Default T TT QR
                  </button>
                </div>
              </div>
            </div>

            {userPaymentRequests.filter((r) => r.targetType !== 'admin_pool').length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No user QR payment requests submitted yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {userPaymentRequests
                  .filter((r) => r.targetType !== 'admin_pool')
                  .map((req) => {
                    const customGrantVal = reqGrantInputs[req.id] ?? String(req.creditsRequested);
                    const parsedGrant = Math.max(1, parseInt(customGrantVal, 10) || req.creditsRequested);
                    const hasEnoughPool = adminCreditPool >= parsedGrant;

                    return (
                      <div
                        key={req.id}
                        className={`p-4 rounded-2xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                          req.status === 'pending'
                            ? 'bg-amber-50/50 border-amber-300'
                            : req.status === 'approved'
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : 'bg-slate-50 border-slate-200 opacity-75'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-extrabold text-slate-900">
                              {req.clientName}
                            </span>
                            <span className="text-xs font-semibold text-slate-600">
                              ({req.clientContact})
                            </span>
                            <span className="px-2.5 py-0.5 rounded-lg bg-purple-100 text-purple-900 border border-purple-200 font-mono text-xs font-extrabold">
                              Requested: +{req.creditsRequested} Credits ({req.amountInr})
                            </span>
                            <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 text-cyan-300 font-mono text-xs font-bold">
                              UTR: {req.utrNumber}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                                req.status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : req.status === 'rejected'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-200 text-amber-950'
                              }`}
                            >
                              {req.status}
                            </span>
                          </div>
                          {req.paymentNote && (
                            <p className="text-xs text-slate-600">{req.paymentNote}</p>
                          )}
                          <div className="text-[11px] text-slate-400">
                            Submitted: {new Date(req.createdAt).toLocaleString()}
                          </div>
                        </div>

                        {req.status === 'pending' ? (
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1">
                              <span className="text-[10px] font-bold text-slate-500">
                                Credits from Pool:
                              </span>
                              <input
                                type="number"
                                min={1}
                                max={Math.max(1, adminCreditPool)}
                                value={customGrantVal}
                                onChange={(e) =>
                                  setReqGrantInputs((prev) => ({
                                    ...prev,
                                    [req.id]: e.target.value,
                                  }))
                                }
                                className="w-16 text-xs font-mono font-extrabold text-slate-900 focus:outline-none"
                              />
                            </div>
                            <button
                              type="button"
                              disabled={!hasEnoughPool}
                              onClick={() => handleApproveUserQrPayment(req)}
                              className="min-h-[38px] px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-rose-600 disabled:opacity-90 text-white text-xs font-extrabold transition flex items-center gap-1.5 shadow-xs"
                            >
                              <i
                                className={`fa-solid ${
                                  hasEnoughPool ? 'fa-circle-check' : 'fa-triangle-exclamation'
                                }`}
                              ></i>
                              <span>
                                {hasEnoughPool
                                  ? `Confirm & Add +${parsedGrant} Credits`
                                  : `Pool Low (${adminCreditPool} Left) — Buy from Owner`}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectUserQrPayment(req.id)}
                              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-bold transition"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs font-bold text-emerald-700 shrink-0">
                            {req.status === 'approved'
                              ? `✓ Credited (+${req.creditsRequested} Photos)`
                              : 'Rejected'}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* PURCHASE ADMIN POOL CREDITS FROM OWNER (SHRIYANSH SINGH RAJPOOT — 7581030272@slc) */}
          <div className="bg-white rounded-3xl border-2 border-purple-300 p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-200 text-[10px] font-extrabold uppercase tracking-wider">
                    Owner Admin Credit Pool Recharge · {ADMIN_ACCOUNT_HOLDER}
                  </span>
                  {adminCreditPool <= 50 && (
                    <span className="px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-extrabold uppercase">
                      Admin Pool Running Low ({adminCreditPool} Credits Left) — Contact Owner to Recharge
                    </span>
                  )}
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 mt-1">
                  Purchase / Recharge Admin Pool Credits from Owner ({ADMIN_ACCOUNT_HOLDER})
                </h3>
                <p className="text-xs text-slate-600">
                  As Website Admin, you can only distribute the credits available in your <strong>Admin Credit Pool ({adminCreditPool} left)</strong>. When your credits finish, scan <strong>{ADMIN_ACCOUNT_HOLDER}&apos;s Slice UPI QR Code ({ADMIN_UPI_ID})</strong> below to purchase more Admin Pool credits or enter an Owner Activation Code.
                </p>
              </div>

              <form
                onSubmit={handleRedeemOwnerCodeForAdminPool}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0"
              >
                <input
                  type="text"
                  value={adminPoolCouponInput}
                  onChange={(e) => setAdminPoolCouponInput(e.target.value)}
                  placeholder="Enter Owner Code (MM-...)"
                  className="min-h-[42px] px-3.5 py-2 text-xs font-mono font-bold uppercase bg-slate-50 border border-slate-300 rounded-xl w-full sm:w-60 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="submit"
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#070a14] hover:bg-slate-800 text-cyan-300 text-xs font-extrabold whitespace-nowrap transition flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-bolt"></i>
                  <span>Redeem to Admin Pool</span>
                </button>
              </form>
            </div>

            {/* Owner Shriyansh Singh Rajpoot Slice UPI QR Code & Admin Pool Top-Up Form */}
            {showAdminPoolQrModal && (
              <div className="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-5 items-center bg-purple-50/50 p-4 rounded-2xl border border-purple-200">
                <div className="md:col-span-4 flex flex-col items-center text-center space-y-2.5">
                  <span className="px-3 py-1 rounded-lg bg-purple-700 text-white text-[10px] font-extrabold uppercase tracking-wider">
                    Owner QR · For Admin Credit Purchase
                  </span>
                  <div className="bg-white p-2.5 rounded-2xl border-2 border-purple-300 shadow-sm max-w-[210px]">
                    <img
                      src={ADMIN_QR_IMAGE_PATH}
                      alt={`Owner UPI QR - ${ADMIN_ACCOUNT_HOLDER}`}
                      className="w-full h-auto rounded-xl object-contain"
                    />
                  </div>
                  <div className="text-xs font-extrabold text-slate-900">
                    Account holder: {ADMIN_ACCOUNT_HOLDER}
                  </div>
                  <div className="text-[11px] font-mono font-extrabold text-purple-800 bg-white px-3 py-1 rounded-lg border border-purple-200">
                    UPI ID: {ADMIN_UPI_ID}
                  </div>
                  <a
                    href={`https://wa.me/${DEFAULT_ADMIN_WHATSAPP.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                      `Hello ${ADMIN_ACCOUNT_HOLDER}, my Website Admin Credit Pool has ${adminCreditPool} credits left. I want to purchase +${poolReqAmount} Admin Pool credits via your Slice UPI QR (${ADMIN_UPI_ID}).`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full max-w-[210px] min-h-[38px] py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] shadow-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <i className="fa-brands fa-whatsapp text-sm"></i>
                    <span>Contact Shriyansh on WhatsApp</span>
                  </a>
                </div>

                <form
                  onSubmit={handleRequestAdminPoolFromOwner}
                  className="md:col-span-8 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-extrabold text-slate-900">
                      Purchase Admin Pool Credits from {ADMIN_ACCOUNT_HOLDER} ({ADMIN_UPI_ID})
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAdminPoolQrModal(false)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800"
                    >
                      Hide QR
                    </button>
                  </div>
                  <p className="text-xs text-slate-600">
                    Scan <strong>{ADMIN_ACCOUNT_HOLDER}&apos;s Slice UPI QR code</strong> on the left, complete payment, and submit your UTR number below. Your request will appear in the Owner&apos;s Credit Admin Panel (<code>/credit-admin</code>), and once confirmed, the credits will be added to your <strong>Website Admin Pool</strong> so you can distribute them to your users.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Admin Pool Credits to Purchase
                      </label>
                      <select
                        value={poolReqAmount}
                        onChange={(e) => setPoolReqAmount(Number(e.target.value))}
                        className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl"
                      >
                        {[200, 500, 1000, 2500, 5000, 10000].map((amt) => (
                          <option key={amt} value={amt}>
                            +{amt} Admin Pool Credits
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        UPI UTR / Ref Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={poolReqUtr}
                        onChange={(e) => setPoolReqUtr(e.target.value)}
                        placeholder="12-digit UTR Number"
                        className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Note (Optional)
                      </label>
                      <input
                        type="text"
                        value={poolReqNote}
                        onChange={(e) => setPoolReqNote(e.target.value)}
                        placeholder="Paid to Shriyansh Singh Rajpoot"
                        className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="min-h-[42px] px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-xs font-extrabold shadow-sm transition"
                  >
                    Submit Admin Pool Purchase Request to Owner ({ADMIN_ACCOUNT_HOLDER})
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Change Master Password Panel */}
          {showChangePassForm && (
            <form
              onSubmit={handleChangeMasterPasswordSubmit}
              className="bg-white rounded-3xl border border-amber-300 p-5 space-y-4 shadow-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Update Admin Master Password
                  </h3>
                  <p className="text-xs text-slate-500">
                    Set a new strong password (minimum 8 characters) for unlocking the Website Admin Panel.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowChangePassForm(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  Close
                </button>
              </div>

              {changePassMsg && (
                <div
                  className={`p-3 rounded-2xl text-xs font-bold ${
                    changePassMsg.type === 'ok'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {changePassMsg.text}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Current Master Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassForChange}
                    onChange={(e) => setCurrentPassForChange(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full min-h-[42px] px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    New Strong Password
                  </label>
                  <input
                    type="text"
                    required
                    minLength={8}
                    value={newStrongPassword}
                    onChange={(e) => setNewStrongPassword(e.target.value)}
                    placeholder="Min 8 chars (e.g. MyAdmin@2026#)"
                    className="w-full min-h-[42px] px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#070a14] hover:bg-slate-800 text-amber-300 text-xs font-extrabold transition"
                  >
                    Save New Password
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* SECTION 1: REGISTERED USER ACCOUNTS — DISTRIBUTE CREDITS FROM ADMIN POOL */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-md bg-cyan-50 text-cyan-800 border border-cyan-200 text-[10px] font-extrabold uppercase">
                    Step 1 · Give Credits to Users
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-mono text-[11px] font-extrabold">
                    Your Distributable Pool: {adminCreditPool} Credits
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  Registered User Accounts — Distribute Credits from Your Admin Pool
                </h3>
                <p className="text-xs text-slate-500">
                  Every credit you give to a user is deducted from your Website Admin Credit Pool ({adminCreditPool} available). Reclaiming credits from a user returns them to your pool.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {onForceCloudSync && (
                  <button
                    type="button"
                    onClick={() => onForceCloudSync()}
                    disabled={isCloudSyncing}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition flex items-center gap-1.5 shrink-0 active:scale-95 shadow-xs"
                  >
                    <i className={`fa-solid fa-rotate ${isCloudSyncing ? 'fa-spin' : ''}`}></i>
                    <span>{isCloudSyncing ? 'Syncing...' : 'Sync Users & Credits'}</span>
                  </button>
                )}
                <div className="relative flex-1 sm:w-64">
                  <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search user by name or email..."
                    className="w-full min-h-[40px] pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              {filteredUsers.map((u) => {
                const userCredits = typeof u.credits === 'number' ? u.credits : 5;
                const customVal = userCustomCreditInputs[u.uid] ?? '50';
                return (
                  <div
                    key={u.uid}
                    className="p-3.5 rounded-2xl border border-slate-200 hover:border-cyan-300 bg-slate-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-[#070a14] text-cyan-300 font-extrabold text-xs flex items-center justify-center shrink-0">
                        {(u.displayName || u.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                            {u.displayName}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono text-xs font-extrabold">
                            <i className="fa-solid fa-coins mr-1 text-emerald-600"></i>
                            {userCredits} Credits
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">{u.email}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {[5, 10, 25, 50, 100, 500].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          disabled={adminCreditPool < amt}
                          onClick={() => handleAdjustUserCredits(u, 'add', amt)}
                          className="min-h-[36px] px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-mono text-xs font-extrabold transition"
                          title={`Give +${amt} Credits from Admin Pool`}
                        >
                          +{amt}
                        </button>
                      ))}

                      {userCredits > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            handleAdjustUserCredits(u, 'deduct', Math.min(25, userCredits))
                          }
                          className="min-h-[36px] px-2.5 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-mono text-xs font-extrabold transition"
                          title="Reclaim Credits from user back to Admin Pool"
                        >
                          -{Math.min(25, userCredits)}
                        </button>
                      )}

                      {userCredits > 0 && (
                        <button
                          type="button"
                          onClick={() => handleAdjustUserCredits(u, 'set', 0)}
                          className="min-h-[36px] px-2.5 py-1 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 text-[11px] font-extrabold transition"
                          title="Return all credits of this user back into Admin Pool"
                        >
                          Return All ({userCredits}) to Pool
                        </button>
                      )}

                      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-0.5">
                        <input
                          type="number"
                          min={0}
                          max={100000}
                          value={customVal}
                          onChange={(e) =>
                            setUserCustomCreditInputs((prev) => ({
                              ...prev,
                              [u.uid]: e.target.value,
                            }))
                          }
                          className="w-16 h-7 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleAdjustUserCredits(
                              u,
                              'add',
                              Math.max(1, parseInt(customVal, 10) || 50)
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-extrabold"
                        >
                          Give
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleAdjustUserCredits(
                              u,
                              'set',
                              Math.max(0, parseInt(customVal, 10) || 0)
                            )
                          }
                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold"
                        >
                          Set
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: TRANSFER FROM ADMIN POOL TO LOCAL STUDIO WALLET + AUDIT LOG */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-600">
                    Local Studio Counter Wallet
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Transfer Credits from Admin Pool to Studio Wallet
                  </h3>
                  <p className="text-xs text-slate-500">
                    Move credits from your Admin Pool ({adminCreditPool} left) into this browser's Studio Wallet.
                  </p>
                </div>
                <div className="px-4 py-2 rounded-2xl bg-[#070a14] border border-emerald-500/30 text-right">
                  <div className="text-[10px] font-bold uppercase text-slate-400">
                    Studio Wallet
                  </div>
                  <div className="text-lg font-mono font-extrabold text-emerald-400 tabular-nums">
                    {availableCredits} Photos
                  </div>
                </div>
              </div>

              {/* Quick Transfer Buttons */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  1-Click Transfer from Admin Pool ({adminCreditPool} Available)
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[25, 50, 100, 250, 500, 1000].map((pkg) => (
                    <button
                      key={pkg}
                      type="button"
                      disabled={adminCreditPool < pkg}
                      onClick={() => handleStudioWalletAddCredits(pkg)}
                      className="min-h-[44px] py-2 px-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 disabled:opacity-40 text-white font-mono font-extrabold text-xs shadow-sm active:scale-95 transition flex items-center justify-center gap-1"
                    >
                      <i className="fa-solid fa-plus text-[10px]"></i>
                      <span>{pkg}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Credit Amount Add & Exact Balance Set */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Transfer Custom Amount from Pool
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      value={customCreditAddInput}
                      onChange={(e) => setCustomCreditAddInput(e.target.value)}
                      placeholder="e.g. 100"
                      className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        handleStudioWalletAddCredits(
                          Math.max(1, parseInt(customCreditAddInput, 10) || 100)
                        )
                      }
                      className="min-h-[40px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold whitespace-nowrap transition"
                    >
                      + Transfer
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Set Studio Wallet Balance
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100000}
                      value={exactCreditSetInput}
                      onChange={(e) => setExactCreditSetInput(e.target.value)}
                      placeholder="e.g. 100"
                      className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        handleStudioWalletSetExact(
                          Math.max(0, parseInt(exactCreditSetInput, 10) || 0)
                        )
                      }
                      className="min-h-[40px] px-4 rounded-xl bg-[#070a14] hover:bg-slate-800 text-cyan-300 text-xs font-extrabold whitespace-nowrap transition"
                    >
                      Set Balance
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Credit Recharge Audit Log */}
            <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-xs flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Credit Distribution & Pool History
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Audit trail of credits distributed from your Admin Pool
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono text-[11px] font-bold">
                    {creditLogs.length} Logs
                  </span>
                </div>

                {creditLogs.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400">
                    No credit transactions logged in this session yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                    {creditLogs.slice(0, 12).map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-800 truncate">
                            {log.targetName}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {log.targetEmail} · {new Date(log.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div
                            className={`font-mono font-extrabold ${
                              log.action === 'add'
                                ? 'text-emerald-600'
                                : log.action === 'deduct'
                                ? 'text-amber-600'
                                : 'text-cyan-700'
                            }`}
                          >
                            {log.action === 'add'
                              ? `+${log.amount}`
                              : log.action === 'deduct'
                              ? `-${log.amount}`
                              : `Set: ${log.amount}`}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">
                            Bal: {log.balanceAfter}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 1: USER MANAGEMENT, CREATE USER ID & PASSWORD, & CREDIT DISTRIBUTION
         ===================================================================== */}
      {adminTab === 'users' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                  Create User ID &amp; Password · Account &amp; Credit Management
                </h2>
                <span className="px-2.5 py-0.5 rounded-lg bg-cyan-50 text-cyan-800 border border-cyan-200 font-mono text-xs font-extrabold">
                  Admin Pool Available: {adminCreditPool} Credits
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Create custom User ID &amp; Password for customers/operators, assign credits from your Admin Pool, or update existing user passwords.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAddUserForm((v) => !v)}
              className="min-h-[42px] px-4 py-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white text-xs font-extrabold transition flex items-center gap-2 self-start sm:self-auto shadow-xs"
            >
              <i className={`fa-solid ${showAddUserForm ? 'fa-chevron-up' : 'fa-user-plus'}`}></i>
              <span>
                {showAddUserForm ? 'Hide Create ID & Password Form' : '+ Create User ID & Password'}
              </span>
            </button>
          </div>

          {poolActionNotice && (
            <div
              className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 ${
                poolActionNotice.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <span>{poolActionNotice.text}</span>
              <button
                type="button"
                onClick={() => setPoolActionNotice(null)}
                className="text-[11px] underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* CREATE NEW USER ID & PASSWORD FORM */}
          {showAddUserForm && (
            <form
              onSubmit={handleAddUserSubmit}
              className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-[#070a14] via-slate-900 to-[#130d26] text-white border border-cyan-500/40 space-y-4 shadow-lg"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                    <i className="fa-solid fa-id-badge"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">
                      Create New User ID &amp; Password
                    </h3>
                    <p className="text-[11px] text-slate-300">
                      Set a custom User ID (or Email) and Password. The user can immediately log in on the website using these credentials.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      generateAutoUserIdFromName();
                      generateRandomUserPassword();
                    }}
                    className="min-h-[34px] px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-cyan-300 text-[11px] font-extrabold transition flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                    <span>Auto-Generate ID &amp; Password</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Full Name */}
                <div>
                  <label className="block text-[11px] font-extrabold text-cyan-300 mb-1">
                    1. User Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => {
                      setNewUserName(e.target.value);
                      if (!newUserCustomId) {
                        const slug = e.target.value
                          .trim()
                          .toLowerCase()
                          .replace(/[^a-z0-9]/g, '')
                          .slice(0, 12);
                        if (slug.length >= 3) {
                          setNewUserCustomId(`${slug}01`);
                        }
                      }
                    }}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full min-h-[42px] px-3.5 py-2 text-xs bg-slate-950 border border-slate-700 text-white rounded-xl focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* 2. User ID / Username */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-extrabold text-amber-300">
                      2. User ID (Login ID) *
                    </label>
                    <button
                      type="button"
                      onClick={() => generateAutoUserIdFromName()}
                      className="text-[10px] font-bold text-cyan-300 hover:underline"
                    >
                      Auto ID
                    </button>
                  </div>
                  <input
                    type="text"
                    required={!newUserEmail}
                    value={newUserCustomId}
                    onChange={(e) => setNewUserCustomId(e.target.value.replace(/\s+/g, ''))}
                    placeholder="e.g. ramesh01"
                    className="w-full min-h-[42px] px-3.5 py-2 text-xs font-mono font-bold bg-slate-950 border border-amber-400/50 text-amber-200 rounded-xl focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* 3. Password */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-extrabold text-emerald-300">
                      3. Login Password (Min 6 chars) *
                    </label>
                    <button
                      type="button"
                      onClick={generateRandomUserPassword}
                      className="text-[10px] font-bold text-emerald-300 hover:underline"
                    >
                      Generate Pass
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showNewUserPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="e.g. Studio@2026"
                      className="w-full min-h-[42px] pl-3.5 pr-9 py-2 text-xs font-mono font-bold bg-slate-950 border border-emerald-400/50 text-emerald-200 rounded-xl focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewUserPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                      title="Show / Hide Password"
                    >
                      <i className={`fa-solid ${showNewUserPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>

                {/* 4. Email Address (Optional if User ID is provided) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    4. Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder={
                      newUserCustomId
                        ? `${newUserCustomId.toLowerCase()}@studio.user`
                        : 'ramesh@gmail.com'
                    }
                    className="w-full min-h-[42px] px-3.5 py-2 text-xs bg-slate-950 border border-slate-700 text-white rounded-xl focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end pt-1">
                {/* 5. Mobile / WhatsApp Number */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    5. Mobile / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full min-h-[42px] px-3.5 py-2 text-xs bg-slate-950 border border-slate-700 text-white rounded-xl focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* 6. Give Credits */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    6. Initial Credits (Pool: {adminCreditPool})
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={adminCreditPool}
                    value={newUserInitialCredits}
                    onChange={(e) => setNewUserInitialCredits(e.target.value)}
                    className="w-full min-h-[42px] px-3.5 py-2 text-xs font-mono font-bold bg-slate-950 border border-slate-700 text-cyan-300 rounded-xl focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* 7. Account Role */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    7. Account Role
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as 'user' | 'admin')}
                    className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-950 border border-slate-700 text-white rounded-xl"
                  >
                    <option value="user">Standard User</option>
                    <option value="admin">Studio Admin</option>
                  </select>
                </div>

                {/* 8. Initial Status */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    8. Account Status
                  </label>
                  <select
                    value={newUserStatus}
                    onChange={(e) => setNewUserStatus(e.target.value as AccountStatus)}
                    className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-950 border border-slate-700 text-white rounded-xl"
                  >
                    <option value="approved">Approved (Active)</option>
                    <option value="pending">Pending Approval</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>

                {/* Submit Button */}
                <div>
                  <button
                    type="submit"
                    disabled={isCreatingManagedUser}
                    className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50 text-slate-950 text-xs font-extrabold transition shadow-md flex items-center justify-center gap-1.5"
                  >
                    <i
                      className={`fa-solid ${
                        isCreatingManagedUser ? 'fa-spinner fa-spin' : 'fa-user-check'
                      }`}
                    ></i>
                    <span>
                      {isCreatingManagedUser
                        ? 'Creating Account...'
                        : 'Create User ID & Password'}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* NEWLY CREATED USER CREDENTIALS SHARE BANNER */}
          {lastCreatedUserCreds && (
            <div className="p-4 rounded-2xl bg-emerald-950 text-white border-2 border-emerald-400/60 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-md">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-500 text-slate-950 text-[10px] font-extrabold uppercase">
                    ✓ New User ID &amp; Password Created
                  </span>
                  <span className="text-sm font-extrabold text-white">
                    {lastCreatedUserCreds.displayName}
                  </span>
                  <span className="text-xs font-mono text-emerald-300">
                    ({lastCreatedUserCreds.credits} Credits Active)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono pt-1">
                  <span className="px-3 py-1 rounded-lg bg-white/10 border border-white/15 text-amber-300 font-bold">
                    User ID: {lastCreatedUserCreds.userId}
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-white/10 border border-white/15 text-cyan-300 font-bold">
                    Email: {lastCreatedUserCreds.email}
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-white/10 border border-white/15 text-emerald-300 font-bold">
                    Password: {lastCreatedUserCreds.password}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const msg = `Studio Login Credentials for ${lastCreatedUserCreds.displayName}:\nWebsite: ${baseOrigin}\nUser ID: ${lastCreatedUserCreds.userId}\nEmail: ${lastCreatedUserCreds.email}\nPassword: ${lastCreatedUserCreds.password}\nCredits: ${lastCreatedUserCreds.credits}`;
                    navigator.clipboard?.writeText(msg);
                    showToast('Copied User ID & Password to clipboard!');
                  }}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white text-slate-950 hover:bg-slate-100 text-xs font-extrabold transition flex items-center gap-1.5"
                >
                  <i className="fa-regular fa-copy"></i>
                  <span>Copy ID &amp; Password</span>
                </button>
                <a
                  href={`https://wa.me/${(lastCreatedUserCreds.phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `Hello ${lastCreatedUserCreds.displayName},\nYour Studio Account is ready!\n\nLogin URL: ${baseOrigin}\nUser ID: ${lastCreatedUserCreds.userId}\nEmail: ${lastCreatedUserCreds.email}\nPassword: ${lastCreatedUserCreds.password}\nAvailable Credits: ${lastCreatedUserCreds.credits}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold transition flex items-center gap-1.5"
                >
                  <i className="fa-brands fa-whatsapp"></i>
                  <span>Send on WhatsApp</span>
                </a>
                <button
                  type="button"
                  onClick={() => setLastCreatedUserCreds(null)}
                  className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-300"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Search & Status Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users by name, User ID, email, phone, or UID..."
                className="w-full min-h-[44px] pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(['all', 'pending', 'approved', 'blocked', 'removed'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-[#070a14] text-cyan-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'all' ? `All (${users.length})` : st}
                </button>
              ))}
            </div>
          </div>

          {/* Users Table / Responsive Cards */}
          {filteredUsers.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
              <i className="fa-solid fa-users-slash text-2xl text-slate-300"></i>
              <p className="text-xs font-bold text-slate-600">No matching users found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((u) => {
                const resolvedUidLogin =
                  u.userId || (u.email.includes('@') ? u.email.split('@')[0] : u.email);
                const isPassRevealed = Boolean(revealedPasswords[u.uid]);

                return (
                  <div
                    key={u.uid}
                    className="p-4 rounded-2xl border border-slate-200 hover:border-cyan-300 transition bg-slate-50/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-purple-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                        {(u.displayName || u.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-extrabold text-slate-900 truncate">
                            {u.displayName || 'Unnamed User'}
                          </span>
                          {getStatusBadge(u.status)}
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                              u.role === 'admin'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {u.role}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-mono text-[10px] font-extrabold">
                            <i className="fa-solid fa-coins mr-1 text-amber-600"></i>
                            {typeof u.credits === 'number' ? u.credits : 5} Credits
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300 font-mono text-[11px] font-bold">
                            ID: {resolvedUidLogin}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-emerald-300 font-mono text-[11px] font-bold inline-flex items-center gap-1.5">
                            <span>
                              Pass:{' '}
                              {u.loginPassword
                                ? isPassRevealed
                                  ? u.loginPassword
                                  : '••••••••'
                                : 'Not Set'}
                            </span>
                            {u.loginPassword && (
                              <button
                                type="button"
                                onClick={() =>
                                  setRevealedPasswords((prev) => ({
                                    ...prev,
                                    [u.uid]: !prev[u.uid],
                                  }))
                                }
                                className="text-slate-300 hover:text-white"
                                title="Show / Hide Password"
                              >
                                <i
                                  className={`fa-solid ${
                                    isPassRevealed ? 'fa-eye-slash' : 'fa-eye'
                                  } text-[10px]`}
                                ></i>
                              </button>
                            )}
                          </span>
                          <span>
                            <i className="fa-regular fa-envelope mr-1 text-slate-400"></i>
                            {u.email}
                          </span>
                          {u.phone && (
                            <span>
                              <i className="fa-solid fa-phone mr-1 text-slate-400"></i>
                              {u.phone}
                            </span>
                          )}
                          <span className="font-mono text-[11px] text-slate-400">
                            Joined: {formatDateString(u.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Admin Account Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {u.loginPassword && (
                        <button
                          type="button"
                          onClick={() => {
                            const text = `Studio Login\nUser ID: ${resolvedUidLogin}\nEmail: ${u.email}\nPassword: ${u.loginPassword}`;
                            navigator.clipboard?.writeText(text);
                            showToast(`Copied ID & Password for ${u.displayName}!`);
                          }}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 text-xs font-extrabold transition flex items-center gap-1.5"
                          title="Copy User ID & Password"
                        >
                          <i className="fa-regular fa-copy"></i>
                          <span>Copy ID/Pass</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUserModal(u);
                          setModalEditUserId(resolvedUidLogin);
                          setModalEditPassword(u.loginPassword || '');
                        }}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold transition flex items-center gap-1.5"
                        title="Set or Change User ID & Password"
                      >
                        <i className="fa-solid fa-key"></i>
                        <span>Set ID / Pass</span>
                      </button>

                      <button
                        type="button"
                        disabled={adminCreditPool < 25}
                        onClick={() => handleAdjustUserCredits(u, 'add', 25)}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-extrabold transition flex items-center gap-1"
                        title="Give +25 Credits from Website Admin Pool"
                      >
                        <i className="fa-solid fa-plus text-[10px]"></i>
                        <span>Give 25</span>
                      </button>

                      <button
                        type="button"
                        disabled={adminCreditPool < 100}
                        onClick={() => handleAdjustUserCredits(u, 'add', 100)}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-extrabold transition flex items-center gap-1"
                        title="Give +100 Credits from Website Admin Pool"
                      >
                        <i className="fa-solid fa-plus text-[10px]"></i>
                        <span>Give 100</span>
                      </button>

                      <button
                        onClick={() => setAdminTab('credits')}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold transition flex items-center gap-1.5"
                        title="Open Full Credit Pool Distributor"
                      >
                        <i className="fa-solid fa-coins"></i>
                        <span>Custom Credits</span>
                      </button>

                      {u.status !== 'approved' && (
                        <button
                          onClick={() => onUpdateUserStatus(u.uid, 'approved')}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                          title="Approve User Account"
                        >
                          <i className="fa-solid fa-check"></i>
                          <span>Approve</span>
                        </button>
                      )}

                      {u.status === 'pending' && (
                        <button
                          onClick={() => onUpdateUserStatus(u.uid, 'removed')}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-bold transition flex items-center gap-1.5"
                          title="Reject User Registration"
                        >
                          <i className="fa-solid fa-xmark"></i>
                          <span>Reject</span>
                        </button>
                      )}

                      {u.status !== 'blocked' ? (
                        <button
                          onClick={() => onUpdateUserStatus(u.uid, 'blocked')}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold transition flex items-center gap-1.5"
                          title="Block User Account"
                        >
                          <i className="fa-solid fa-ban"></i>
                          <span>Block</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onUpdateUserStatus(u.uid, 'approved')}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-cyan-100 hover:bg-cyan-200 text-cyan-900 text-xs font-bold transition flex items-center gap-1.5"
                          title="Unblock User Account"
                        >
                          <i className="fa-solid fa-unlock"></i>
                          <span>Unblock</span>
                        </button>
                      )}

                      <button
                        onClick={() =>
                          onUpdateUserRole(u.uid, u.role === 'admin' ? 'user' : 'admin')
                        }
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition"
                        title="Toggle Admin / User Role"
                      >
                        {u.role === 'admin' ? 'Make User' : 'Make Admin'}
                      </button>

                      <button
                        onClick={() => onDeleteUserRecord(u.uid)}
                        className="min-h-[38px] min-w-[38px] rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center transition"
                        title="Remove / Delete User Account"
                      >
                        <i className="fa-solid fa-trash-can text-xs"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 1.2: CUSTOM POSTER TEMPLATES BUILDER & MANAGER
         ===================================================================== */}
      {adminTab === 'templates' && (
        <div className="space-y-5">
          <div className="bg-[#070a14] text-white rounded-3xl p-5 sm:p-6 border border-cyan-500/40 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 text-white flex items-center justify-center text-xl shrink-0">
                <i className="fa-solid fa-wand-magic-sparkles"></i>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-extrabold text-white">
                    Custom Poster Templates Manager
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-400/30">
                    {customTemplates.length} Custom Templates Active
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                  Add your own custom Wedding, Anniversary, Engagement, Birthday, Memorial, or Festival templates with custom background artwork, photo frame layout, and default editable text. Every template created here appears immediately in the Poster Maker on the website!
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Form: Add New Custom Template */}
            <form
              onSubmit={handleCreateCustomTemplate}
              className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-xs"
            >
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-700">
                    Create New Template
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Add Custom Poster Template to Website
                  </h3>
                </div>
                <input
                  ref={customTplBgInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCustomTemplateBgUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => customTplBgInputRef.current?.click()}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#070a14] hover:bg-slate-800 text-amber-300 text-xs font-extrabold transition flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-image"></i>
                  <span>
                    {tplBgImageDataUrl ? 'Change Background Image' : 'Upload Background Artwork'}
                  </span>
                </button>
              </div>

              {tplBgImageDataUrl && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={tplBgImageDataUrl}
                      alt="Custom Template Background"
                      className="w-14 h-16 object-cover rounded-xl border border-emerald-300"
                    />
                    <div>
                      <div className="text-xs font-extrabold text-emerald-950">
                        Custom Background Design Attached
                      </div>
                      <div className="text-[11px] text-emerald-700">
                        User photos &amp; editable text will be layered on top of this artwork.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTplBgImageDataUrl('')}
                    className="px-2.5 py-1 rounded-lg bg-white text-rose-600 border border-rose-200 text-xs font-bold"
                  >
                    Remove Image
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Template Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                    placeholder="e.g. Royal Gold Couple Wedding Card"
                    className="w-full min-h-[42px] px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={tplCategory}
                    onChange={(e) => setTplCategory(e.target.value as any)}
                    className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="wedding">Wedding Invitation</option>
                    <option value="anniversary">Wedding Anniversary</option>
                    <option value="engagement">Engagement</option>
                    <option value="birthday">Birthday</option>
                    <option value="memorial">Memorial / Condolence</option>
                    <option value="festival">Festival Greeting</option>
                    <option value="housewarming">Housewarming</option>
                    <option value="baby-congrats">Baby &amp; Congrats</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Photo &amp; Text Layout Preset
                  </label>
                  <select
                    value={tplLayoutPreset}
                    onChange={(e) => setTplLayoutPreset(e.target.value as any)}
                    className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="left-photo-right-text">Left Photo + Right Text</option>
                    <option value="center-arch-photo">Center Arch Photo + Bottom Text</option>
                    <option value="top-circle-photo">Top Circle Photo + Bottom Text</option>
                    <option value="dual-couple-photos">Dual Couple Photos (2 Frames)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Photo Frame Shape
                  </label>
                  <select
                    value={tplSlotShape}
                    onChange={(e) => setTplSlotShape(e.target.value as any)}
                    className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="arch">Royal Arch Frame</option>
                    <option value="rounded">Rounded Portrait Frame</option>
                    <option value="circle">Circular Medallion</option>
                    <option value="oval">Classic Oval Frame</option>
                    <option value="rect">Rectangular Frame</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Badge Label
                  </label>
                  <input
                    type="text"
                    value={tplBadge}
                    onChange={(e) => setTplBadge(e.target.value)}
                    placeholder="Admin Custom HD"
                    className="w-full min-h-[42px] px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    BG Top Color
                  </label>
                  <input
                    type="color"
                    value={tplBgColor1}
                    onChange={(e) => setTplBgColor1(e.target.value)}
                    className="w-full h-10 rounded-xl cursor-pointer border border-slate-300 bg-white p-1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    BG Mid Color
                  </label>
                  <input
                    type="color"
                    value={tplBgColor2}
                    onChange={(e) => setTplBgColor2(e.target.value)}
                    className="w-full h-10 rounded-xl cursor-pointer border border-slate-300 bg-white p-1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    BG Bottom Color
                  </label>
                  <input
                    type="color"
                    value={tplBgColor3}
                    onChange={(e) => setTplBgColor3(e.target.value)}
                    className="w-full h-10 rounded-xl cursor-pointer border border-slate-300 bg-white p-1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Gold / Accent Color
                  </label>
                  <input
                    type="color"
                    value={tplPrimaryAccent}
                    onChange={(e) => setTplPrimaryAccent(e.target.value)}
                    className="w-full h-10 rounded-xl cursor-pointer border border-slate-300 bg-white p-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Default Top Headline
                  </label>
                  <input
                    type="text"
                    value={tplHeadline}
                    onChange={(e) => setTplHeadline(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Default Main Names / Title
                  </label>
                  <input
                    type="text"
                    value={tplNames}
                    onChange={(e) => setTplNames(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Default Invitation / Tribute Message
                  </label>
                  <input
                    type="text"
                    value={tplSubText}
                    onChange={(e) => setTplSubText(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Default Date &amp; Time
                  </label>
                  <input
                    type="text"
                    value={tplDateTime}
                    onChange={(e) => setTplDateTime(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Default Venue / Location
                  </label>
                  <input
                    type="text"
                    value={tplVenue}
                    onChange={(e) => setTplVenue(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full min-h-[46px] py-2.5 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-plus-circle"></i>
                <span>Add Custom Template to Website Poster Maker</span>
              </button>
            </form>

            {/* Right List: Existing Custom Templates */}
            <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Your Custom Poster Templates ({customTemplates.length})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Live in the Poster Maker alongside the 48 built-in studio templates
                  </p>
                </div>
              </div>

              {customTemplates.length === 0 ? (
                <div className="py-12 text-center space-y-2 text-slate-400">
                  <i className="fa-solid fa-wand-magic-sparkles text-2xl text-slate-300"></i>
                  <p className="text-xs font-bold text-slate-500">
                    No custom templates added yet.
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Use the form on the left to upload a custom background or create a new template layout for your users.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                  {customTemplates.map((ct) => (
                    <div
                      key={ct.id}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-12 h-14 rounded-xl border border-slate-300 shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-extrabold text-white"
                          style={{
                            background: ct.bgImageDataUrl
                              ? `url(${ct.bgImageDataUrl}) center/cover no-repeat`
                              : `linear-gradient(135deg, ${ct.bgColors[0]}, ${ct.bgColors[1]}, ${ct.bgColors[2]})`,
                          }}
                        >
                          {!ct.bgImageDataUrl && 'TPL'}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-slate-900 truncate">
                            {ct.name}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-cyan-700">{ct.categoryLabel}</span>
                            <span>·</span>
                            <span>{ct.layoutPreset}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomTemplate(ct.id)}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold shrink-0"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 1.5: TOOLS & CATEGORIES MANAGER (STUDIO, AKSHAYA, MEDIA & LIVE)
         ===================================================================== */}
      {adminTab === 'tools' && (
        <form
          onSubmit={handleSettingsSubmit}
          className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-5 shadow-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Platform Tools & Category Visibility Manager
              </h2>
              <p className="text-xs text-slate-500">
                Enable or disable tool categories, control individual tool visibility, and edit tool names & descriptions across Studio Tools, Akshaya Tools, and Media & Live Tools.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFormSettings((prev) => ({
                    ...prev,
                    enableStudioToolsCategory: true,
                    enableAkshayaToolsCategory: true,
                    enableMediaLiveToolsCategory: true,
                    toolCatalog: DEFAULT_TOOL_CATALOG,
                  }));
                  showToast('Restored default tool catalog');
                }}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Reset Catalog
              </button>
              <button
                type="submit"
                disabled={isSavingSettings}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white text-xs font-extrabold shadow-xs flex items-center gap-1.5"
              >
                <i className="fa-solid fa-floppy-disk"></i>
                <span>{isSavingSettings ? 'Saving...' : 'Save Tool Settings'}</span>
              </button>
            </div>
          </div>

          {/* 3 Main Category Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                key: 'enableStudioToolsCategory',
                title: '1. Studio Tools Category',
                sub: 'Passport Photo, Resize, Print Sheet, AI BG & Clarity',
                icon: 'fa-camera-retro',
                accent: 'border-cyan-200 bg-cyan-50/50',
              },
              {
                key: 'enableAkshayaToolsCategory',
                title: '2. Akshaya Tools Category',
                sub: 'PDF Merge, Split, Compress, Batch Image & Signature Resize',
                icon: 'fa-file-shield',
                accent: 'border-blue-200 bg-blue-50/50',
              },
              {
                key: 'enableMediaLiveToolsCategory',
                title: '3. Media & Live Tools Category',
                sub: '15 Broadcast, YouTube, Wedding/Church/Funeral, OBS & Video Tools',
                icon: 'fa-tower-broadcast',
                accent: 'border-purple-200 bg-purple-50/50',
              },
            ].map((cat) => (
              <label
                key={cat.key}
                className={`p-4 rounded-2xl border ${cat.accent} flex items-center justify-between gap-3 cursor-pointer`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#070a14] text-cyan-300 flex items-center justify-center shrink-0">
                    <i className={`fa-solid ${cat.icon}`}></i>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-slate-900 truncate">
                      {cat.title}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{cat.sub}</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={(formSettings as any)[cat.key] !== false}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      [cat.key]: e.target.checked,
                    })
                  }
                  className="w-5 h-5 accent-cyan-600 rounded shrink-0"
                />
              </label>
            ))}
          </div>

          {/* Filter by Category Bar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: `All Tools (${(formSettings.toolCatalog || DEFAULT_TOOL_CATALOG).length})` },
                { id: 'studio', label: 'Studio Tools (7)' },
                { id: 'akshaya', label: 'Akshaya Tools (5)' },
                { id: 'media-live', label: 'Media & Live Tools (15)' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setToolCategoryFilter(f.id as any)}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    toolCategoryFilter === f.id
                      ? 'bg-[#070a14] text-cyan-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Editable Tool List */}
          <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
            {(formSettings.toolCatalog || DEFAULT_TOOL_CATALOG)
              .filter(
                (t) => toolCategoryFilter === 'all' || t.category === toolCategoryFilter
              )
              .map((tool: ToolCatalogItem) => (
                <div
                  key={tool.id}
                  className={`p-3.5 rounded-2xl border transition grid grid-cols-1 lg:grid-cols-12 gap-3 items-center ${
                    tool.enabled
                      ? 'bg-slate-50/70 border-slate-200'
                      : 'bg-rose-50/30 border-rose-200 opacity-75'
                  }`}
                >
                  <div className="lg:col-span-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#070a14] text-cyan-300 flex items-center justify-center shrink-0">
                      <i className={`fa-solid ${tool.icon}`}></i>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-900 truncate">
                        {tool.name}
                      </div>
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-700">
                        {tool.category}
                      </span>
                    </div>
                  </div>

                  <div className="lg:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                      Tool Display Name
                    </label>
                    <input
                      type="text"
                      value={tool.name}
                      onChange={(e) => {
                        const updated = (
                          formSettings.toolCatalog || DEFAULT_TOOL_CATALOG
                        ).map((item) =>
                          item.id === tool.id ? { ...item, name: e.target.value } : item
                        );
                        setFormSettings({ ...formSettings, toolCatalog: updated });
                      }}
                      className="w-full min-h-[38px] px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div className="lg:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                      Tool Description
                    </label>
                    <input
                      type="text"
                      value={tool.description}
                      onChange={(e) => {
                        const updated = (
                          formSettings.toolCatalog || DEFAULT_TOOL_CATALOG
                        ).map((item) =>
                          item.id === tool.id
                            ? { ...item, description: e.target.value }
                            : item
                        );
                        setFormSettings({ ...formSettings, toolCatalog: updated });
                      }}
                      className="w-full min-h-[38px] px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div className="lg:col-span-3 flex items-center justify-end gap-1.5 flex-wrap">
                    <label
                      className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 text-[11px] font-extrabold cursor-pointer flex items-center gap-1 transition"
                      title="Upload or Redesign Custom Tool Thumbnail Image"
                    >
                      <i className="fa-solid fa-image"></i>
                      <span>{tool.thumbnailUrl ? 'Change Thumb' : 'Upload Thumb'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const dataUrl = ev.target?.result as string;
                            if (!dataUrl) return;
                            const updated = (
                              formSettings.toolCatalog || DEFAULT_TOOL_CATALOG
                            ).map((item) =>
                              item.id === tool.id ? { ...item, thumbnailUrl: dataUrl } : item
                            );
                            setFormSettings({ ...formSettings, toolCatalog: updated });
                            showToast(`Thumbnail updated for ${tool.name}! Click Save to apply.`);
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        const updated = (
                          formSettings.toolCatalog || DEFAULT_TOOL_CATALOG
                        ).map((item) =>
                          item.id === tool.id ? { ...item, enabled: !item.enabled } : item
                        );
                        setFormSettings({ ...formSettings, toolCatalog: updated });
                      }}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
                        tool.enabled
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      <i
                        className={`fa-solid ${
                          tool.enabled ? 'fa-eye' : 'fa-eye-slash'
                        }`}
                      ></i>
                      <span>{tool.enabled ? 'Enabled' : 'Hidden'}</span>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </form>
      )}

      {/* =====================================================================
          TAB 2: BRAND IDENTITY, COLOR CUSTOMIZATION & FOOTER CREDIT
         ===================================================================== */}
      {adminTab === 'branding' && (
        <form
          onSubmit={handleSettingsSubmit}
          className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-6 shadow-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Brand Name, Logo, Theme Colors & Footer Credit
              </h2>
              <p className="text-xs text-slate-500">
                Customize the MALNADU MEDIA brand identity, logo image, theme colors, and footer credit text dynamically.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFormSettings(DEFAULT_SITE_SETTINGS);
                showToast('Restored default MALNADU MEDIA settings');
              }}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold self-start sm:self-auto"
            >
              Reset to Default
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Brand Name & Logo Settings */}
            <div className="space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                1. Brand Identity & Logo
              </h3>

              {/* Live Logo Preview Banner */}
              <div className="p-3 rounded-2xl bg-[#070a14] border border-cyan-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-11 px-2 py-0.5 rounded-xl bg-[#070a14] border border-cyan-400/40 flex items-center justify-center overflow-hidden">
                    <img
                      src={formSettings.logoUrl || '/assets/aistudio/IMG-20261029-WA0055_86fec676.jpg'}
                      alt="Logo Preview"
                      className="h-full w-auto max-w-[110px] object-contain"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-white">
                      {formSettings.brandName || 'MALNADU MEDIA'}
                    </div>
                    <div className="text-[10px] text-cyan-300">
                      {formSettings.brandTagline || 'CAPTURING | CREATING | CONNECTING'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => logoFileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-[11px] font-bold"
                >
                  Upload Logo
                </button>
                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileUpload}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Website Brand Name
                </label>
                <input
                  type="text"
                  required
                  value={formSettings.brandName}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, brandName: e.target.value })
                  }
                  placeholder="MALNADU MEDIA"
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm font-bold bg-white border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Brand Subtitle / Tagline
                </label>
                <input
                  type="text"
                  value={formSettings.brandTagline}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, brandTagline: e.target.value })
                  }
                  placeholder="CAPTURING | CREATING | CONNECTING"
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Logo Display Mode
                  </label>
                  <select
                    value={formSettings.logoType}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        logoType: e.target.value as 'svg' | 'url',
                      })
                    }
                    className="w-full min-h-[44px] px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl"
                  >
                    <option value="url">Image Logo (Butterfly Camera)</option>
                    <option value="svg">Monogram Badge (MM)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Logo Monogram Text
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={formSettings.logoText}
                    onChange={(e) =>
                      setFormSettings({ ...formSettings, logoText: e.target.value })
                    }
                    placeholder="MM"
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm font-bold bg-white border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {formSettings.logoType === 'url' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Logo Image Path / URL
                  </label>
                  <input
                    type="text"
                    value={formSettings.logoUrl}
                    onChange={(e) =>
                      setFormSettings({ ...formSettings, logoUrl: e.target.value })
                    }
                    placeholder="/assets/aistudio/IMG-20261029-WA0055_86fec676.jpg"
                    className="w-full min-h-[44px] px-3.5 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl"
                  />
                </div>
              )}
            </div>

            {/* Theme Color Customization & Configurable Footer Credit */}
            <div className="space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                2. Theme Colors & Configurable Footer Credit
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Primary Brand Color
                  </label>
                  <div className="flex items-center gap-2 h-[44px] px-3 bg-white border border-slate-200 rounded-xl">
                    <input
                      type="color"
                      value={formSettings.primaryColor}
                      onChange={(e) =>
                        setFormSettings({ ...formSettings, primaryColor: e.target.value })
                      }
                      className="w-7 h-7 rounded cursor-pointer border-0"
                    />
                    <span className="text-xs font-mono font-bold text-slate-700">
                      {formSettings.primaryColor}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Header / Dark Accent
                  </label>
                  <div className="flex items-center gap-2 h-[44px] px-3 bg-white border border-slate-200 rounded-xl">
                    <input
                      type="color"
                      value={formSettings.secondaryColor}
                      onChange={(e) =>
                        setFormSettings({ ...formSettings, secondaryColor: e.target.value })
                      }
                      className="w-7 h-7 rounded cursor-pointer border-0"
                    />
                    <span className="text-xs font-mono font-bold text-slate-700">
                      {formSettings.secondaryColor}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Configurable Footer Credit Text
                </label>
                <input
                  type="text"
                  required
                  value={formSettings.footerCredit}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, footerCredit: e.target.value })
                  }
                  placeholder="Designed & Developed by MALNADU MEDIA"
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm font-bold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  This credit text is displayed dynamically in the website footer across all pages.
                </p>
              </div>
            </div>
          </div>

          {/* SEO Metadata & Feature Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                3. Browser Tab Title & SEO Metadata
              </h3>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Browser Tab Title
                </label>
                <input
                  type="text"
                  value={formSettings.seoTitle}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, seoTitle: e.target.value })
                  }
                  className="w-full min-h-[42px] px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Meta Description
                </label>
                <textarea
                  rows={2}
                  value={formSettings.seoDescription}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, seoDescription: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                4. Platform Feature Visibility
              </h3>
              <div className="space-y-2.5 text-xs font-bold text-slate-800">
                {[
                  { key: 'enablePassportStudio', label: 'Passport Size Photo Studio' },
                  { key: 'enableBgRemover', label: 'Dedicated Background Remover' },
                  { key: 'enableClarityEnhancer', label: 'Photo Clarity Enhancer' },
                  { key: 'enableQrGenerator', label: 'QR Code Generator' },
                  { key: 'enableLinkShortener', label: 'Custom Link Shortener' },
                ].map((feat) => (
                  <label
                    key={feat.key}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer"
                  >
                    <span>{feat.label}</span>
                    <input
                      type="checkbox"
                      checked={(formSettings as any)[feat.key]}
                      onChange={(e) =>
                        setFormSettings({
                          ...formSettings,
                          [feat.key]: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-cyan-600 rounded"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSavingSettings}
              className="min-h-[48px] px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-sm shadow-sm transition flex items-center gap-2"
            >
              <i className="fa-solid fa-floppy-disk"></i>
              <span>{isSavingSettings ? 'Saving Configuration...' : 'Save All Website Settings'}</span>
            </button>
          </div>
        </form>
      )}

      {/* =====================================================================
          TAB 3: SHORT LINKS MANAGER
         ===================================================================== */}
      {adminTab === 'links' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Platform Short Links ({shortLinks.length})
              </h2>
              <p className="text-xs text-slate-500">
                Monitor, enable/disable, or remove custom redirect slugs
              </p>
            </div>
          </div>

          {shortLinks.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No short links created yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-extrabold uppercase text-slate-400">
                    <th className="py-3 px-3">Short Slug</th>
                    <th className="py-3 px-3">Destination URL</th>
                    <th className="py-3 px-3">Created By</th>
                    <th className="py-3 px-3">Clicks</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shortLinks.map((l) => (
                    <tr key={l.slug} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-mono font-bold text-cyan-700">
                        {baseOrigin}/{l.slug}
                      </td>
                      <td className="py-3 px-3 max-w-xs truncate text-slate-600">
                        {l.originalUrl}
                      </td>
                      <td className="py-3 px-3 text-slate-500">{l.creatorEmail || 'Studio'}</td>
                      <td className="py-3 px-3 font-mono font-bold">{l.clicks || 0}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            l.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {l.active ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right space-x-1.5">
                        <button
                          onClick={() => onToggleShortLinkStatus(l.slug, l.active)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700"
                        >
                          {l.active ? 'Disable' : 'Activate'}
                        </button>
                        <button
                          onClick={() => onDeleteShortLink(l.slug)}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 4: APPOINTMENTS & ID VERIFICATIONS
         ===================================================================== */}
      {adminTab === 'operations' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Appointments */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-base font-extrabold text-slate-900">
              Studio Appointments ({appointments.length})
            </h2>
            {appointments.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No appointments booked.</p>
            ) : (
              <div className="space-y-3">
                {appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-3.5 rounded-2xl border border-slate-200 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-900">
                        {apt.userName} ({apt.userEmail})
                      </span>
                      <span className="text-[11px] font-mono font-bold uppercase text-cyan-700">
                        {apt.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">
                      {apt.serviceType} · {apt.appointmentDate} @ {apt.timeSlot}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      {(['confirmed', 'completed', 'cancelled'] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => onUpdateAppointmentStatus(apt.id, st, apt.notes)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold capitalize"
                        >
                          Mark {st}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Document Verifications */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-base font-extrabold text-slate-900">
              ID Document Verifications ({verifications.length})
            </h2>
            {verifications.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No documents submitted.</p>
            ) : (
              <div className="space-y-3">
                {verifications.map((ver) => (
                  <div
                    key={ver.id}
                    className="p-3.5 rounded-2xl border border-slate-200 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-900">
                        {ver.userName} · {ver.documentType} ({ver.documentNumber})
                      </span>
                      <span className="text-[11px] font-mono font-bold uppercase text-cyan-700">
                        {ver.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      {(['under_review', 'verified', 'rejected'] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() =>
                            onUpdateVerificationStatus(
                              ver.id,
                              st,
                              st === 'verified' ? 'Verified by MALNADU MEDIA Admin' : ver.remarks
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold capitalize"
                        >
                          {st.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Details & Set ID / Password Modal */}
      {selectedUserModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                User Account &amp; ID / Password Settings
              </h3>
              <button
                onClick={() => setSelectedUserModal(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Full Name:</span>
                <span className="font-bold text-slate-900">{selectedUserModal.displayName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Email Address:</span>
                <span className="font-mono font-bold text-slate-900">{selectedUserModal.email}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Phone:</span>
                <span className="font-mono text-slate-900">{selectedUserModal.phone || 'Not provided'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">User UID:</span>
                <span className="font-mono text-[11px] text-slate-500">{selectedUserModal.uid}</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-slate-500">Current Status:</span>
                {getStatusBadge(selectedUserModal.status)}
              </div>
            </div>

            {/* Set / Update User ID & Password Box */}
            <div className="p-3.5 rounded-2xl bg-slate-900 text-white space-y-3 border border-cyan-500/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-cyan-300 flex items-center gap-1.5">
                  <i className="fa-solid fa-key text-amber-300"></i>
                  <span>Set / Change User ID &amp; Password</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
                    let pass = 'St@';
                    for (let i = 0; i < 6; i++) {
                      pass += chars.charAt(Math.floor(Math.random() * chars.length));
                    }
                    setModalEditPassword(pass);
                  }}
                  className="text-[10px] font-bold text-emerald-300 hover:underline"
                >
                  Auto-Generate Pass
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-1">
                    User ID (Login ID)
                  </label>
                  <input
                    type="text"
                    value={modalEditUserId}
                    onChange={(e) => setModalEditUserId(e.target.value.replace(/\s+/g, ''))}
                    placeholder="e.g. ramesh01"
                    className="w-full min-h-[38px] px-3 py-1.5 text-xs font-mono font-bold bg-slate-950 border border-slate-700 text-amber-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-1">
                    New Password (Min 6 chars)
                  </label>
                  <input
                    type="text"
                    value={modalEditPassword}
                    onChange={(e) => setModalEditPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full min-h-[38px] px-3 py-1.5 text-xs font-mono font-bold bg-slate-950 border border-slate-700 text-emerald-300 rounded-xl"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  const cleanId = modalEditUserId.trim();
                  const cleanPass = modalEditPassword.trim();
                  if (!cleanId) {
                    showToast('Please enter a valid User ID.');
                    return;
                  }
                  if (cleanPass.length < 6) {
                    showToast('Password must be at least 6 characters.');
                    return;
                  }
                  if (onUpdateUserCredentials) {
                    await onUpdateUserCredentials(selectedUserModal.uid, cleanId, cleanPass);
                  }
                  setSelectedUserModal({
                    ...selectedUserModal,
                    userId: cleanId,
                    loginPassword: cleanPass,
                  });
                }}
                className="w-full min-h-[40px] rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white text-xs font-extrabold transition shadow-xs"
              >
                Save User ID &amp; Password
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={async () => {
                  await onUpdateUserStatus(selectedUserModal.uid, 'approved');
                  setSelectedUserModal({ ...selectedUserModal, status: 'approved' });
                }}
                className="min-h-[42px] rounded-xl bg-emerald-600 text-white text-xs font-bold"
              >
                Approve / Activate
              </button>
              <button
                onClick={async () => {
                  await onUpdateUserStatus(selectedUserModal.uid, 'blocked');
                  setSelectedUserModal({ ...selectedUserModal, status: 'blocked' });
                }}
                className="min-h-[42px] rounded-xl bg-amber-500 text-slate-950 text-xs font-bold"
              >
                Block Account
              </button>
              <button
                onClick={async () => {
                  await onUpdateUserStatus(selectedUserModal.uid, 'removed');
                  setSelectedUserModal({ ...selectedUserModal, status: 'removed' });
                }}
                className="min-h-[42px] rounded-xl bg-rose-100 text-rose-800 text-xs font-bold"
              >
                Mark Removed
              </button>
              <button
                onClick={async () => {
                  await onDeleteUserRecord(selectedUserModal.uid);
                  setSelectedUserModal(null);
                }}
                className="min-h-[42px] rounded-xl bg-rose-600 text-white text-xs font-bold"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sticky Bottom Admin Navigation Bar for Fast Phone Control */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#070a14]/95 backdrop-blur-md border-t border-cyan-500/40 grid grid-cols-5 items-center h-16 px-1 select-none">
        {[
          { id: 'credits', label: 'Credits', icon: 'fa-coins' },
          { id: 'users', label: 'Users', icon: 'fa-users-gear' },
          { id: 'tools', label: 'Tools', icon: 'fa-layer-group' },
          { id: 'branding', label: 'Branding', icon: 'fa-palette' },
          { id: 'operations', label: 'Orders', icon: 'fa-calendar-check' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setAdminTab(item.id as AdminTab)}
            className={`min-h-[48px] flex flex-col items-center justify-center transition ${
              adminTab === item.id ? 'text-cyan-400 font-extrabold' : 'text-slate-400'
            }`}
          >
            <i className={`fa-solid ${item.icon} text-sm`}></i>
            <span className="text-[10px] mt-1">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};
