import React, { useState, useEffect } from 'react';
import {
  ADMIN_ACCOUNT_HOLDER,
  ADMIN_QR_IMAGE_PATH,
  ADMIN_UPI_ID,
  CreditRechargeLog,
  DEFAULT_ADMIN_WHATSAPP,
  appendCreditRechargeLog,
  generateSignedRechargeCode,
  loadCreditRechargeLogs,
  rechargeWalletWithPin,
  redeemSignedRechargeCode,
  setExactWalletCreditsWithPassword,
  updateAdminMasterPassword,
  verifyAdminSecretPin,
} from '../creditWallet';
import { UserProfile } from '../constants';

interface CreditQrAndOwnerPortalProps {
  isOpen: boolean;
  initialMode: 'client_qr' | 'owner_admin';
  availableCredits: number;
  isQuotaExhausted?: boolean;
  users?: UserProfile[];
  contactPhone?: string;
  onClose: () => void;
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
  availableCredits,
  isQuotaExhausted = false,
  users = [],
  contactPhone,
  onClose,
  onCreditsUpdated,
  onUpdateUserCredits,
  showToast,
}) => {
  const [mode, setMode] = useState<'client_qr' | 'owner_admin'>(initialMode);
  const [selectedPkg, setSelectedPkg] = useState(CREDIT_PACKAGES[1]);
  const [couponInput, setCouponInput] = useState('');
  const [couponStatus, setCouponStatus] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Owner Separate Credit Admin State
  const [isOwnerUnlocked, setIsOwnerUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [ownerAuthError, setOwnerAuthError] = useState<string | null>(null);

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
    setOwnerActionBanner(null);
  }, [initialMode, isOpen]);

  useEffect(() => {
    setExactBalanceInput(String(availableCredits));
  }, [availableCredits]);

  if (!isOpen) return null;

  const adminWhatsApp = DEFAULT_ADMIN_WHATSAPP || contactPhone || '+91 75810 30272';
  const cleanWhatsAppDigits = adminWhatsApp.replace(/[^0-9]/g, '');

  const handleCopyUpiId = () => {
    navigator.clipboard?.writeText(ADMIN_UPI_ID);
    showToast(`UPI ID Copied: ${ADMIN_UPI_ID}`);
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
      setOwnerAuthError('Invalid Strong Master Password! Only Shriyansh Singh Rajpoot can unlock this panel.');
      return;
    }
    setIsOwnerUnlocked(true);
    setCreditLogs(loadCreditRechargeLogs());
    showToast('Separate Credit Admin Panel Unlocked');
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

  const copyOwnerSecretUrl = () => {
    const url = `${window.location.origin}${window.location.pathname}?credit-admin=1`;
    navigator.clipboard?.writeText(url);
    showToast('Secret Credit Admin URL Copied!');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* =====================================================================
          MODE 1: CLIENT UPI QR CODE RECHARGE MODAL (Shown on Website Header)
         ===================================================================== */}
      {mode === 'client_qr' && (
        <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-cyan-200 space-y-5 my-auto max-h-[94vh] overflow-y-auto">
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
                      ? 'Credit Quota Exhausted — Scan QR to Add Credits'
                      : 'Add Studio Credits — Scan UPI QR Code'}
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Pay directly via UPI QR Code to recharge your AI Passport Cutout Wallet
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

          {/* Main 2-Column Layout: Left = Uploaded Slice QR Code, Right = Packages + Redeem + WhatsApp */}
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
                  Works with GPay, PhonePe, Paytm, Slice & all UPI Apps
                </p>
              </div>
            </div>

            {/* Right Column: Package Selection, WhatsApp Confirmation & Instant Recharge Code Input */}
            <div className="md:col-span-7 space-y-4">
              {/* Step 1: Choose Credit Plan */}
              <div className="space-y-2">
                <div className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                  <span>1. Select Credit Recharge Pack</span>
                  <span className="text-[11px] font-semibold text-purple-600">Instant Activation</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {CREDIT_PACKAGES.map((pkg) => {
                    const isSelected = selectedPkg.credits === pkg.credits;
                    return (
                      <button
                        key={pkg.credits}
                        type="button"
                        onClick={() => setSelectedPkg(pkg)}
                        className={`p-3 rounded-2xl border text-left transition relative ${
                          isSelected
                            ? 'bg-purple-50/90 border-purple-500 ring-2 ring-purple-500/20'
                            : 'bg-white hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm font-extrabold text-slate-900 tabular-nums">
                            +{pkg.credits} Photos
                          </span>
                          <span className="font-mono text-xs font-extrabold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md tabular-nums">
                            {pkg.price}
                          </span>
                        </div>
                        <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
                          {pkg.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Send Payment Screenshot on WhatsApp to Receive Credits */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2.5">
                <div className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                  <i className="fa-brands fa-whatsapp text-emerald-600 text-sm"></i>
                  <span>2. Scan QR & Send Payment Screenshot on WhatsApp</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Scan the QR code to pay{' '}
                  <strong className="font-mono">{selectedPkg.price}</strong> for{' '}
                  <strong className="font-mono">+{selectedPkg.credits} Photos</strong> to{' '}
                  <strong>{ADMIN_ACCOUNT_HOLDER}</strong> (<span className="font-mono">{ADMIN_UPI_ID}</span>), then click below to get your Recharge Code on WhatsApp:
                </p>
                <a
                  href={`https://wa.me/${cleanWhatsAppDigits}?text=${encodeURIComponent(
                    `Hello ${ADMIN_ACCOUNT_HOLDER}, I have paid ${selectedPkg.price} via UPI QR (${ADMIN_UPI_ID}) for +${selectedPkg.credits} Studio Photo Credits. Please send my Recharge Code.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 transition"
                >
                  <i className="fa-brands fa-whatsapp text-base"></i>
                  <span>
                    Send Payment Details on WhatsApp ({adminWhatsApp})
                  </span>
                </a>
              </div>

              {/* Step 3: Enter Recharge Code Received from Owner */}
              <form
                onSubmit={handleRedeemCoupon}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5"
              >
                <label className="block text-xs font-extrabold text-slate-800">
                  3. Enter Recharge Activation Code (Received after Payment)
                </label>
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
            </div>
          </div>

          {/* Footer Bar with Discreet Owner Credit Admin Access */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-[11px] text-slate-400">
              UPI Verified Merchant: {ADMIN_ACCOUNT_HOLDER} ({ADMIN_UPI_ID})
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode('owner_admin');
                  setOwnerAuthError(null);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-[11px] flex items-center gap-1.5 transition"
                title="Dedicated Owner Credit Admin Panel (Password Protected)"
              >
                <i className="fa-solid fa-user-shield text-amber-400"></i>
                <span>Owner Credit Admin Panel</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODE 2: SEPARATE STANDALONE CREDIT ADMIN PANEL (FOR OWNER ONLY)
         ===================================================================== */}
      {mode === 'owner_admin' && (
        <div className="bg-[#070a14] text-white rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-amber-500/40 space-y-5 my-auto max-h-[94vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 flex items-center justify-center text-white text-lg shadow-md">
                <i className="fa-solid fa-vault"></i>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-extrabold text-white">
                    Separate Credit Admin Portal — {ADMIN_ACCOUNT_HOLDER}
                  </h3>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-extrabold uppercase">
                    Owner Only
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Dedicated Credit Control Vault • Shortcut: Alt+A or ?credit-admin=1
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('client_qr')}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <i className="fa-solid fa-qrcode"></i>
                <span>View Client QR</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center transition"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          {!isOwnerUnlocked ? (
            /* PASSWORD GATE FOR OWNER */
            <form onSubmit={handleOwnerUnlockSubmit} className="max-w-md mx-auto py-6 space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-amber-500/30 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center text-xl mx-auto">
                  <i className="fa-solid fa-lock"></i>
                </div>
                <h4 className="text-sm font-extrabold text-white">
                  Enter Strong Master Password
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  This separate Credit Admin Panel is exclusively for{' '}
                  <strong className="text-white">{ADMIN_ACCOUNT_HOLDER}</strong> to add studio credits and generate client recharge codes.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Admin Master Password
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
                <span>Unlock Separate Credit Admin Panel</span>
              </button>
            </form>
          ) : (
            /* UNLOCKED SEPARATE OWNER CREDIT ADMIN CONSOLE */
            <div className="space-y-5">
              {/* Top Status Strip */}
              <div className="p-4 rounded-2xl bg-white/5 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center">
                    <i className="fa-solid fa-wallet"></i>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Current Website Wallet Balance
                    </div>
                    <div className="font-mono text-xl font-extrabold text-emerald-400 tabular-nums">
                      {availableCredits} Photos
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={copyOwnerSecretUrl}
                    className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition"
                    title="Copy direct link to open this Separate Credit Admin Panel anytime"
                  >
                    <i className="fa-solid fa-link"></i>
                    <span>Copy Secret Admin Link</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsOwnerUnlocked(false);
                      setPasswordInput('');
                    }}
                    className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/40 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <i className="fa-solid fa-lock"></i>
                    <span>Lock Vault</span>
                  </button>
                </div>
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

              {/* Grid: 1. Direct Instant Credit Add (This Device) & 2. Generate Recharge Code for Client QR Payment */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Box 1: Direct Add Credits on This Website/Browser */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                      <i className="fa-solid fa-bolt"></i>
                      <span>1. Instant Add Credits (Direct)</span>
                    </h4>
                    <span className="text-[10px] text-slate-400">Immediate Top-Up</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[25, 50, 100, 250, 500, 800, 1000, 5000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleOwnerQuickAdd(amt)}
                        className="min-h-[40px] py-2 px-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-mono font-extrabold text-xs shadow-xs active:scale-95 transition"
                      >
                        +{amt}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      value={customAddAmount}
                      onChange={(e) => setCustomAddAmount(e.target.value)}
                      placeholder="Custom Credits"
                      className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        handleOwnerQuickAdd(Math.max(1, parseInt(customAddAmount, 10) || 100))
                      }
                      className="min-h-[40px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition whitespace-nowrap"
                    >
                      + Add Custom
                    </button>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100000}
                      value={exactBalanceInput}
                      onChange={(e) => setExactBalanceInput(e.target.value)}
                      placeholder="Set Exact Balance"
                      className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleOwnerSetExact}
                      className="min-h-[40px] px-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold transition whitespace-nowrap"
                    >
                      Set Exact
                    </button>
                  </div>
                </div>

                {/* Box 2: Generate One-Time Recharge Code for Clients Paying via QR Code */}
                <div className="p-4 rounded-2xl bg-white/5 border border-amber-500/30 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <i className="fa-solid fa-ticket"></i>
                      <span>2. Client QR Payment Recharge Code</span>
                    </h4>
                    <span className="text-[10px] text-amber-200/80">One-Time Use</span>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    When a client scans your Slice QR Code (<span className="font-mono text-amber-300">{ADMIN_UPI_ID}</span>) and pays, click below to generate a 1-time Recharge Code & send it to them on WhatsApp:
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
                      className="min-h-[40px] px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition whitespace-nowrap"
                    >
                      Generate Code
                    </button>
                  </div>

                  {generatedCode && (
                    <div className="p-3 rounded-xl bg-slate-900 border border-amber-400/50 space-y-2">
                      <div className="flex items-center justify-between gap-2">
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
                    </div>
                  )}
                </div>
              </div>

              {/* Registered Users Credit Table (If users exist) */}
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

              {/* Bottom Collapsible / Compact Row: Change Strong Password & Recent Logs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <form
                  onSubmit={handleChangeMasterPassword}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2.5"
                >
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                    Update Master Admin Password
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
                    className="w-full min-h-[38px] rounded-xl bg-white/10 hover:bg-white/20 text-amber-300 text-xs font-extrabold transition"
                  >
                    Save New Master Password
                  </button>
                </form>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                    Recent Credit Recharge History
                  </h4>
                  <div className="max-h-32 overflow-y-auto divide-y divide-white/10 text-[11px]">
                    {creditLogs.length === 0 ? (
                      <div className="text-slate-500 py-4 text-center">No credit logs yet.</div>
                    ) : (
                      creditLogs.slice(0, 8).map((log) => (
                        <div key={log.id} className="py-1.5 flex items-center justify-between gap-2">
                          <div className="truncate">
                            <span className="font-bold text-slate-200">{log.targetName}</span>
                            <span className="text-slate-500 ml-1.5">({log.targetEmail})</span>
                          </div>
                          <span className="font-mono font-bold text-emerald-400 shrink-0 tabular-nums">
                            {log.action === 'set' ? `=${log.amount}` : `+${log.amount}`} ({log.balanceAfter})
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
