import React, { useState, useEffect, useRef } from 'react';
import {
  ADMIN_ACCOUNT_HOLDER,
  ADMIN_QR_IMAGE_PATH,
  ADMIN_UPI_ID,
  CreditRechargeLog,
  DEFAULT_ADMIN_WHATSAPP,
  PaymentCreditRequest,
  appendCreditRechargeLog,
  approveClientPaymentRequest,
  generateSignedRechargeCode,
  loadCreditRechargeLogs,
  loadPaymentCreditRequests,
  rechargeWalletWithPin,
  redeemSignedRechargeCode,
  rejectClientPaymentRequest,
  setExactWalletCreditsWithPassword,
  submitClientPaymentRequest,
  updateAdminMasterPassword,
  verifyAdminSecretPin,
} from '../creditWallet';
import { UserProfile } from '../constants';

interface CreditQrAndOwnerPortalProps {
  isOpen: boolean;
  initialMode: 'client_qr' | 'owner_admin';
  standalonePage?: boolean;
  availableCredits: number;
  isQuotaExhausted?: boolean;
  users?: UserProfile[];
  currentUserProfile?: UserProfile | null;
  contactPhone?: string;
  onClose: () => void;
  onSwitchToWebsiteAdmin?: () => void;
  onCreditsUpdated: (newBalance: number) => void;
  onUpdateUserCredits?: (uid: string, newCredits: number) => Promise<void>;
  showToast: (msg: string) => void;
}

const CREDIT_PACKAGES = [
  { credits: 100, label: 'Starter Pack', price: '₹99', popular: false },
  { credits: 500, label: 'Studio Pro Pack', price: '₹299', popular: true },
  { credits: 800, label: 'High-Volume Pack', price: '₹449', popular: false },
  { credits: 1000, label: 'Mega Studio Pack', price: '₹499', popular: false },
];

