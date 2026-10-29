import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  AppointmentRecord,
  DocumentVerificationRecord,
  SavedPhotoRecord,
  SERVICE_TYPES,
  BRANCH_LOCATIONS,
  TIME_SLOTS,
  DOCUMENT_TYPES,
  COUNTRY_PRESETS,
} from '../constants';

interface UserDashboardProps {
  brandName: string;
  logoUrl?: string;
  userProfile: UserProfile;
  appointments: AppointmentRecord[];
  verifications: DocumentVerificationRecord[];
  savedPhotos: SavedPhotoRecord[];
  currentStudioPreviewUrl: string;
  initialSubTab?: 'overview' | 'appointments' | 'verifications' | 'photos' | 'profile';
  onBookAppointment: (data: {
    phone: string;
    serviceType: (typeof SERVICE_TYPES)[number];
    countrySpec: string;
    branchLocation: (typeof BRANCH_LOCATIONS)[number];
    appointmentDate: string;
    timeSlot: (typeof TIME_SLOTS)[number];
    notes: string;
  }) => Promise<void>;
  onCancelAppointment: (apt: AppointmentRecord) => Promise<void>;
  onSubmitVerification: (data: {
    documentType: (typeof DOCUMENT_TYPES)[number];
    documentNumber: string;
    country: string;
    photoPreviewDataUrl: string;
    remarks: string;
  }) => Promise<void>;
  onDeleteVerification: (id: string) => Promise<void>;
  onDeleteSavedPhoto: (id: string) => Promise<void>;
  onUpdateProfile: (displayName: string, phone: string) => Promise<void>;
  onNavigateToStudio: () => void;
  onLoadSavedPhotoInStudio?: (dataUrl: string) => void;
  onOpenAdminPanel?: () => void;
  onSelfApproveForDemo?: () => Promise<void>;
  onSignOut: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  brandName,
  logoUrl,
  userProfile,
  appointments,
  verifications,
  savedPhotos,
  currentStudioPreviewUrl,
  initialSubTab = 'overview',
  onBookAppointment,
  onCancelAppointment,
  onSubmitVerification,
  onDeleteVerification,
  onDeleteSavedPhoto,
  onUpdateProfile,
  onNavigateToStudio,
  onLoadSavedPhotoInStudio,
  onOpenAdminPanel,
  onSelfApproveForDemo,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'appointments' | 'verifications' | 'photos' | 'profile'
  >(initialSubTab);

  useEffect(() => {
    setActiveTab(initialSubTab);
  }, [initialSubTab]);

