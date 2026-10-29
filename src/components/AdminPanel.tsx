import React, { useState } from 'react';
import {
  UserProfile,
  AccountStatus,
  SiteSettings,
  DEFAULT_SITE_SETTINGS,
  ShortLinkRecord,
  AppointmentRecord,
  DocumentVerificationRecord,
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
  onCreateManagedUser: (displayName: string, email: string, phone: string, role: 'user' | 'admin', status: AccountStatus) => Promise<void>;
  onSaveSiteSettings: (newSettings: SiteSettings) => Promise<void>;
  onToggleShortLinkStatus: (slug: string, currentActive: boolean) => Promise<void>;
  onDeleteShortLink: (slug: string) => Promise<void>;
  onUpdateAppointmentStatus: (id: string, status: AppointmentRecord['status'], notes: string) => Promise<void>;
  onUpdateVerificationStatus: (id: string, status: DocumentVerificationRecord['status'], remarks: string) => Promise<void>;
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
  const [adminTab, setAdminTab] = useState<'users' | 'settings' | 'links' | 'operations'>('users');

  // User Management Search & Filter State
  const [userSearch, setUserSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'blocked' | 'removed' | 'admin'>('all');
  const [selectedUserModal, setSelectedUserModal] = useState<UserProfile | null>(null);
  const [showAddUserForm, setShowAddUserForm] = useState(false);

  // Add User Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [newUserStatus, setNewUserStatus] = useState<AccountStatus>('pending');

  // Website Brand & Footer Settings Form State
  const [formSettings, setFormSettings] = useState<SiteSettings>(siteSettings);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Sync form when siteSettings prop updates externally
  React.useEffect(() => {
    setFormSettings(siteSettings);
  }, [siteSettings]);

  // Normalize user status helper (maps legacy 'active' to 'approved' and 'suspended' to 'blocked')
  const normalizeStatus = (s: AccountStatus): 'pending' | 'approved' | 'blocked' | 'removed' => {
    if (s === 'approved' || s === 'active') return 'approved';
    if (s === 'blocked' || s === 'suspended') return 'blocked';
    if (s === 'removed') return 'removed';
    return 'pending';
  };

  // Computed User KPIs
  const totalUsersCount = users.length;
  const approvedUsersCount = users.filter((u) => normalizeStatus(u.status) === 'approved').length;
  const pendingUsersCount = users.filter((u) => normalizeStatus(u.status) === 'pending').length;
  const removedOrBlockedCount = users.filter((u) => {
    const st = normalizeStatus(u.status);
    return st === 'blocked' || st === 'removed';
  }).length;

  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone && u.phone.toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'admin') return u.role === 'admin';
    return normalizeStatus(u.status) === statusFilter;
  });

  const formatDateString = (ts: any): string => {
    if (!ts) return 'Recent';
    try {
      if (typeof ts === 'string') return new Date(ts).toLocaleDateString();
      if (typeof ts?.toDate === 'function') return ts.toDate().toLocaleDateString();
      if (typeof ts?.seconds === 'number') return new Date(ts.seconds * 1000).toLocaleDateString();
    } catch {
      // fallback
    }
    return 'Recent';
  };

  const getStatusBadge = (status: AccountStatus) => {
    const norm = normalizeStatus(status);
    if (norm === 'approved') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold">
          <i className="fa-solid fa-circle-check text-[10px]"></i> Approved
        </span>
      );
    }
    if (norm === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-[11px] font-bold">
          <i className="fa-solid fa-clock text-[10px]"></i> Pending Approval
        </span>
      );
    }
    if (norm === 'blocked') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 text-[11px] font-bold">
          <i className="fa-solid fa-ban text-[10px]"></i> Blocked
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200 text-slate-700 text-[11px] font-bold">
        <i className="fa-solid fa-user-slash text-[10px]"></i> Removed
      </span>
    );
  };

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
    setShowAddUserForm(false);
  };

  const handleSettingsFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await onSaveSiteSettings(formSettings);
      showToast('Website Branding, Theme & Footer Credit Saved!');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://malnadumedia.com';

  return (
    <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-24 space-y-5">
      {/* Admin Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white font-extrabold text-lg flex items-center justify-center shrink-0 shadow-sm">
            <i className="fa-solid fa-shield-halved"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400">
                {siteSettings.brandName} — Admin Control Center
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
              User Approvals, Brand Identity & Platform Settings
            </h1>
            <p className="text-xs text-slate-400">
              Signed in as {currentUserProfile?.email || 'Administrator'}
            </p>
          </div>
        </div>

        <button
          onClick={onNavigateToStudio}
          className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition flex items-center gap-2 shrink-0"
        >
          <i className="fa-solid fa-camera"></i>
          <span>Back to Studio</span>
        </button>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          {
            id: 'users',
            label: `User Management (${totalUsersCount})`,
            icon: 'fa-users-gear',
            badge: pendingUsersCount > 0 ? `${pendingUsersCount} Pending` : undefined,
          },
          {
            id: 'settings',
            label: 'Brand, Theme & Footer Settings',
            icon: 'fa-sliders',
          },
          {
            id: 'links',
            label: `Short Links (${shortLinks.length})`,
            icon: 'fa-link',
          },
          {
            id: 'operations',
            label: `Bookings & ID Reviews (${appointments.length + verifications.length})`,
            icon: 'fa-clipboard-check',
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setAdminTab(tab.id as any)}
            className={`min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 ${
              adminTab === tab.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className={`fa-solid ${tab.icon}`}></i>
            <span>{tab.label}</span>
            {tab.badge && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* =====================================================================
          TAB 1: USER MANAGEMENT & ACCOUNT APPROVAL SYSTEM
         ===================================================================== */}
      {adminTab === 'users' && (
        <div className="space-y-5">
          {/* 4 KPI Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <button
              onClick={() => setStatusFilter('all')}
              className={`bg-white rounded-2xl border p-4 text-left transition ${
                statusFilter === 'all' ? 'border-teal-600 ring-2 ring-teal-500/15' : 'border-slate-200'
              }`}
            >
              <div className="text-xs font-semibold text-slate-500">Total Registered Users</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono mt-1">
                {totalUsersCount}
              </div>
              <div className="text-[11px] text-teal-600 font-bold mt-1">View all accounts →</div>
            </button>

            <button
              onClick={() => setStatusFilter('approved')}
              className={`bg-white rounded-2xl border p-4 text-left transition ${
                statusFilter === 'approved' ? 'border-emerald-600 ring-2 ring-emerald-500/15' : 'border-slate-200'
              }`}
            >
              <div className="text-xs font-semibold text-slate-500">Approved Users</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 font-mono mt-1">
                {approvedUsersCount}
              </div>
              <div className="text-[11px] text-emerald-700 font-bold mt-1">Active studio access</div>
            </button>

            <button
              onClick={() => setStatusFilter('pending')}
              className={`bg-white rounded-2xl border p-4 text-left transition ${
                statusFilter === 'pending' ? 'border-amber-500 ring-2 ring-amber-500/15' : 'border-slate-200'
              }`}
            >
              <div className="text-xs font-semibold text-slate-500">Pending Approval Users</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 font-mono mt-1">
                {pendingUsersCount}
              </div>
              <div className="text-[11px] text-amber-700 font-bold mt-1">Awaiting admin review</div>
            </button>

            <button
              onClick={() => setStatusFilter('blocked')}
              className={`bg-white rounded-2xl border p-4 text-left transition ${
                statusFilter === 'blocked' ? 'border-rose-600 ring-2 ring-rose-500/15' : 'border-slate-200'
              }`}
            >
              <div className="text-xs font-semibold text-slate-500">Removed / Blocked Users</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 font-mono mt-1">
                {removedOrBlockedCount}
              </div>
              <div className="text-[11px] text-rose-600 font-bold mt-1">Restricted accounts</div>
            </button>
          </div>

          {/* Search, Filter & Add User Controls */}
          <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users by name, email, or phone..."
                  className="w-full min-h-[44px] pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="min-h-[44px] px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-2xl text-slate-700"
                >
                  <option value="all">All Statuses ({totalUsersCount})</option>
                  <option value="pending">Pending Approval ({pendingUsersCount})</option>
                  <option value="approved">Approved ({approvedUsersCount})</option>
                  <option value="blocked">Blocked</option>
                  <option value="removed">Removed</option>
                  <option value="admin">Admins Only</option>
                </select>

                <button
                  onClick={() => setShowAddUserForm(!showAddUserForm)}
                  className="min-h-[44px] px-4 py-2 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <i className="fa-solid fa-user-plus"></i>
                  <span>Add User</span>
                </button>
              </div>
            </div>

            {/* Optional Add User Form */}
            {showAddUserForm && (
              <form
                onSubmit={handleAddUserSubmit}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-900">
                    Register New User Account
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddUserForm(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Full Name"
                    className="min-h-[42px] px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                  />
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="Email Address"
                    className="min-h-[42px] px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                  />
                  <input
                    type="tel"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    placeholder="+91 Phone"
                    className="min-h-[42px] px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                  />
                  <select
                    value={newUserStatus}
                    onChange={(e) => setNewUserStatus(e.target.value as AccountStatus)}
                    className="min-h-[42px] px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl"
                  >
                    <option value="pending">Pending Approval</option>
                    <option value="approved">Approved</option>
                    <option value="blocked">Blocked</option>
                  </select>
                  <button
                    type="submit"
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
                  >
                    Create User
                  </button>
                </div>
              </form>
            )}

            {/* User Management Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-3">User Name</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Registration Date</th>
                    <th className="py-3 px-3">Account Status</th>
                    <th className="py-3 px-3">User Role</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        No users match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const normStatus = normalizeStatus(u.status);
                      return (
                        <tr key={u.uid} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-teal-600/10 text-teal-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                                {(u.displayName || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-extrabold text-slate-900">{u.displayName}</div>
                                {u.phone && (
                                  <div className="text-[11px] text-slate-400 font-mono">{u.phone}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 font-mono text-slate-600">{u.email}</td>
                          <td className="py-3.5 px-3 font-mono text-slate-500">
                            {formatDateString(u.createdAt)}
                          </td>
                          <td className="py-3.5 px-3">{getStatusBadge(u.status)}</td>
                          <td className="py-3.5 px-3">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase ${
                                u.role === 'admin'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {normStatus !== 'approved' && (
                                <button
                                  onClick={() => onUpdateUserStatus(u.uid, 'approved')}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition"
                                  title="Approve / Activate User"
                                >
                                  {normStatus === 'pending' ? 'Approve' : 'Activate'}
                                </button>
                              )}

                              {normStatus !== 'blocked' && (
                                <button
                                  onClick={() => onUpdateUserStatus(u.uid, 'blocked')}
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px] transition"
                                  title="Block User"
                                >
                                  Block
                                </button>
                              )}

                              {normStatus !== 'removed' && (
                                <button
                                  onClick={() => onUpdateUserStatus(u.uid, 'removed')}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] transition"
                                  title="Remove User"
                                >
                                  Remove
                                </button>
                              )}

                              <button
                                onClick={() =>
                                  onUpdateUserRole(u.uid, u.role === 'admin' ? 'user' : 'admin')
                                }
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition"
                                title="Toggle Admin / User Role"
                              >
                                {u.role === 'admin' ? 'Make User' : 'Make Admin'}
                              </button>

                              <button
                                onClick={() => setSelectedUserModal(u)}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] transition"
                              >
                                Details
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: BRANDING, THEME & CONFIGURABLE FOOTER CREDIT SETTINGS
         ===================================================================== */}
      {adminTab === 'settings' && (
        <form
          onSubmit={handleSettingsFormSubmit}
          className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-6 shadow-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Website Branding, Theme Colors & Footer Credit Configuration
              </h2>
              <p className="text-xs text-slate-500">
                Changes saved here update the header, logo, colors, SEO metadata, and footer credit across the entire platform.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFormSettings(DEFAULT_SITE_SETTINGS);
                  onSaveSiteSettings(DEFAULT_SITE_SETTINGS);
                }}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Reset Defaults
              </button>
              <button
                type="submit"
                disabled={isSavingSettings}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm"
              >
                {isSavingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Brand Identity */}
            <div className="space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                1. Brand Name & Logo Identity
              </h3>

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
                  Brand Tagline / Subtitle
                </label>
                <input
                  type="text"
                  value={formSettings.brandTagline}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, brandTagline: e.target.value })
                  }
                  placeholder="AI Photo Studio & Smart Media Suite"
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
                    <option value="svg">Clean SVG Monogram + Icon</option>
                    <option value="url">Custom Image URL</option>
                  </select>
                </div>

                {formSettings.logoType === 'svg' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Emblem Monogram
                    </label>
                    <input
                      type="text"
                      maxLength={3}
                      value={formSettings.logoText}
                      onChange={(e) =>
                        setFormSettings({ ...formSettings, logoText: e.target.value.toUpperCase() })
                      }
                      placeholder="MM"
                      className="w-full min-h-[44px] px-3.5 py-2 text-sm font-extrabold font-mono bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Custom Logo Image URL
                    </label>
                    <input
                      type="url"
                      value={formSettings.logoUrl}
                      onChange={(e) =>
                        setFormSettings({ ...formSettings, logoUrl: e.target.value })
                      }
                      placeholder="https://example.com/logo.png"
                      className="w-full min-h-[44px] px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Theme Colors & Configurable Footer Credit */}
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
                    <input
                      type="text"
                      value={formSettings.primaryColor}
                      onChange={(e) =>
                        setFormSettings({ ...formSettings, primaryColor: e.target.value })
                      }
                      className="w-full text-xs font-mono font-bold focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Secondary Dark Accent
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
                    <input
                      type="text"
                      value={formSettings.secondaryColor}
                      onChange={(e) =>
                        setFormSettings({ ...formSettings, secondaryColor: e.target.value })
                      }
                      className="w-full text-xs font-mono font-bold focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Footer Credit Text (Dynamic & Persistent)
                </label>
                <input
                  type="text"
                  required
                  value={formSettings.footerCredit}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, footerCredit: e.target.value })
                  }
                  placeholder="© 2026 MALNADU MEDIA. All rights reserved."
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl font-medium"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Displayed dynamically in the website footer across desktop and mobile.
                </p>
              </div>
            </div>
          </div>

          {/* SEO & Feature Toggles */}
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
                      className="w-4 h-4 accent-teal-600 rounded"
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
              className="min-h-[48px] px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-sm transition flex items-center gap-2"
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
                      <td className="py-3 px-3 font-mono font-bold text-teal-700">
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
                      <span className="text-[11px] font-mono font-bold uppercase text-teal-700">
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
                      <span className="text-[11px] font-mono font-bold uppercase text-teal-700">
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
