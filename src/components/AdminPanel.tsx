import React, { useState, useEffect, useRef } from 'react';
import {
  UserProfile,
  AccountStatus,
  SiteSettings,
  ShortLinkRecord,
  AppointmentRecord,
  DocumentVerificationRecord,
  DEFAULT_SITE_SETTINGS,
} from '../constants';

interface AdminPanelProps {
  currentUserProfile: UserProfile | null;
  users: UserProfile[];
  siteSettings: SiteSettings;
  shortLinks: ShortLinkRecord[];
  appointments: AppointmentRecord[];
  verifications: DocumentVerificationRecord[];
  onUpdateUserStatus: (uid: string, status: AccountStatus) => Promise<void>;
  onUpdateUserRole: (uid: string, role: 'user' | 'admin') => Promise<void>;
  onDeleteUserRecord: (uid: string) => Promise<void>;
  onCreateManagedUser: (
    displayName: string,
    email: string,
    phone: string,
    role: 'user' | 'admin',
    status: AccountStatus
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

type AdminTab = 'users' | 'branding' | 'links' | 'operations';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUserProfile,
  users,
  siteSettings,
  shortLinks,
  appointments,
  verifications,
  onUpdateUserStatus,
  onUpdateUserRole,
  onDeleteUserRecord,
  onCreateManagedUser,
  onSaveSiteSettings,
  onToggleShortLinkStatus,
  onDeleteShortLink,
  onUpdateAppointmentStatus,
  onUpdateVerificationStatus,
  onNavigateToStudio,
  showToast,
}) => {
  const [adminTab, setAdminTab] = useState<AdminTab>('users');

  // User Management Filters & Modal
  const [userSearch, setUserSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AccountStatus>('all');
  const [selectedUserModal, setSelectedUserModal] = useState<UserProfile | null>(null);
  const [showAddUserForm, setShowAddUserForm] = useState(false);

  // Add User Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [newUserStatus, setNewUserStatus] = useState<AccountStatus>('pending');

  // Branding & Footer Credit Form State
  const [formSettings, setFormSettings] = useState<SiteSettings>(siteSettings);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setFormSettings(siteSettings);
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
      u.email?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.uid?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;
    await onCreateManagedUser(
      newUserName.trim(),
      newUserEmail.trim(),
      newUserPhone.trim(),
      newUserRole,
      newUserStatus
    );
    setNewUserName('');
    setNewUserEmail('');
    setNewUserPhone('');
    setNewUserRole('user');
    setNewUserStatus('pending');
    setShowAddUserForm(false);
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

  return (
    <div className="max-w-6xl mx-auto px-3.5 sm:px-6 py-4 sm:py-6 space-y-5">
      {/* Top Admin Header Banner — MALNADU MEDIA Butterfly-Camera Logo Theme */}
      <div className="bg-[#070a14] text-white rounded-3xl p-4 sm:p-6 shadow-md border border-cyan-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="flex items-center gap-3.5">
          <div className="h-12 px-2 py-1 rounded-2xl bg-[#070a14] border border-cyan-400/40 flex items-center justify-center shrink-0 shadow-md overflow-hidden">
            <img
              src={siteSettings.logoUrl || '/assets/aistudio/IMG-20261029-WA0055_86fec676.jpg'}
              alt={siteSettings.brandName}
              className="h-full w-auto max-w-[110px] object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-xl font-extrabold tracking-tight">
                {siteSettings.brandName} — Admin Control Center
              </h1>
              <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-400/30">
                Super Admin
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage user account approvals, brand identity, configurable footer credit, and short links.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onNavigateToStudio}
            className="min-h-[42px] px-4 py-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white text-xs font-bold shadow-sm transition flex items-center gap-2"
          >
            <i className="fa-solid fa-camera"></i>
            <span>Return to Studio</span>
          </button>
        </div>
      </div>

      {/* Summary Statistics Cards (Total, Approved, Pending, Blocked) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar bg-[#070a14] p-2 rounded-2xl border border-cyan-500/30">
        {[
          { id: 'users', label: 'User Management & Approval', icon: 'fa-users-gear' },
          { id: 'branding', label: 'Brand, Theme & Footer Credit', icon: 'fa-palette' },
          { id: 'links', label: `Short Links (${shortLinks.length})`, icon: 'fa-link' },
          { id: 'operations', label: 'Appointments & IDs', icon: 'fa-calendar-check' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setAdminTab(t.id as AdminTab)}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 whitespace-nowrap ${
              adminTab === t.id
                ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            <i className={`fa-solid ${t.icon}`}></i>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* =====================================================================
          TAB 1: USER MANAGEMENT & ACCOUNT APPROVAL SYSTEM
         ===================================================================== */}
      {adminTab === 'users' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                User Account Approval & Access Control
              </h2>
              <p className="text-xs text-slate-500">
                Approve pending registrations, block/unblock accounts, or remove users permanently.
              </p>
            </div>

            <button
              onClick={() => setShowAddUserForm((v) => !v)}
              className="min-h-[42px] px-4 py-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white text-xs font-bold transition flex items-center gap-2 self-start sm:self-auto"
            >
              <i className="fa-solid fa-user-plus"></i>
              <span>{showAddUserForm ? 'Close Form' : 'Add User Account'}</span>
            </button>
          </div>

          {/* Add New User Form */}
          {showAddUserForm && (
            <form
              onSubmit={handleAddUserSubmit}
              className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-6 gap-3 items-end"
            >
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Ramesh Gowda"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="ramesh@malnadumedia.com"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Initial Status</label>
                <select
                  value={newUserStatus}
                  onChange={(e) => setNewUserStatus(e.target.value as AccountStatus)}
                  className="w-full min-h-[42px] px-2.5 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
              <div>
                <button
                  type="submit"
                  className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#070a14] text-cyan-300 text-xs font-bold hover:bg-slate-800 transition"
                >
                  Create User
                </button>
              </div>
            </form>
          )}

          {/* Search & Status Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users by name, email, phone, or UID..."
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
              {filteredUsers.map((u) => (
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
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
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
                      onClick={() => setSelectedUserModal(u)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition"
                      title="View Full User Details"
                    >
                      Details
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
              ))}
            </div>
          )}
        </div>
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

      {/* User Details Modal */}
      {selectedUserModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">User Account Details</h3>
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
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Registered Date:</span>
                <span className="font-mono text-slate-900">{formatDateString(selectedUserModal.createdAt)}</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-slate-500">Current Status:</span>
                {getStatusBadge(selectedUserModal.status)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
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
    </div>
  );
};