  // Appointment Form State
  const [aptPhone, setAptPhone] = useState(userProfile.phone || '+91 ');
  const [aptService, setAptService] = useState<(typeof SERVICE_TYPES)[number]>(SERVICE_TYPES[0]);
  const [aptCountry, setAptCountry] = useState('India (Passport / Stamp — 35×45 mm)');
  const [aptBranch, setAptBranch] = useState<(typeof BRANCH_LOCATIONS)[number]>(BRANCH_LOCATIONS[0]);
  const [aptDate, setAptDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().split('T')[0];
  });
  const [aptTime, setAptTime] = useState<(typeof TIME_SLOTS)[number]>(TIME_SLOTS[1]);
  const [aptNotes, setAptNotes] = useState('');
  const [isSubmittingApt, setIsSubmittingApt] = useState(false);

  // Document Verification Form State
  const [docType, setDocType] = useState<(typeof DOCUMENT_TYPES)[number]>(DOCUMENT_TYPES[0]);
  const [docNumber, setDocNumber] = useState('');
  const [docCountry, setDocCountry] = useState('India');
  const [docRemarks, setDocRemarks] = useState('');
  const [docPreview, setDocPreview] = useState(currentStudioPreviewUrl || '');
  const [isSubmittingDoc, setIsSubmittingDoc] = useState(false);

  // Profile Edit State
  const [editName, setEditName] = useState(userProfile.displayName);
  const [editPhone, setEditPhone] = useState(userProfile.phone);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const isApproved = userProfile.status === 'approved' || userProfile.role === 'admin';
  const isBlocked = userProfile.status === 'blocked' || userProfile.status === 'removed';

  const handleAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aptPhone.trim() || !aptDate || !isApproved) return;
    setIsSubmittingApt(true);
    try {
      await onBookAppointment({
        phone: aptPhone.trim(),
        serviceType: aptService,
        countrySpec: aptCountry,
        branchLocation: aptBranch,
        appointmentDate: aptDate,
        timeSlot: aptTime,
        notes: aptNotes.trim(),
      });
      setAptNotes('');
    } finally {
      setIsSubmittingApt(false);
    }
  };

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docNumber.trim() || !isApproved) return;
    setIsSubmittingDoc(true);
    try {
      await onSubmitVerification({
        documentType: docType,
        documentNumber: docNumber.trim().toUpperCase(),
        country: docCountry,
        photoPreviewDataUrl: docPreview || currentStudioPreviewUrl,
        remarks: docRemarks.trim(),
      });
      setDocNumber('');
      setDocRemarks('');
    } finally {
      setIsSubmittingDoc(false);
    }
  };

  const handleDocFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 360;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setDocPreview(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setIsSavingProfile(true);
    try {
      await onUpdateProfile(editName.trim(), editPhone.trim());
    } finally {
      setIsSavingProfile(false);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'verified':
      case 'completed':
      case 'approved':
        return 'text-emerald-700 font-bold';
      case 'under_review':
        return 'text-cyan-700 font-bold';
      case 'cancelled':
      case 'rejected':
      case 'blocked':
      case 'removed':
        return 'text-rose-700 font-bold';
      default:
        return 'text-amber-700 font-bold';
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3.5 sm:px-6 py-4 sm:py-6 space-y-5">
      {/* Account Approval Status Notice Banner */}
      {!isApproved && !isBlocked && (
        <div className="p-4 sm:p-5 rounded-3xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-extrabold">
              <i className="fa-solid fa-user-clock"></i>
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-amber-950">
                Your Account Is Pending Administrator Approval
              </h2>
              <p className="text-xs text-amber-800 mt-0.5">
                Welcome to {brandName}! Your registration has been recorded with status{' '}
                <span className="font-mono font-bold uppercase">Pending</span>. Once an administrator approves your account in the Admin Panel, full appointment booking and verification features will unlock.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onSelfApproveForDemo && (
              <button
                onClick={onSelfApproveForDemo}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition whitespace-nowrap"
              >
                Instant Approve (Demo)
              </button>
            )}
            {onOpenAdminPanel && (
              <button
                onClick={onOpenAdminPanel}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#070a14] text-cyan-300 text-xs font-bold transition whitespace-nowrap"
              >
                Open Admin Panel
              </button>
            )}
          </div>
        </div>
      )}

      {isBlocked && (
        <div className="p-4 sm:p-5 rounded-3xl bg-rose-50 border border-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0">
              <i className="fa-solid fa-ban"></i>
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-rose-950">
                Account Restricted ({userProfile.status.toUpperCase()})
              </h2>
              <p className="text-xs text-rose-800 mt-0.5">
                Your account access has been restricted by the {brandName} administrator.
              </p>
            </div>
          </div>
          {onOpenAdminPanel && (
            <button
              onClick={onOpenAdminPanel}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-rose-700 text-white text-xs font-bold"
            >
              Manage in Admin Panel
            </button>
          )}
        </div>
      )}

      {/* User Profile Banner — MALNADU MEDIA Butterfly-Camera Logo Theme */}
      <div className="bg-[#070a14] rounded-3xl border border-cyan-500/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md text-white">
        <div className="flex items-center gap-3.5">
          <div className="h-12 px-2 py-1 rounded-2xl bg-[#070a14] border border-cyan-400/40 flex items-center justify-center shrink-0 overflow-hidden">
            <img
              src={logoUrl || '/assets/aistudio/IMG-20261029-WA0055_86fec676.jpg'}
              alt={brandName}
              className="h-full w-auto max-w-[100px] object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-extrabold text-white truncate">
                {userProfile.displayName}
              </h1>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                  isApproved
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : isBlocked
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {userProfile.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">
              {userProfile.email} {userProfile.phone ? `· ${userProfile.phone}` : ''}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          <button
            onClick={onNavigateToStudio}
            className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white text-xs font-bold active:scale-[0.98] transition flex items-center justify-center gap-1.5"
          >
            <i className="fa-solid fa-camera"></i>
            <span>Photo Studio</span>
          </button>
          <button
            onClick={onSignOut}
            className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-slate-200 text-xs font-bold active:scale-[0.98] transition flex items-center justify-center gap-1.5"
          >
            <i className="fa-solid fa-right-from-bracket text-rose-400"></i>
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-[#070a14] p-1.5 rounded-2xl border border-cyan-500/30">
        {[
          { id: 'overview', label: 'Overview', icon: 'fa-chart-pie' },
          { id: 'appointments', label: `Appointments (${appointments.length})`, icon: 'fa-calendar-check' },
          { id: 'verifications', label: `ID Verify (${verifications.length})`, icon: 'fa-id-card-clip' },
          { id: 'photos', label: `Saved Photos (${savedPhotos.length})`, icon: 'fa-images' },
          { id: 'profile', label: 'Profile', icon: 'fa-user-pen' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === t.id
                ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            <i className={`fa-solid ${t.icon}`}></i>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <button
              onClick={() => setActiveTab('appointments')}
              className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 text-left hover:border-cyan-400 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Appointments</span>
                <span className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center text-xs">
                  <i className="fa-solid fa-calendar-day"></i>
                </span>
              </div>
              <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 mt-2">
                {appointments.length}
              </div>
              <div className="text-[11px] font-semibold text-cyan-700 mt-1">
                Book or view studio slots →
              </div>
            </button>

            <button
              onClick={() => setActiveTab('verifications')}
              className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 text-left hover:border-purple-400 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">ID Verifications</span>
                <span className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xs">
                  <i className="fa-solid fa-file-shield"></i>
                </span>
              </div>
              <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 mt-2">
                {verifications.length}
              </div>
              <div className="text-[11px] font-semibold text-purple-700 mt-1">
                Check biometric status →
              </div>
            </button>

            <button
              onClick={() => setActiveTab('photos')}
              className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 text-left hover:border-amber-400 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Saved Photos</span>
                <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xs">
                  <i className="fa-solid fa-camera-retro"></i>
                </span>
              </div>
              <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 mt-2">
                {savedPhotos.length}
              </div>
              <div className="text-[11px] font-semibold text-amber-700 mt-1">
                Download 300 DPI files →
              </div>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent Appointments */}
            <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-900">Recent Appointments</h2>
                <button
                  onClick={() => setActiveTab('appointments')}
                  className="text-xs font-bold text-cyan-700"
                >
                  + Book Slot
                </button>
              </div>
              {appointments.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center bg-slate-50 rounded-2xl">
                  No studio appointments booked yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {appointments.slice(0, 3).map((apt) => (
                    <div key={apt.id} className="py-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {apt.serviceType}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {apt.appointmentDate} · {apt.timeSlot}
                        </div>
                      </div>
                      <span className={`text-xs capitalize shrink-0 ${getStatusText(apt.status)}`}>
                        {apt.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent ID Verifications */}
            <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-900">Document Verifications</h2>
                <button
                  onClick={() => setActiveTab('verifications')}
                  className="text-xs font-bold text-cyan-700"
                >
                  + Submit ID
                </button>
              </div>
              {verifications.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center bg-slate-50 rounded-2xl">
                  No documents submitted for verification yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {verifications.slice(0, 3).map((ver) => (
                    <div key={ver.id} className="py-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {ver.documentType} ({ver.documentNumber})
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">{ver.country}</div>
                      </div>
                      <span className={`text-xs capitalize shrink-0 ${getStatusText(ver.status)}`}>
                        {ver.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STUDIO APPOINTMENTS */}
      {activeTab === 'appointments' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <form
            onSubmit={handleAppointmentSubmit}
            className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 space-y-4"
          >
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Book Studio Appointment</h2>
              <p className="text-xs text-slate-500">
                Schedule an in-person biometric capture or print pickup at {brandName}
              </p>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Service Type</label>
                <select
                  value={aptService}
                  onChange={(e) => setAptService(e.target.value as any)}
                  className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl font-medium"
                >
                  {SERVICE_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Target Country Preset
                </label>
                <select
                  value={aptCountry}
                  onChange={(e) => setAptCountry(e.target.value)}
                  className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl font-medium"
                >
                  {COUNTRY_PRESETS.map((c) => (
                    <option key={c.id} value={`${c.country} (${c.desc})`}>
                      {c.country} — {c.desc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Studio Center</label>
                <select
                  value={aptBranch}
                  onChange={(e) => setAptBranch(e.target.value as any)}
                  className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl font-medium"
                >
                  {BRANCH_LOCATIONS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Date</label>
                  <input
                    type="date"
                    required
                    value={aptDate}
                    onChange={(e) => setAptDate(e.target.value)}
                    className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Time Slot</label>
                  <select
                    value={aptTime}
                    onChange={(e) => setAptTime(e.target.value as any)}
                    className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl font-mono"
                  >
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Mobile Number</label>
                <input
                  type="tel"
                  required
                  value={aptPhone}
                  onChange={(e) => setAptPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={aptNotes}
                  onChange={(e) => setAptNotes(e.target.value)}
                  placeholder="E.g. Need 8 glossy prints on 6×4 sheet..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingApt || !isApproved}
              className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-sm shadow-sm active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-calendar-plus"></i>
              <span>
                {!isApproved
                  ? 'Requires Account Approval'
                  : isSubmittingApt
                  ? 'Booking...'
                  : 'Confirm Appointment'}
              </span>
            </button>
          </form>

          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-extrabold text-slate-900">Your Scheduled Slots</h2>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {appointments.length} Total
              </span>
            </div>

            {appointments.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No studio appointments scheduled yet.
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-4 rounded-2xl border border-slate-200 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-extrabold text-slate-900">
                          {apt.serviceType}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          <i className="fa-solid fa-location-dot mr-1 text-cyan-600"></i>
                          {apt.branchLocation}
                        </div>
                      </div>
                      <span className={`text-xs capitalize ${getStatusText(apt.status)}`}>
                        {apt.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                      <span className="font-mono">
                        {apt.appointmentDate} · {apt.timeSlot}
                      </span>
                      {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                        <button
                          onClick={() => onCancelAppointment(apt)}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 font-bold text-xs"
                        >
                          Cancel Slot
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DOCUMENT VERIFICATION */}
      {activeTab === 'verifications' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <form
            onSubmit={handleVerificationSubmit}
            className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 space-y-4"
          >
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Submit ID for Verification</h2>
              <p className="text-xs text-slate-500">
                Verify biometric photo compliance against official government ID standards
              </p>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Document Type</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as any)}
                  className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl font-medium"
                >
                  {DOCUMENT_TYPES.map((dt) => (
                    <option key={dt} value={dt}>
                      {dt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Document / Application Number
                </label>
                <input
                  type="text"
                  required
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  placeholder="E.g. P4829103 or XXXX-XXXX-8912"
                  className="w-full min-h-[46px] px-3.5 py-2.5 text-sm font-mono uppercase bg-slate-50 border border-slate-200 rounded-2xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Issuing Country</label>
                <select
                  value={docCountry}
                  onChange={(e) => setDocCountry(e.target.value)}
                  className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl font-medium"
                >
                  {COUNTRY_PRESETS.map((c) => (
                    <option key={c.id} value={c.country}>
                      {c.country}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Photo / Document Proof
                </label>
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  {docPreview || currentStudioPreviewUrl ? (
                    <img
                      src={docPreview || currentStudioPreviewUrl}
                      alt="Preview"
                      referrerPolicy="no-referrer"
                      className="w-14 h-16 object-cover rounded-xl border border-slate-300 bg-white shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-16 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                      <i className="fa-solid fa-image"></i>
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="min-h-[42px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer active:scale-[0.98] transition">
                      <i className="fa-solid fa-upload text-cyan-600"></i>
                      <span>Choose Image</span>
                      <input type="file" accept="image/*" onChange={handleDocFileUpload} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Remarks (Optional)</label>
                <textarea
                  rows={2}
                  value={docRemarks}
                  onChange={(e) => setDocRemarks(e.target.value)}
                  placeholder="E.g. Please verify head margin for UK Visa..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingDoc || !isApproved}
              className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-sm shadow-sm active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-file-circle-check"></i>
              <span>
                {!isApproved
                  ? 'Requires Account Approval'
                  : isSubmittingDoc
                  ? 'Submitting...'
                  : 'Submit for Verification'}
              </span>
            </button>
          </form>

          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-extrabold text-slate-900">Submitted Documents</h2>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {verifications.length} Total
              </span>
            </div>

            {verifications.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No documents submitted yet.
              </div>
            ) : (
              <div className="space-y-3">
                {verifications.map((ver) => (
                  <div
                    key={ver.id}
                    className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {ver.photoPreviewDataUrl ? (
                        <img
                          src={ver.photoPreviewDataUrl}
                          alt={ver.documentType}
                          referrerPolicy="no-referrer"
                          className="w-12 h-14 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-14 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                          <i className="fa-solid fa-file-shield"></i>
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-slate-900 truncate">
                          {ver.documentType} · <span className="font-mono">{ver.documentNumber}</span>
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          {ver.country} ·{' '}
                          <span className={getStatusText(ver.status)}>
                            {ver.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onDeleteVerification(ver.id)}
                      className="min-h-[42px] min-w-[42px] rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition shrink-0"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SAVED STUDIO PHOTOS */}
      {activeTab === 'photos' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Saved Studio Photos</h2>
              <p className="text-xs text-slate-500">300 DPI ready passport cutouts</p>
            </div>
            <button
              onClick={onNavigateToStudio}
              className="min-h-[42px] px-4 py-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white text-xs font-bold"
            >
              + New Photo
            </button>
          </div>

          {savedPhotos.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-xs text-slate-500">No saved photos in your account yet.</p>
              <button
                onClick={onNavigateToStudio}
                className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#070a14] text-cyan-300 text-xs font-bold"
              >
                Open Photo Studio
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {savedPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="p-3 rounded-2xl border border-slate-200 flex flex-col justify-between gap-2.5 bg-slate-50/50"
                >
                  <div className="flex items-center justify-center p-2.5 rounded-xl checkerboard border border-slate-200 h-36">
                    <img
                      src={photo.previewDataUrl}
                      alt={photo.presetName}
                      referrerPolicy="no-referrer"
                      className="max-h-full w-auto object-contain shadow-sm rounded"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 truncate">{photo.presetName}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">{photo.dimensionsText}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a
                      href={photo.previewDataUrl}
                      download={`malnadu-passport-${photo.id}.jpg`}
                      className="flex-1 min-h-[38px] rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold flex items-center justify-center"
                    >
                      Download
                    </a>
                    {onLoadSavedPhotoInStudio && (
                      <button
                        onClick={() => onLoadSavedPhotoInStudio(photo.previewDataUrl)}
                        className="min-h-[38px] px-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-bold"
                        title="Edit in Studio"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteSavedPhoto(photo.id)}
                      className="min-h-[38px] min-w-[38px] rounded-xl border border-slate-200 text-slate-500 hover:text-rose-600 flex items-center justify-center"
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: PROFILE SETTINGS */}
      {activeTab === 'profile' && (
        <div className="max-w-lg bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Profile Settings</h2>
            <p className="text-xs text-slate-500">Update your applicant name and mobile number</p>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Email ID</label>
              <input
                type="email"
                disabled
                value={userProfile.email}
                className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-100 border border-slate-200 rounded-2xl text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Mobile Number</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={isSavingProfile}
              className="w-full min-h-[48px] py-3 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white text-sm font-bold shadow-sm active:scale-[0.98] transition"
            >
              {isSavingProfile ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
