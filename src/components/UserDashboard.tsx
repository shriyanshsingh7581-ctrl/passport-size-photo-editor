import React, { useState } from 'react';
import {
  COUNTRY_PRESETS,
  SERVICE_TYPES,
  BRANCH_LOCATIONS,
  TIME_SLOTS,
  DOCUMENT_TYPES,
  UserProfile,
  AppointmentRecord,
  DocumentVerificationRecord,
  SavedPhotoRecord,
} from '../constants';

interface UserDashboardProps {
  brandName?: string;
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
  onCancelAppointment: (appointment: AppointmentRecord) => Promise<void>;
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
  onOpenAdminPanel?: () => void;
  onSelfApproveForDemo?: () => Promise<void>;
  onSignOut: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  brandName = 'MALNADU MEDIA',
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
  onOpenAdminPanel,
  onSelfApproveForDemo,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'verifications' | 'photos' | 'profile'>(initialSubTab);

  // Appointment Form State
  const [aptPhone, setAptPhone] = useState(userProfile.phone || '+91 9876543210');
  const [aptService, setAptService] = useState<(typeof SERVICE_TYPES)[number]>(SERVICE_TYPES[0]);
  const [aptCountry, setAptCountry] = useState(COUNTRY_PRESETS[0].country);
  const [aptBranch, setAptBranch] = useState<(typeof BRANCH_LOCATIONS)[number]>(BRANCH_LOCATIONS[0]);
  const [aptDate, setAptDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().split('T')[0];
  });
  const [aptTime, setAptTime] = useState<(typeof TIME_SLOTS)[number]>(TIME_SLOTS[1]);
  const [aptNotes, setAptNotes] = useState('');
  const [isBooking, setIsBooking] = useState(false);

  // Document Verification Form State
  const [docType, setDocType] = useState<(typeof DOCUMENT_TYPES)[number]>(DOCUMENT_TYPES[0]);
  const [docNumber, setDocNumber] = useState('');
  const [docCountry, setDocCountry] = useState(COUNTRY_PRESETS[0].country);
  const [docPreview, setDocPreview] = useState(currentStudioPreviewUrl || '');
  const [docRemarks, setDocRemarks] = useState('');
  const [isSubmittingDoc, setIsSubmittingDoc] = useState(false);

  // Profile Edit State
  const [editName, setEditName] = useState(userProfile.displayName);
  const [editPhone, setEditPhone] = useState(userProfile.phone || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const isApproved =
    userProfile.role === 'admin' ||
    userProfile.status === 'approved' ||
    userProfile.status === 'active';
  const isBlockedOrRemoved =
    userProfile.status === 'blocked' ||
    userProfile.status === 'removed' ||
    userProfile.status === 'suspended';

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isApproved) return;
    if (!aptPhone.trim() || aptPhone.trim().length < 5) return;
    setIsBooking(true);
    try {
      await onBookAppointment({
        phone: aptPhone.trim().slice(0, 30),
        serviceType: aptService,
        countrySpec: aptCountry.slice(0, 100),
        branchLocation: aptBranch,
        appointmentDate: aptDate,
        timeSlot: aptTime,
        notes: aptNotes.trim().slice(0, 500),
      });
      setAptNotes('');
    } finally {
      setIsBooking(false);
    }
  };

  const handleDocFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        const maxDim = 320;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        c.width = w;
        c.height = h;
        c.getContext('2d')!.drawImage(img, 0, 0, w, h);
        setDocPreview(c.toDataURL('image/jpeg', 0.8));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isApproved) return;
    if (!docNumber.trim() || docNumber.trim().length < 3) return;
    setIsSubmittingDoc(true);
    try {
      await onSubmitVerification({
        documentType: docType,
        documentNumber: docNumber.trim().toUpperCase().slice(0, 50),
        country: docCountry.trim().slice(0, 80),
        photoPreviewDataUrl: (docPreview || currentStudioPreviewUrl || '').slice(0, 240000),
        remarks: docRemarks.trim().slice(0, 500),
      });
      setDocNumber('');
      setDocRemarks('');
    } finally {
      setIsSubmittingDoc(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setIsSavingProfile(true);
    try {
      await onUpdateProfile(editName.trim().slice(0, 100), editPhone.trim().slice(0, 30));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'completed':
      case 'verified':
        return 'text-emerald-700 font-bold';
      case 'pending':
      case 'under_review':
        return 'text-amber-700 font-bold';
      case 'cancelled':
      case 'rejected':
        return 'text-rose-700 font-bold';
      default:
        return 'text-slate-600 font-bold';
    }
  };

  return (
    <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-24 space-y-5">
      {/* Compact Mobile-First User Card */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white font-extrabold text-lg flex items-center justify-center shrink-0">
            {userProfile.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-xs text-teal-400 font-bold truncate">
              {brandName} · {userProfile.email}
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight truncate">
              {userProfile.displayName}
            </h1>
            <p className="text-[11px] text-slate-400">
              Account Role: <span className="uppercase font-bold text-white">{userProfile.role}</span> · Status:{' '}
              <span className="uppercase font-bold text-teal-300">{userProfile.status}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          {onOpenAdminPanel && (
            <button
              onClick={onOpenAdminPanel}
              className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-teal-500/40 text-teal-300 text-xs font-bold active:scale-[0.98] transition flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <i className="fa-solid fa-shield-halved"></i>
              <span>Admin Panel</span>
            </button>
          )}
          <button
            onClick={onNavigateToStudio}
            className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold active:scale-[0.98] transition flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <i className="fa-solid fa-camera"></i>
            <span>Create New Photo</span>
          </button>
          <button
            onClick={onSignOut}
            className="min-h-[44px] px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-bold active:scale-[0.98] transition flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <i className="fa-solid fa-right-from-bracket"></i>
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* ACCOUNT APPROVAL / RESTRICTION BANNER */}
      {isBlockedOrRemoved && (
        <div className="p-5 rounded-3xl bg-rose-50 border-2 border-rose-200 text-rose-900 space-y-2">
          <div className="flex items-center gap-2 font-extrabold text-sm">
            <i className="fa-solid fa-ban text-rose-600"></i>
            <span>Account Access Restricted ({userProfile.status.toUpperCase()})</span>
          </div>
          <p className="text-xs text-rose-700">
            Your account has been blocked or removed by the {brandName} administrator. Protected dashboard services are currently disabled.
          </p>
          {onSelfApproveForDemo && (
            <button
              onClick={onSelfApproveForDemo}
              className="mt-2 px-4 py-2 rounded-xl bg-rose-700 text-white text-xs font-bold"
            >
              Restore & Approve Account (Admin Action)
            </button>
          )}
        </div>
      )}

      {!isApproved && !isBlockedOrRemoved && (
        <div className="p-5 rounded-3xl bg-amber-50 border-2 border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-extrabold text-sm text-amber-900">
              <i className="fa-solid fa-clock text-amber-600"></i>
              <span>Account Pending Admin Approval</span>
            </div>
            <p className="text-xs text-amber-800">
              Your registration has been received and is awaiting approval in the {brandName} Admin Panel before studio booking and ID verification are unlocked.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onSelfApproveForDemo && (
              <button
                onClick={onSelfApproveForDemo}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold whitespace-nowrap"
              >
                Approve Account Now
              </button>
            )}
            {onOpenAdminPanel && (
              <button
                onClick={onOpenAdminPanel}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold whitespace-nowrap"
              >
                Open Admin Panel
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2x2 Mobile Metric Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setActiveTab('appointments')}
          className="bg-white rounded-2xl border border-slate-200 p-4 text-left active:scale-[0.98] transition"
        >
          <div className="text-[11px] font-medium text-slate-500">Appointments</div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums mt-0.5">
            {appointments.length}
          </div>
          <div className="text-[11px] text-teal-600 font-semibold mt-1">
            Tap to book slot →
          </div>
        </button>

        <button
          onClick={() => setActiveTab('verifications')}
          className="bg-white rounded-2xl border border-slate-200 p-4 text-left active:scale-[0.98] transition"
        >
          <div className="text-[11px] font-medium text-slate-500">Verifications</div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums mt-0.5">
            {verifications.length}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1">
            Submit ID proof →
          </div>
        </button>

        <button
          onClick={() => setActiveTab('photos')}
          className="bg-white rounded-2xl border border-slate-200 p-4 text-left active:scale-[0.98] transition"
        >
          <div className="text-[11px] font-medium text-slate-500">Saved Photos</div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums mt-0.5">
            {savedPhotos.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">300 DPI Gallery →</div>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className="bg-white rounded-2xl border border-slate-200 p-4 text-left active:scale-[0.98] transition"
        >
          <div className="text-[11px] font-medium text-slate-500">Account Status</div>
          {isApproved ? (
            <div className="text-base font-extrabold text-emerald-700 mt-1 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-check"></i>
              <span>Approved</span>
            </div>
          ) : isBlockedOrRemoved ? (
            <div className="text-base font-extrabold text-rose-600 mt-1 flex items-center gap-1.5">
              <i className="fa-solid fa-ban"></i>
              <span className="capitalize">{userProfile.status}</span>
            </div>
          ) : (
            <div className="text-base font-extrabold text-amber-600 mt-1 flex items-center gap-1.5">
              <i className="fa-solid fa-clock"></i>
              <span>Pending</span>
            </div>
          )}
          <div className="text-[11px] text-slate-500 mt-1">Edit profile →</div>
        </button>
      </div>

      {/* Horizontal Touch Scroller Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'overview', label: 'Summary', icon: 'fa-layer-group' },
          { id: 'appointments', label: 'Book Appointment', icon: 'fa-calendar-check' },
          { id: 'verifications', label: 'ID Verification', icon: 'fa-file-shield' },
          { id: 'photos', label: 'Saved Photos', icon: 'fa-images' },
          { id: 'profile', label: 'My Profile', icon: 'fa-user-pen' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 active:scale-[0.98] ${
              activeTab === t.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className={`fa-solid ${t.icon}`}></i>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Interactive Tap List: Appointments */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Studio Appointments</h2>
                <p className="text-xs text-slate-500">Scheduled photo shoots & express slots</p>
              </div>
              <button
                onClick={() => setActiveTab('appointments')}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-teal-50 text-teal-700 text-xs font-bold whitespace-nowrap"
              >
                + Book New
              </button>
            </div>

            {appointments.length === 0 ? (
              <div className="py-8 text-center space-y-3 bg-slate-50 rounded-2xl p-4">
                <p className="text-xs text-slate-500">No appointments booked yet.</p>
                <button
                  onClick={() => setActiveTab('appointments')}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-teal-600 text-white text-xs font-bold"
                >
                  Schedule Studio Slot
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {appointments.slice(0, 4).map((apt) => (
                  <div
                    key={apt.id}
                    className="py-3.5 flex items-center justify-between gap-3 min-h-[60px]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                        <i className="fa-solid fa-calendar-day"></i>
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {apt.serviceType}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          <span className="font-mono tabular-nums">{apt.appointmentDate}</span> ·{' '}
                          <span className="font-mono tabular-nums">{apt.timeSlot}</span> ·{' '}
                          <span className={getStatusText(apt.status)}>{apt.status.toUpperCase()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Interactive Tap List: Document Verifications */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Document Verifications</h2>
                <p className="text-xs text-slate-500">Biometric & embassy compliance status</p>
              </div>
              <button
                onClick={() => setActiveTab('verifications')}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-teal-50 text-teal-700 text-xs font-bold whitespace-nowrap"
              >
                + Submit ID
              </button>
            </div>

            {verifications.length === 0 ? (
              <div className="py-8 text-center space-y-3 bg-slate-50 rounded-2xl p-4">
                <p className="text-xs text-slate-500">No documents submitted for verification.</p>
                <button
                  onClick={() => setActiveTab('verifications')}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-teal-600 text-white text-xs font-bold"
                >
                  Submit First Document
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {verifications.slice(0, 4).map((ver) => (
                  <div
                    key={ver.id}
                    className="py-3.5 flex items-center justify-between gap-3 min-h-[60px]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {ver.photoPreviewDataUrl ? (
                        <img
                          src={ver.photoPreviewDataUrl}
                          alt={ver.documentType}
                          referrerPolicy="no-referrer"
                          className="w-10 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                          <i className="fa-solid fa-id-card"></i>
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {ver.documentType} (<span className="font-mono">{ver.documentNumber}</span>)
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {ver.country} ·{' '}
                          <span className={getStatusText(ver.status)}>
                            {ver.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: APPOINTMENTS */}
      {activeTab === 'appointments' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <form
            onSubmit={handleBookSubmit}
            className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 space-y-4"
          >
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Book Studio Slot</h2>
              <p className="text-xs text-slate-500">
                Schedule an express photo shoot or verification appointment
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
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Country Size Spec</label>
                <select
                  value={aptCountry}
                  onChange={(e) => setAptCountry(e.target.value)}
                  className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl font-medium"
                >
                  {COUNTRY_PRESETS.map((c) => (
                    <option key={c.id} value={c.country}>
                      {c.flag} {c.country}
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
                  className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={aptNotes}
                  onChange={(e) => setAptNotes(e.target.value)}
                  placeholder="E.g. Need 8 physical prints + softcopy..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isBooking || !isApproved}
              className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-sm shadow-sm active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-calendar-check"></i>
              <span>
                {!isApproved
                  ? 'Requires Account Approval'
                  : isBooking
                  ? 'Booking...'
                  : 'Confirm Appointment'}
              </span>
            </button>
          </form>

          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-extrabold text-slate-900">Your Bookings</h2>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {appointments.length} Total
              </span>
            </div>

            {appointments.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No appointments scheduled yet.
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-extrabold text-slate-900">{apt.serviceType}</div>
                      <div className="text-xs text-slate-600">{apt.countrySpec}</div>
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                        <span>{apt.branchLocation}</span>
                        <span>·</span>
                        <span className="font-mono tabular-nums">{apt.appointmentDate}</span>
                        <span>·</span>
                        <span className="font-mono tabular-nums">{apt.timeSlot}</span>
                        <span>·</span>
                        <span className={getStatusText(apt.status)}>{apt.status.toUpperCase()}</span>
                      </div>
                    </div>

                    {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                      <button
                        onClick={() => onCancelAppointment(apt)}
                        className="min-h-[42px] px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold active:scale-[0.98] transition whitespace-nowrap"
                      >
                        Cancel Slot
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DOCUMENT VERIFICATIONS */}
      {activeTab === 'verifications' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <form
            onSubmit={handleDocSubmit}
            className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 space-y-4"
          >
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Submit ID for Verification</h2>
              <p className="text-xs text-slate-500">
                Submit passport or visa documents for biometric compliance review
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
                  {DOCUMENT_TYPES.map((d) => (
                    <option key={d} value={d}>
                      {d}
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
                  minLength={3}
                  maxLength={50}
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  placeholder="E.g. V4829103 or ABCDE1234F"
                  className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Country Standard</label>
                <select
                  value={docCountry}
                  onChange={(e) => setDocCountry(e.target.value)}
                  className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl font-medium"
                >
                  {COUNTRY_PRESETS.map((c) => (
                    <option key={c.id} value={c.country}>
                      {c.flag} {c.country}
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
                      <i className="fa-solid fa-upload text-teal-600"></i>
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
              className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-sm shadow-sm active:scale-[0.98] transition flex items-center justify-center gap-2"
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
              className="min-h-[42px] px-4 py-2 rounded-2xl bg-teal-600 text-white text-xs font-bold"
            >
              + New Photo
            </button>
          </div>

          {savedPhotos.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-xs text-slate-500">No saved photos in your account yet.</p>
              <button
                onClick={onNavigateToStudio}
                className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-slate-900 text-white text-xs font-bold"
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
                      className="flex-1 min-h-[40px] rounded-xl bg-teal-600 text-white text-xs font-bold flex items-center justify-center"
                    >
                      Download
                    </a>
                    <button
                      onClick={() => onDeleteSavedPhoto(photo.id)}
                      className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 text-slate-500 hover:text-rose-600 flex items-center justify-center"
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
              className="w-full min-h-[48px] py-3 px-5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold shadow-sm active:scale-[0.98] transition"
            >
              {isSavingProfile ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