export const CreditQrAndOwnerPortal: React.FC<CreditQrAndOwnerPortalProps> = ({
  isOpen,
  initialMode,
  standalonePage = false,
  availableCredits,
  isQuotaExhausted = false,
  users = [],
  currentUserProfile = null,
  contactPhone,
  onClose,
  onSwitchToWebsiteAdmin,
  onCreditsUpdated,
  onUpdateUserCredits,
  showToast,
}) => {
  const [mode, setMode] = useState<'client_qr' | 'owner_admin'>(initialMode);
  const [selectedPkg, setSelectedPkg] = useState(CREDIT_PACKAGES[1]);
  const [clientTab, setClientTab] = useState<'submit_request' | 'redeem_code'>('submit_request');

  // Client Payment Request Form State
  const [reqClientName, setReqClientName] = useState(currentUserProfile?.displayName || '');
  const [reqClientContact, setReqClientContact] = useState(
    currentUserProfile?.phone || currentUserProfile?.email || ''
  );
  const [reqUtrNumber, setReqUtrNumber] = useState('');
  const [reqNote, setReqNote] = useState('');
  const [reqScreenshotUrl, setReqScreenshotUrl] = useState<string>('');
  const [reqSubmitBanner, setReqSubmitBanner] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);
  const screenshotInputRef = useRef<HTMLInputElement | null>(null);

  // Client Recharge Code Redemption State
  const [couponInput, setCouponInput] = useState('');
  const [couponStatus, setCouponStatus] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  // Payment Requests Queue State
  const [paymentRequests, setPaymentRequests] = useState<PaymentCreditRequest[]>(() =>
    loadPaymentCreditRequests()
  );
  const [requestFilter, setRequestFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>(
    'pending'
  );

  // Owner Separate Credit & Payment Admin State
  const [isOwnerUnlocked, setIsOwnerUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [ownerAuthError, setOwnerAuthError] = useState<string | null>(null);
  const [ownerSubTab, setOwnerSubTab] = useState<
    'requests' | 'direct_credits' | 'codes_users' | 'security_logs'
  >('requests');

  // Owner Credit Controls
  const [customAddAmount, setCustomAddAmount] = useState('500');
  const [exactBalanceInput, setExactBalanceInput] = useState(String(availableCredits));
  const [ownerActionBanner, setOwnerActionBanner] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  // Signed Recharge Code Generator State
  const [couponGenAmount, setCouponGenAmount] = useState('500');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  // Password Change State
  const [currentPassForChange, setCurrentPassForChange] = useState('');
  const [newPassForChange, setNewPassForChange] = useState('');
  const [confirmPassForChange, setConfirmPassForChange] = useState('');

  // User Credit Search
  const [userSearch, setUserSearch] = useState('');
  const [creditLogs, setCreditLogs] = useState<CreditRechargeLog[]>(() => loadCreditRechargeLogs());

  useEffect(() => {
    setMode(initialMode);
    setCouponStatus(null);
    setReqSubmitBanner(null);
    setOwnerActionBanner(null);
    setPaymentRequests(loadPaymentCreditRequests());
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (currentUserProfile) {
      if (!reqClientName) setReqClientName(currentUserProfile.displayName || '');
      if (!reqClientContact)
        setReqClientContact(currentUserProfile.phone || currentUserProfile.email || '');
    }
  }, [currentUserProfile]);

  useEffect(() => {
    setExactBalanceInput(String(availableCredits));
  }, [availableCredits]);

  useEffect(() => {
    const syncRequests = () => {
      setPaymentRequests(loadPaymentCreditRequests());
    };
    window.addEventListener('malnadu-payment-requests-updated', syncRequests);
    return () => window.removeEventListener('malnadu-payment-requests-updated', syncRequests);
  }, []);

  if (!isOpen) return null;

  const adminWhatsApp = DEFAULT_ADMIN_WHATSAPP || contactPhone || '+91 75810 30272';
  const cleanWhatsAppDigits = adminWhatsApp.replace(/[^0-9]/g, '');
  const pendingRequestsCount = paymentRequests.filter((r) => r.status === 'pending').length;

  const handleCopyUpiId = () => {
    navigator.clipboard?.writeText(ADMIN_UPI_ID);
    showToast(`UPI ID Copied: ${ADMIN_UPI_ID}`);
  };

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setReqScreenshotUrl(dataUrl);
        showToast('Payment screenshot attached!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitPaymentRequestForm = (e: React.FormEvent) => {
    e.preventDefault();
    setReqSubmitBanner(null);

    if (!reqClientName.trim()) {
      setReqSubmitBanner({ type: 'error', text: 'Please enter your name.' });
      return;
    }
    if (!reqUtrNumber.trim() && !reqScreenshotUrl) {
      setReqSubmitBanner({
        type: 'error',
        text: 'Please enter your UPI UTR / Transaction ID or attach a payment screenshot.',
      });
      return;
    }

    const created = submitClientPaymentRequest({
      clientName: reqClientName.trim(),
      clientContact: reqClientContact.trim() || 'Direct Website Client',
      userId: currentUserProfile?.uid,
      packageLabel: selectedPkg.label,
      creditsRequested: selectedPkg.credits,
      amountInr: selectedPkg.price,
      utrNumber: reqUtrNumber.trim() || 'SCREENSHOT-ATTACHED',
      paymentNote: reqNote.trim(),
      paymentScreenshotDataUrl: reqScreenshotUrl || undefined,
    });

    setPaymentRequests(loadPaymentCreditRequests());
    setReqUtrNumber('');
    setReqNote('');
    setReqScreenshotUrl('');
    setReqSubmitBanner({
      type: 'success',
      text: `Payment Request (#${created.id.slice(-5).toUpperCase()}) for +${selectedPkg.credits} Photos submitted! Once the Administrator confirms your payment in the Credit & Payment Admin Panel, credits will be added immediately.`,
    });
    showToast(`Payment Request Submitted for +${selectedPkg.credits} Credits!`);
  };

  const handleRedeemCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponStatus(null);
    if (!couponInput.trim()) {
      setCouponStatus({ type: 'error', text: 'Please enter a valid Recharge Code.' });
      return;
    }
    const res = redeemSignedRechargeCode(couponInput);
    if (!res.ok) {
      setCouponStatus({ type: 'error', text: res.error || 'Invalid Recharge Code.' });
      return;
    }
    onCreditsUpdated(res.newBalance);
    setCreditLogs(loadCreditRechargeLogs());
    setCouponInput('');
    setCouponStatus({
      type: 'success',
      text: `Success! +${res.addedCredits} Credits added. New Balance: ${res.newBalance} Photos.`,
    });
    showToast(`Recharged +${res.addedCredits} Credits!`);
  };

  const handleOwnerUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOwnerAuthError(null);
    if (!verifyAdminSecretPin(passwordInput)) {
      setOwnerAuthError(
        'Invalid Strong Master Password! Only the authorized Administrator can unlock this panel.'
      );
      return;
    }
    setIsOwnerUnlocked(true);
    setCreditLogs(loadCreditRechargeLogs());
    setPaymentRequests(loadPaymentCreditRequests());
    showToast('Credit & Payment Confirmation Admin Panel Unlocked');
  };

  const handleConfirmClientPaymentRequest = async (reqItem: PaymentCreditRequest) => {
    setOwnerActionBanner(null);
    const res = approveClientPaymentRequest(passwordInput, reqItem.id);
    if (!res.ok) {
      setOwnerActionBanner({
        type: 'error',
        text: res.error || 'Could not confirm payment request.',
      });
      return;
    }

    onCreditsUpdated(res.newBalance);

    // If the request belongs to a registered user account, also update their user profile credits
    if (reqItem.userId && onUpdateUserCredits) {
      const matchedUser = users.find((u) => u.uid === reqItem.userId);
      if (matchedUser) {
        const currentCreds = typeof matchedUser.credits === 'number' ? matchedUser.credits : 25;
        await onUpdateUserCredits(matchedUser.uid, currentCreds + reqItem.creditsRequested);
      }
    }

    setPaymentRequests(loadPaymentCreditRequests());
    setCreditLogs(loadCreditRechargeLogs());
    setOwnerActionBanner({
      type: 'success',
      text: `Payment Confirmed for ${reqItem.clientName}! Added +${reqItem.creditsRequested} Credits to Website Wallet (New Balance: ${res.newBalance} Photos).`,
    });
    showToast(
      `Confirmed Payment & Added +${reqItem.creditsRequested} Credits! (Balance: ${res.newBalance})`
    );
  };

  const handleRejectClientPaymentRequest = (reqItem: PaymentCreditRequest) => {
    setOwnerActionBanner(null);
    const res = rejectClientPaymentRequest(passwordInput, reqItem.id);
    if (!res.ok) {
      setOwnerActionBanner({
        type: 'error',
        text: res.error || 'Could not reject payment request.',
      });
      return;
    }
    setPaymentRequests(loadPaymentCreditRequests());
    setOwnerActionBanner({
      type: 'error',
      text: `Marked payment request from ${reqItem.clientName} as Rejected.`,
    });
    showToast('Payment request marked as Rejected.');
  };

  const handleOwnerQuickAdd = (amount: number) => {
    setOwnerActionBanner(null);
    const res = rechargeWalletWithPin(passwordInput, amount);
    if (!res.ok) {
      setOwnerActionBanner({ type: 'error', text: res.error || 'Password verification failed.' });
      return;
    }
    onCreditsUpdated(res.newBalance);
    setCreditLogs(loadCreditRechargeLogs());
    setOwnerActionBanner({
      type: 'success',
      text: `Added +${amount} Credits! Current Website Balance: ${res.newBalance} Photos.`,
    });
    showToast(`+${amount} Credits Added (Total: ${res.newBalance} Photos)`);
  };

  const handleOwnerSetExact = () => {
    setOwnerActionBanner(null);
    const target = Math.max(0, parseInt(exactBalanceInput, 10) || 0);
    const res = setExactWalletCreditsWithPassword(passwordInput, target);
    if (!res.ok) {
      setOwnerActionBanner({ type: 'error', text: res.error || 'Password verification failed.' });
      return;
    }
    onCreditsUpdated(res.newBalance);
    setCreditLogs(loadCreditRechargeLogs());
    setOwnerActionBanner({
      type: 'success',
      text: `Exact Wallet Balance set to ${res.newBalance} Photos.`,
    });
    showToast(`Wallet Balance Set: ${res.newBalance} Photos`);
  };

  const handleGenerateClientCode = (amountOverride?: number) => {
    setOwnerActionBanner(null);
    const amt = amountOverride ?? Math.max(1, parseInt(couponGenAmount, 10) || 500);
    const res = generateSignedRechargeCode(passwordInput, amt);
    if (!res.ok || !res.code) {
      setOwnerActionBanner({ type: 'error', text: res.error || 'Could not generate code.' });
      return;
    }
    setGeneratedCode(res.code);
    navigator.clipboard?.writeText(res.code);
    setOwnerActionBanner({
      type: 'success',
      text: `Generated & Copied ${amt} Photos Recharge Code: ${res.code}`,
    });
    showToast(`Recharge Code Copied: ${res.code}`);
  };

  const handleChangeMasterPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setOwnerActionBanner(null);
    if (newPassForChange.trim() !== confirmPassForChange.trim()) {
      setOwnerActionBanner({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }
    const res = updateAdminMasterPassword(currentPassForChange, newPassForChange);
    if (!res.ok) {
      setOwnerActionBanner({ type: 'error', text: res.error || 'Failed to update password.' });
      return;
    }
    setPasswordInput(newPassForChange.trim());
    setCurrentPassForChange('');
    setNewPassForChange('');
    setConfirmPassForChange('');
    setOwnerActionBanner({
      type: 'success',
      text: 'Strong Master Password updated successfully!',
    });
    showToast('Master Password Updated!');
  };

  const filteredRequests = paymentRequests.filter((r) =>
    requestFilter === 'all' ? true : r.status === requestFilter
  );

  return (
    <div
      className={
        standalonePage
          ? 'max-w-5xl mx-auto px-3.5 sm:px-6 py-6'
          : 'fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto'
      }
    >
      {/* =====================================================================
          MODE 1: CLIENT UPI QR CODE & PAYMENT REQUEST SUBMISSION MODAL
         ===================================================================== */}
      {mode === 'client_qr' && (
        <div className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-cyan-200 space-y-5 my-auto max-h-[94vh] overflow-y-auto">
          {/* Top Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white text-lg shadow-sm ${
                  isQuotaExhausted || availableCredits <= 0
                    ? 'bg-gradient-to-br from-rose-500 to-orange-600'
                    : 'bg-gradient-to-br from-purple-600 via-indigo-600 to-cyan-500'
                }`}
              >
                <i className="fa-solid fa-qrcode"></i>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                    {isQuotaExhausted || availableCredits <= 0
                      ? 'Credit Quota Exhausted — Scan UPI QR to Recharge'
                      : 'Add Studio Photo Credits — Scan UPI QR & Submit Request'}
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Scan the official UPI QR code to pay and submit your payment request for instant credit approval.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
                <span>Balance:</span>
                <span
                  className={`font-mono font-extrabold tabular-nums ${
                    availableCredits > 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {availableCredits} Photos
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          {/* Main 2-Column Layout: Left = Uploaded Slice QR Code, Right = Packages + Submit Payment Request */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            {/* Left Column: Official Uploaded Slice UPI QR Code */}
            <div className="md:col-span-5 bg-slate-50 rounded-2xl p-4 border-2 border-purple-200/80 flex flex-col items-center text-center space-y-3 shadow-xs">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-100 text-purple-800 text-[11px] font-extrabold tracking-wide uppercase">
                <i className="fa-solid fa-bolt text-purple-600"></i>
                <span>Official UPI QR Code</span>
              </div>

              <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm w-full max-w-[230px] mx-auto">
                <img
                  src={ADMIN_QR_IMAGE_PATH}
                  alt={`UPI QR - ${ADMIN_ACCOUNT_HOLDER}`}
                  className="w-full h-auto rounded-xl object-contain"
                />
              </div>

              <div className="w-full space-y-1.5 pt-1">
                <div className="text-xs font-extrabold text-slate-900">
                  {ADMIN_ACCOUNT_HOLDER}
                </div>
                <div className="flex items-center justify-center gap-1.5 bg-white px-3 py-2 rounded-xl border border-slate-200">
                  <span className="font-mono text-xs font-extrabold text-purple-700 select-all">
                    {ADMIN_UPI_ID}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyUpiId}
                    className="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-[10px] font-extrabold transition"
                    title="Copy UPI ID"
                  >
                    <i className="fa-regular fa-copy mr-1"></i>
                    Copy
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Works with Google Pay, PhonePe, Paytm, Slice & all UPI Apps
                </p>
              </div>

              <a
                href={`https://wa.me/${cleanWhatsAppDigits}?text=${encodeURIComponent(
                  `Hello ${ADMIN_ACCOUNT_HOLDER}, I have paid ${selectedPkg.price} via UPI QR (${ADMIN_UPI_ID}) for +${selectedPkg.credits} Studio Photo Credits. Please confirm my payment and add credits.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[40px] py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] shadow-xs flex items-center justify-center gap-1.5 transition"
              >
                <i className="fa-brands fa-whatsapp text-sm"></i>
                <span>Notify Admin on WhatsApp</span>
              </a>
            </div>

            {/* Right Column: Package Selection + Submit Payment Request Form + Activation Code */}
            <div className="md:col-span-7 space-y-4">
              {/* Step 1: Choose Credit Plan */}
              <div className="space-y-2">
                <div className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                  <span>1. Select Credit Recharge Pack</span>
                  <span className="text-[11px] font-semibold text-purple-600">
                    Selected: +{selectedPkg.credits} Photos ({selectedPkg.price})
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CREDIT_PACKAGES.map((pkg) => {
                    const isSelected = selectedPkg.credits === pkg.credits;
                    return (
                      <button
                        key={pkg.credits}
                        type="button"
                        onClick={() => setSelectedPkg(pkg)}
                        className={`p-2.5 rounded-2xl border text-left transition relative ${
                          isSelected
                            ? 'bg-purple-50/90 border-purple-500 ring-2 ring-purple-500/20'
                            : 'bg-white hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="font-mono text-xs font-extrabold text-slate-900 tabular-nums">
                          +{pkg.credits}
                        </div>
                        <div className="font-mono text-[11px] font-extrabold text-purple-700 mt-0.5 tabular-nums">
                          {pkg.price}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-500 truncate">
                          {pkg.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Switch between Submit Payment Request vs Enter Activation Code */}
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-2xl text-xs font-extrabold">
                <button
                  type="button"
                  onClick={() => setClientTab('submit_request')}
                  className={`min-h-[38px] py-1.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 ${
                    clientTab === 'submit_request'
                      ? 'bg-[#070a14] text-cyan-300 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-paper-plane"></i>
                  <span>2. Submit Payment Request</span>
                </button>
                <button
                  type="button"
                  onClick={() => setClientTab('redeem_code')}
                  className={`min-h-[38px] py-1.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 ${
                    clientTab === 'redeem_code'
                      ? 'bg-[#070a14] text-amber-300 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-ticket"></i>
                  <span>Redeem Activation Code</span>
                </button>
              </div>

              {clientTab === 'submit_request' ? (
                <form
                  onSubmit={handleSubmitPaymentRequestForm}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900">
                      Send Payment Confirmation Request to Admin
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      +{selectedPkg.credits} Credits ({selectedPkg.price})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Your Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={reqClientName}
                        onChange={(e) => setReqClientName(e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Mobile Number or Email
                      </label>
                      <input
                        type="text"
                        value={reqClientContact}
                        onChange={(e) => setReqClientContact(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        UPI UTR / Transaction ID *
                      </label>
                      <input
                        type="text"
                        value={reqUtrNumber}
                        onChange={(e) => setReqUtrNumber(e.target.value)}
                        placeholder="12-digit UTR / Reference No."
                        className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-slate-300 font-mono text-xs font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Payment Screenshot (Optional)
                      </label>
                      <button
                        type="button"
                        onClick={() => screenshotInputRef.current?.click()}
                        className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5"
                      >
                        <i className="fa-solid fa-image text-purple-600"></i>
                        <span>
                          {reqScreenshotUrl ? 'Screenshot Attached ✓' : 'Upload Screenshot'}
                        </span>
                      </button>
                      <input
                        ref={screenshotInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleScreenshotUpload}
                        className="hidden"
                      />
                    </div>
                  </div>

                  <input
                    type="text"
                    value={reqNote}
                    onChange={(e) => setReqNote(e.target.value)}
                    placeholder="Optional note (e.g. Paid via Google Pay / PhonePe)"
                    className="w-full min-h-[36px] px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-800"
                  />

                  {reqSubmitBanner && (
                    <div
                      className={`p-2.5 rounded-xl text-xs font-bold ${
                        reqSubmitBanner.type === 'success'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      <i
                        className={`fa-solid ${
                          reqSubmitBanner.type === 'success'
                            ? 'fa-circle-check'
                            : 'fa-circle-exclamation'
                        } mr-1.5`}
                      ></i>
                      {reqSubmitBanner.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 transition"
                  >
                    <i className="fa-solid fa-paper-plane"></i>
                    <span>
                      Submit Payment Request (+{selectedPkg.credits} Photos · {selectedPkg.price})
                    </span>
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={handleRedeemCoupon}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  <label className="block text-xs font-extrabold text-slate-800">
                    Enter One-Time Recharge Activation Code
                  </label>
                  <p className="text-[11px] text-slate-500">
                    If the Administrator sent you a one-time activation code on WhatsApp, enter it below to add credits immediately:
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value);
                        setCouponStatus(null);
                      }}
                      placeholder="e.g. MM-500-AB12C-9F8E7D6C"
                      className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono text-xs uppercase focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="submit"
                      className="min-h-[42px] px-4 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-xs font-extrabold whitespace-nowrap shadow-xs transition"
                    >
                      Activate Credits
                    </button>
                  </div>

                  {couponStatus && (
                    <div
                      className={`p-2.5 rounded-xl text-xs font-bold ${
                        couponStatus.type === 'success'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      <i
                        className={`fa-solid ${
                          couponStatus.type === 'success'
                            ? 'fa-circle-check'
                            : 'fa-circle-exclamation'
                        } mr-1.5`}
                      ></i>
                      {couponStatus.text}
                    </div>
                  )}
                </form>
              )}

              {/* Live Payment Request Status Strip for Clients */}
              {paymentRequests.length > 0 && (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-700">
                    <span>Recent Payment Requests Status</span>
                    <span className="text-slate-400">{paymentRequests.length} Total</span>
                  </div>
                  <div className="max-h-28 overflow-y-auto divide-y divide-slate-200/70 text-[11px]">
                    {paymentRequests.slice(0, 4).map((req) => (
                      <div
                        key={req.id}
                        className="py-1.5 flex items-center justify-between gap-2"
                      >
                        <div className="truncate">
                          <span className="font-bold text-slate-800">{req.clientName}</span>
                          <span className="text-slate-500 ml-1.5">
                            (+{req.creditsRequested} Photos · {req.amountInr} · UTR: {req.utrNumber})
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase shrink-0 ${
                            req.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : req.status === 'rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {req.status === 'approved'
                            ? 'Confirmed & Credited'
                            : req.status === 'rejected'
                            ? 'Rejected'
                            : 'Pending Admin Approval'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Client Footer Bar (No Public Admin Links) */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-[11px] text-slate-400">
              UPI Verified Account: {ADMIN_ACCOUNT_HOLDER} ({ADMIN_UPI_ID})
            </span>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODE 2: SEPARATE PAYMENT CONFIRMATION & CREDIT ADMIN PANEL (/credit-admin)
         ===================================================================== */}
      {mode === 'owner_admin' && (
        <div
          className={`bg-[#070a14] text-white rounded-3xl w-full p-5 sm:p-6 shadow-2xl border border-amber-500/40 space-y-5 ${
            standalonePage ? '' : 'max-w-4xl my-auto max-h-[94vh] overflow-y-auto'
          }`}
        >
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-4 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 flex items-center justify-center text-white text-lg shadow-md">
                <i className="fa-solid fa-vault"></i>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-extrabold text-white">
                    Payment & Credit Confirmation Admin — {ADMIN_ACCOUNT_HOLDER}
                  </h3>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono text-[10px] font-extrabold">
                    /credit-admin
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Dedicated URL Path for confirming incoming client UPI payments and adding website credits.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onSwitchToWebsiteAdmin && (
                <button
                  type="button"
                  onClick={onSwitchToWebsiteAdmin}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 text-xs font-extrabold flex items-center gap-1.5 transition"
                >
                  <i className="fa-solid fa-sliders"></i>
                  <span>Go to /website-admin</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <i className="fa-solid fa-arrow-left"></i>
                <span>{standalonePage ? 'Back to Website' : 'Close'}</span>
              </button>
            </div>
          </div>

          {!isOwnerUnlocked ? (
            /* STRONG MASTER PASSWORD GATE FOR OWNER */
            <form onSubmit={handleOwnerUnlockSubmit} className="max-w-md mx-auto py-6 space-y-4">
              <div className="p-5 rounded-2xl bg-white/5 border border-amber-500/30 text-center space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center text-xl mx-auto">
                  <i className="fa-solid fa-lock"></i>
                </div>
                <h4 className="text-base font-extrabold text-white">
                  Protected by Strong Admin Master Password
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Enter your Strong Master Password to review incoming{' '}
                  <strong className="text-amber-300">
                    {pendingRequestsCount} Pending Payment{' '}
                    {pendingRequestsCount === 1 ? 'Request' : 'Requests'}
                  </strong>
                  , confirm UPI payments, and add credits to the website.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Strong Master Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswordText ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setOwnerAuthError(null);
                    }}
                    placeholder="Enter Strong Master Password..."
                    className="w-full min-h-[46px] pl-4 pr-11 py-2.5 rounded-2xl bg-slate-900 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordText((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                  >
                    <i className={`fa-solid ${showPasswordText ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              {ownerAuthError && (
                <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold">
                  <i className="fa-solid fa-circle-exclamation mr-1.5"></i>
                  {ownerAuthError}
                </div>
              )}

              <button
                type="submit"
                className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-extrabold text-sm shadow-lg transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-key"></i>
                <span>Unlock Payment & Credit Admin Panel</span>
              </button>
            </form>
          ) : (
            /* UNLOCKED SEPARATE OWNER PAYMENT & CREDIT ADMIN CONSOLE */
            <div className="space-y-5">
              {/* Top Status Strip */}
              <div className="p-4 rounded-2xl bg-white/5 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center">
                    <i className="fa-solid fa-wallet"></i>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Active Website Credit Balance
                    </div>
                    <div className="font-mono text-xl font-extrabold text-emerald-400 tabular-nums">
                      {availableCredits} Photos
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-extrabold flex items-center gap-1.5">
                    <i className="fa-solid fa-bell"></i>
                    <span>Pending Requests: {pendingRequestsCount}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsOwnerUnlocked(false);
                      setPasswordInput('');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-300 text-xs font-extrabold flex items-center gap-1.5 transition"
                  >
                    <i className="fa-solid fa-lock"></i>
                    <span>Lock Panel</span>
                  </button>
                </div>
              </div>

              {/* Navigation Sub-Tabs inside Payment & Credit Admin Panel */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10 text-xs font-extrabold">
                <button
                  type="button"
                  onClick={() => setOwnerSubTab('requests')}
                  className={`min-h-[40px] py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 ${
                    ownerSubTab === 'requests'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <i className="fa-solid fa-money-check-dollar"></i>
                  <span>Payment Requests ({pendingRequestsCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOwnerSubTab('direct_credits')}
                  className={`min-h-[40px] py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 ${
                    ownerSubTab === 'direct_credits'
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <i className="fa-solid fa-coins"></i>
                  <span>Direct Add Credits</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOwnerSubTab('codes_users')}
                  className={`min-h-[40px] py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 ${
                    ownerSubTab === 'codes_users'
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <i className="fa-solid fa-ticket"></i>
                  <span>Codes & User Quotas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOwnerSubTab('security_logs')}
                  className={`min-h-[40px] py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 ${
                    ownerSubTab === 'security_logs'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <i className="fa-solid fa-shield-halved"></i>
                  <span>Password & Logs</span>
                </button>
              </div>

              {ownerActionBanner && (
                <div
                  className={`p-3.5 rounded-2xl text-xs font-bold border ${
                    ownerActionBanner.type === 'success'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <i
                    className={`fa-solid ${
                      ownerActionBanner.type === 'success'
                        ? 'fa-circle-check'
                        : 'fa-circle-exclamation'
                    } mr-1.5`}
                  ></i>
                  {ownerActionBanner.text}
                </div>
              )}

              {/* ===============================================================
                  SUB-TAB 1: INCOMING CLIENT UPI PAYMENT REQUESTS & CONFIRMATION
                 =============================================================== */}
              {ownerSubTab === 'requests' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-extrabold text-white">
                        Client UPI Payment Confirmation Queue
                      </h4>
                      <p className="text-xs text-slate-400">
                        Verify the client's UPI payment ({ADMIN_UPI_ID}) and click "Confirm Payment & Add Credits" to immediately credit the website.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(['pending', 'approved', 'rejected', 'all'] as const).map((flt) => (
                        <button
                          key={flt}
                          type="button"
                          onClick={() => setRequestFilter(flt)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold uppercase transition ${
                            requestFilter === flt
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-white/10 text-slate-300 hover:bg-white/15'
                          }`}
                        >
                          {flt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredRequests.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-white/5 border border-white/10 text-center text-xs text-slate-400">
                      No {requestFilter === 'all' ? '' : requestFilter} payment requests found.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                      {filteredRequests.map((req) => (
                        <div
                          key={req.id}
                          className={`p-4 rounded-2xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                            req.status === 'pending'
                              ? 'bg-amber-500/10 border-amber-500/40'
                              : req.status === 'approved'
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : 'bg-white/5 border-white/10 opacity-75'
                          }`}
                        >
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-extrabold text-white">
                                {req.clientName}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-lg bg-purple-500/20 border border-purple-400/40 font-mono text-xs font-extrabold text-purple-300">
                                +{req.creditsRequested} Photos ({req.amountInr})
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                  req.status === 'pending'
                                    ? 'bg-amber-400 text-slate-950'
                                    : req.status === 'approved'
                                    ? 'bg-emerald-500 text-slate-950'
                                    : 'bg-rose-500 text-white'
                                }`}
                              >
                                {req.status}
                              </span>
                            </div>

                            <div className="text-xs text-slate-300 flex flex-wrap items-center gap-3">
                              <span>
                                <i className="fa-solid fa-phone mr-1 text-cyan-400"></i>
                                {req.clientContact}
                              </span>
                              <span className="font-mono font-bold text-amber-300">
                                UTR / Ref: {req.utrNumber}
                              </span>
                              <span className="text-slate-400">
                                {new Date(req.createdAt).toLocaleString()}
                              </span>
                            </div>

                            {req.paymentNote && (
                              <div className="text-xs text-slate-300 italic">
                                "{req.paymentNote}"
                              </div>
                            )}

                            {req.approvedCode && (
                              <div className="text-[11px] font-mono text-emerald-300">
                                Backup Activation Code: <strong>{req.approvedCode}</strong>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {req.paymentScreenshotDataUrl && (
                              <a
                                href={req.paymentScreenshotDataUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-cyan-300 text-xs font-bold flex items-center gap-1.5"
                              >
                                <i className="fa-solid fa-image"></i>
                                <span>View Screenshot</span>
                              </a>
                            )}

                            {req.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleConfirmClientPaymentRequest(req)}
                                  className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs shadow-md flex items-center gap-2 transition"
                                >
                                  <i className="fa-solid fa-circle-check"></i>
                                  <span>
                                    Confirm Payment & Add +{req.creditsRequested} Credits
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectClientPaymentRequest(req)}
                                  className="min-h-[42px] px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-xs transition"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ===============================================================
                  SUB-TAB 2: DIRECT INSTANT WEBSITE CREDIT TOP-UP
                 =============================================================== */}
              {ownerSubTab === 'direct_credits' && (
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-extrabold text-cyan-300">
                        Instant Website Credit Top-Up (Direct Balance Control)
                      </h4>
                      <p className="text-xs text-slate-400">
                        Add credits directly to the website header balance or set an exact number of credits.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[25, 50, 100, 250, 500, 800, 1000, 5000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleOwnerQuickAdd(amt)}
                        className="min-h-[44px] py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-mono font-extrabold text-xs shadow-xs active:scale-95 transition"
                      >
                        +{amt} Credits
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={100000}
                        value={customAddAmount}
                        onChange={(e) => setCustomAddAmount(e.target.value)}
                        placeholder="Custom Credits"
                        className="flex-1 min-h-[42px] px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleOwnerQuickAdd(Math.max(1, parseInt(customAddAmount, 10) || 100))
                        }
                        className="min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition whitespace-nowrap"
                      >
                        + Add Custom Credits
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100000}
                        value={exactBalanceInput}
                        onChange={(e) => setExactBalanceInput(e.target.value)}
                        placeholder="Set Exact Balance"
                        className="flex-1 min-h-[42px] px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleOwnerSetExact}
                        className="min-h-[42px] px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold transition whitespace-nowrap"
                      >
                        Set Exact Balance
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ===============================================================
                  SUB-TAB 3: CLIENT RECHARGE CODES & REGISTERED USER QUOTAS
                 =============================================================== */}
              {ownerSubTab === 'codes_users' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-amber-500/30 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                        <i className="fa-solid fa-ticket"></i>
                        <span>Generate One-Time Client Activation Code</span>
                      </h4>
                      <span className="text-[10px] text-amber-200/80">Cryptographically Signed</span>
                    </div>

                    <p className="text-xs text-slate-300">
                      Generate a one-time activation code to share with a remote client on WhatsApp after verifying their UPI payment:
                    </p>

                    <div className="grid grid-cols-4 gap-2">
                      {[100, 500, 800, 1000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => handleGenerateClientCode(amt)}
                          className="min-h-[38px] py-1.5 px-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 font-mono font-extrabold text-xs transition"
                        >
                          Code +{amt}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={100000}
                        value={couponGenAmount}
                        onChange={(e) => setCouponGenAmount(e.target.value)}
                        placeholder="Credits (e.g. 500)"
                        className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleGenerateClientCode()}
                        className="min-h-[40px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition whitespace-nowrap"
                      >
                        Generate Activation Code
                      </button>
                    </div>

                    {generatedCode && (
                      <div className="p-3 rounded-xl bg-slate-900 border border-amber-400/50 flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-extrabold text-amber-300 select-all">
                          {generatedCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(generatedCode);
                            showToast(`Copied: ${generatedCode}`);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-[11px] font-bold"
                        >
                          Copy Code
                        </button>
                      </div>
                    )}
                  </div>

                  {users.length > 0 && onUpdateUserCredits && (
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                          Registered Client Accounts — Direct Credit Allocation
                        </h4>
                        <input
                          type="text"
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          placeholder="Search user name or email..."
                          className="min-h-[34px] px-3 py-1 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                        />
                      </div>

                      <div className="max-h-44 overflow-y-auto divide-y divide-white/10">
                        {users
                          .filter(
                            (u) =>
                              u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
                              u.email?.toLowerCase().includes(userSearch.toLowerCase())
                          )
                          .map((u) => {
                            const userCreds = typeof u.credits === 'number' ? u.credits : 25;
                            return (
                              <div
                                key={u.uid}
                                className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                              >
                                <div>
                                  <div className="font-bold text-white">{u.displayName}</div>
                                  <div className="text-[11px] text-slate-400">{u.email}</div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-extrabold text-emerald-400 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 tabular-nums">
                                    {userCreds} Photos
                                  </span>
                                  {[100, 500].map((addAmt) => (
                                    <button
                                      key={addAmt}
                                      type="button"
                                      onClick={async () => {
                                        const next = userCreds + addAmt;
                                        await onUpdateUserCredits(u.uid, next);
                                        appendCreditRechargeLog({
                                          targetName: u.displayName || 'Client',
                                          targetEmail: u.email || u.uid,
                                          action: 'add',
                                          amount: addAmt,
                                          balanceAfter: next,
                                        });
                                        setCreditLogs(loadCreditRechargeLogs());
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 font-mono font-bold text-[11px]"
                                    >
                                      +{addAmt}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===============================================================
                  SUB-TAB 4: UPDATE STRONG MASTER PASSWORD & AUDIT LOGS
                 =============================================================== */}
              {ownerSubTab === 'security_logs' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <form
                    onSubmit={handleChangeMasterPassword}
                    className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3"
                  >
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                      Update Strong Master Admin Password
                    </h4>
                    <input
                      type="password"
                      value={currentPassForChange}
                      onChange={(e) => setCurrentPassForChange(e.target.value)}
                      placeholder="Current Master Password"
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="password"
                        value={newPassForChange}
                        onChange={(e) => setNewPassForChange(e.target.value)}
                        placeholder="New Strong Password"
                        className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                      />
                      <input
                        type="password"
                        value={confirmPassForChange}
                        onChange={(e) => setConfirmPassForChange(e.target.value)}
                        placeholder="Confirm Password"
                        className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full min-h-[40px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition"
                    >
                      Save New Strong Password
                    </button>
                  </form>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                      Recent Credit & Payment Confirmation History
                    </h4>
                    <div className="max-h-40 overflow-y-auto divide-y divide-white/10 text-[11px]">
                      {creditLogs.length === 0 ? (
                        <div className="text-slate-500 py-4 text-center">No credit logs yet.</div>
                      ) : (
                        creditLogs.slice(0, 12).map((log) => (
                          <div
                            key={log.id}
                            className="py-1.5 flex items-center justify-between gap-2"
                          >
                            <div className="truncate">
                              <span className="font-bold text-slate-200">{log.targetName}</span>
                              <span className="text-slate-500 ml-1.5">({log.targetEmail})</span>
                            </div>
                            <span className="font-mono font-bold text-emerald-400 shrink-0 tabular-nums">
                              {log.action === 'set' ? `=${log.amount}` : `+${log.amount}`} (
                              {log.balanceAfter})
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
