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
  userProfile: UserProfile;
  appointments: AppointmentRecord[];
  verifications: DocumentVerificationRecord[];
  savedPhotos: SavedPhotoRecord[];
  currentStudioPreviewUrl: string;
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
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  userProfile,
  appointments,
  verifications,
  savedPhotos,
  currentStudioPreviewUrl,
  onBookAppointment,
  onCancelAppointment,
  onSubmitVerification,
  onDeleteVerification,
  onDeleteSavedPhoto,
  onUpdateProfile,
  onNavigateToStudio,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'verifications' | 'photos' | 'profile'>('overview');

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
  const [docCountry, setDocCountry] = useState('India (35×45 mm Standard)');
  const [docPreview, setDocPreview] = useState(currentStudioPreviewUrl || '');
  const [docRemarks, setDocRemarks] = useState('');
  const [isSubmittingDoc, setIsSubmittingDoc] = useState(false);

  // Profile Edit State
  const [editName, setEditName] = useState(userProfile.displayName);
  const [editPhone, setEditPhone] = useState(userProfile.phone || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'completed':
      case 'verified':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'pending':
      case 'under_review':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'cancelled':
      case 'rejected':
        return 'text-rose-700 bg-rose-50 border-rose-200';
      default:
        return 'text-slate-700 bg-slate-100 border-slate-200';
    }
  };

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top User Welcome Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-extrabold text-lg flex items-center justify-center shrink-0">
            {userProfile.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Applicant Portal</span>
              <span aria-hidden="true">·</span>
              <span>{userProfile.email}</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-indigo-600 uppercase">{userProfile.role}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
              Welcome back, {userProfile.displayName}
            </h1>
            <p className="text-xs text-slate-500 font-malayalam mt-0.5">
              നിങ്ങളുടെ പാസ്‌പോർട്ട് ഫോട്ടോകൾ, അപ്പോയിന്റ്മെന്റുകൾ, ഡോക്യുമെന്റ് വെരിഫിക്കേഷൻ എന്നിവ ഇവിടെ നിയന്ത്രിക്കാം
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onNavigateToStudio}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <i className="fa-solid fa-camera-retro text-indigo-600"></i>
            <span>Open Photo Studio</span>
          </button>
          <button
            onClick={() => setActiveTab('appointments')}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <i className="fa-solid fa-calendar-plus"></i>
            <span>Book Studio Appointment</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500">Active Appointments</div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums mt-1">
            {appointments.filter((a) => a.status === 'pending' || a.status === 'confirmed').length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Total booked: <span className="font-mono tabular-nums">{appointments.length}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500">Document Verifications</div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums mt-1">
            {verifications.length}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1">
            Verified: <span className="font-mono tabular-nums">{verifications.filter((v) => v.status === 'verified').length}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500">Saved Studio Photos</div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums mt-1">
            {savedPhotos.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">300 DPI Ready Exports</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500">Account Compliance</div>
          <div className="text-lg font-extrabold text-emerald-700 mt-1 flex items-center gap-1.5">
            <i className="fa-solid fa-shield-check"></i>
            <span>Biometric Ready</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Status: {userProfile.status.toUpperCase()}</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-200/70 p-1.5 rounded-2xl w-fit">
        {[
          { id: 'overview', label: 'Overview', icon: 'fa-chart-pie' },
          { id: 'appointments', label: 'Appointments (അപ്പോയിന്റ്മെന്റ്)', icon: 'fa-calendar-check' },
          { id: 'verifications', label: 'Document Verification', icon: 'fa-file-shield' },
          { id: 'photos', label: 'Saved Photos', icon: 'fa-images' },
          { id: 'profile', label: 'Profile Settings', icon: 'fa-user-gear' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === t.id
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className={`fa-solid ${t.icon}`}></i>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Recent Appointments */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">Upcoming Studio Appointments</h2>
                <p className="text-xs text-slate-500">Track your scheduled passport & biometric sessions</p>
              </div>
              <button
                onClick={() => setActiveTab('appointments')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 whitespace-nowrap shrink-0"
              >
                Manage All →
              </button>
            </div>

            {appointments.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <div className="text-xs text-slate-500">No studio appointments scheduled yet.</div>
                <button
                  onClick={() => setActiveTab('appointments')}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                >
                  Schedule First Appointment
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.slice(0, 4).map((apt) => (
                  <div
                    key={apt.id}
                    className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{apt.serviceType}</div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {apt.branchLocation} · <span className="font-mono tabular-nums">{apt.appointmentDate}</span> at{' '}
                        <span className="font-mono tabular-nums">{apt.timeSlot}</span>
                      </div>
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border shrink-0 uppercase ${getStatusColor(apt.status)}`}>
                      {apt.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Document Verifications */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">Document Verification Status</h2>
                <p className="text-xs text-slate-500">Real-time biometric & official ID verification tracker</p>
              </div>
              <button
                onClick={() => setActiveTab('verifications')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 whitespace-nowrap shrink-0"
              >
                Submit Document →
              </button>
            </div>

            {verifications.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <div className="text-xs text-slate-500">No documents submitted for verification yet.</div>
                <button
                  onClick={() => setActiveTab('verifications')}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                >
                  Submit First Document
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {verifications.slice(0, 4).map((ver) => (
                  <div
                    key={ver.id}
                    className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {ver.photoPreviewDataUrl ? (
                        <img
                          src={ver.photoPreviewDataUrl}
                          alt={ver.documentType}
                          referrerPolicy="no-referrer"
                          className="w-10 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                          <i className="fa-solid fa-id-card"></i>
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {ver.documentType} (<span className="font-mono">{ver.documentNumber}</span>)
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {ver.country} {ver.remarks ? `· "${ver.remarks}"` : ''}
                        </div>
                      </div>
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border shrink-0 uppercase ${getStatusColor(ver.status)}`}>
                      {ver.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: APPOINTMENTS */}
      {activeTab === 'appointments' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Book Appointment Form */}
          <form
            onSubmit={handleBookSubmit}
            className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 space-y-4"
          >
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Book Studio Appointment</h2>
              <p className="text-xs text-slate-500 font-malayalam">
                സ്റ്റുഡിയോ ഫോട്ടോഷൂട്ട് അല്ലെങ്കിൽ ഡോക്യുമെന്റ് വെരിഫിക്കേഷൻ ബുക്ക് ചെയ്യുക
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Service Type</label>
                <select
                  value={aptService}
                  onChange={(e) => setAptService(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  {SERVICE_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Country Specification</label>
                <select
                  value={aptCountry}
                  onChange={(e) => setAptCountry(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  {COUNTRY_PRESETS.map((c) => (
                    <option key={c.id} value={c.country}>
                      {c.flag} {c.country}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Studio Branch / Center</label>
                <select
                  value={aptBranch}
                  onChange={(e) => setAptBranch(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  {BRANCH_LOCATIONS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Date</label>
                  <input
                    type="date"
                    required
                    value={aptDate}
                    onChange={(e) => setAptDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Time Slot</label>
                  <select
                    value={aptTime}
                    onChange={(e) => setAptTime(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono"
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone Number</label>
                <input
                  type="tel"
                  required
                  value={aptPhone}
                  onChange={(e) => setAptPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Special Notes / Requirements</label>
                <textarea
                  rows={2}
                  value={aptNotes}
                  onChange={(e) => setAptNotes(e.target.value)}
                  placeholder="E.g. Need both digital softcopy and 8 physical prints..."
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isBooking}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-sm transition flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-calendar-check"></i>
              <span>{isBooking ? 'Scheduling Appointment...' : 'Confirm Appointment Booking'}</span>
            </button>
          </form>

          {/* Appointments List */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">Your Scheduled Appointments</h2>
                <p className="text-xs text-slate-500">Live updates from PassportStudio Pro booking desk</p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500">{appointments.length} Total</span>
            </div>

            {appointments.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                You have no appointments yet. Use the form on the left to schedule a studio session.
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900">{apt.serviceType}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getStatusColor(apt.status)}`}>
                          {apt.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 font-medium">{apt.countrySpec}</div>
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                        <span><i className="fa-solid fa-location-dot text-indigo-600 mr-1"></i>{apt.branchLocation}</span>
                        <span>·</span>
                        <span className="font-mono tabular-nums"><i className="fa-regular fa-calendar mr-1"></i>{apt.appointmentDate}</span>
                        <span>·</span>
                        <span className="font-mono tabular-nums"><i className="fa-regular fa-clock mr-1"></i>{apt.timeSlot}</span>
                      </div>
                      {apt.notes && (
                        <div className="text-xs text-slate-500 italic pt-1">Note: "{apt.notes}"</div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                        <button
                          onClick={() => onCancelAppointment(apt)}
                          className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition whitespace-nowrap"
                        >
                          Cancel Booking
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

      {/* TAB 3: DOCUMENT VERIFICATIONS */}
      {activeTab === 'verifications' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Submit Verification Form */}
          <form
            onSubmit={handleDocSubmit}
            className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 space-y-4"
          >
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Submit Document for Verification</h2>
              <p className="text-xs text-slate-500 font-malayalam">
                പാസ്‌പോർട്ട്, വിസ, പാൻ കാർഡ് ഫോട്ടോകളും രേഖകളും വെരിഫിക്കേഷനായി സമർപ്പിക്കുക
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Document Category</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  {DOCUMENT_TYPES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Document / Application Reference Number
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={50}
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  placeholder="E.g. V4829103 or ABCDE1234F"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Embassy / Country</label>
                <select
                  value={docCountry}
                  onChange={(e) => setDocCountry(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  {COUNTRY_PRESETS.map((c) => (
                    <option key={c.id} value={c.country}>
                      {c.flag} {c.country}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Attach Biometric Photo / ID Proof
                </label>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  {docPreview || currentStudioPreviewUrl ? (
                    <img
                      src={docPreview || currentStudioPreviewUrl}
                      alt="Preview"
                      referrerPolicy="no-referrer"
                      className="w-14 h-16 object-cover rounded-lg border border-slate-300 bg-white shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-16 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                      <i className="fa-solid fa-image"></i>
                    </div>
                  )}
                  <div className="space-y-1.5 flex-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer transition">
                      <i className="fa-solid fa-upload text-indigo-600"></i>
                      <span>Upload Document / Photo</span>
                      <input type="file" accept="image/*" onChange={handleDocFileUpload} className="hidden" />
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Defaults to your active Studio passport cutout if no file is chosen.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Applicant Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={docRemarks}
                  onChange={(e) => setDocRemarks(e.target.value)}
                  placeholder="E.g. Please verify ICAO head-to-chin ratio for UK Visa renewal..."
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingDoc}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-sm transition flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-file-circle-check"></i>
              <span>{isSubmittingDoc ? 'Submitting Verification...' : 'Submit for Official Verification'}</span>
            </button>
          </form>

          {/* Verifications History */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">Document Verification Queue</h2>
                <p className="text-xs text-slate-500">Biometric & compliance inspection results</p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500">{verifications.length} Submissions</span>
            </div>

            {verifications.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No documents submitted for verification yet.
              </div>
            ) : (
              <div className="space-y-3">
                {verifications.map((ver) => (
                  <div
                    key={ver.id}
                    className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {ver.photoPreviewDataUrl ? (
                        <img
                          src={ver.photoPreviewDataUrl}
                          alt={ver.documentType}
                          referrerPolicy="no-referrer"
                          className="w-14 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-16 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                          <i className="fa-solid fa-file-shield text-lg"></i>
                        </div>
                      )}
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-extrabold text-slate-900">{ver.documentType}</span>
                          <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            #{ver.documentNumber}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getStatusColor(ver.status)}`}>
                            {ver.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600">{ver.country}</div>
                        {ver.remarks && (
                          <div className="text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/80">
                            Remarks: {ver.remarks}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => onDeleteVerification(ver.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
                    >
                      <i className="fa-solid fa-trash-can mr-1"></i> Remove
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
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Saved Passport & ID Photos</h2>
              <p className="text-xs text-slate-500">Download or manage photos saved from the Studio editor</p>
            </div>
            <button
              onClick={onNavigateToStudio}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
            >
              + Create New Photo
            </button>
          </div>

          {savedPhotos.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="text-xs text-slate-500">
                You haven't saved any passport photos to your cloud gallery yet.
              </div>
              <button
                onClick={onNavigateToStudio}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                Go to Photo Studio
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {savedPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="p-3.5 rounded-2xl border border-slate-200 flex flex-col justify-between gap-3 bg-slate-50/50"
                >
                  <div className="flex items-center justify-center p-3 rounded-xl checkerboard border border-slate-200 h-44">
                    <img
                      src={photo.previewDataUrl}
                      alt={photo.presetName}
                      referrerPolicy="no-referrer"
                      className="max-h-full w-auto object-contain shadow-sm rounded"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 truncate">{photo.presetName}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">{photo.dimensionsText}</div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href={photo.previewDataUrl}
                      download={`passport-${photo.id}.jpg`}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold text-center transition"
                    >
                      Download
                    </a>
                    <button
                      onClick={() => onDeleteSavedPhoto(photo.id)}
                      className="py-1.5 px-2.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-500 text-xs transition"
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
        <div className="max-w-xl bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Applicant Profile Settings</h2>
            <p className="text-xs text-slate-500">Update your full name and contact phone for appointment alerts</p>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Address (Verified)</label>
              <input
                type="email"
                disabled
                value={userProfile.email}
                className="w-full px-3.5 py-2 text-sm bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Name (As on Passport/ID)</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mobile / WhatsApp Number</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={isSavingProfile}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition"
            >
              {isSavingProfile ? 'Saving Changes...' : 'Save Profile Details'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
