import React, { useState } from 'react';
import {
  UserProfile,
  AppointmentRecord,
  DocumentVerificationRecord,
  BRANCH_LOCATIONS,
  TIME_SLOTS,
} from '../constants';

interface AdminPanelProps {
  users: UserProfile[];
  appointments: AppointmentRecord[];
  verifications: DocumentVerificationRecord[];
  onUpdateUserRoleOrStatus: (
    targetUser: UserProfile,
    newRole: 'user' | 'admin',
    newStatus: 'active' | 'suspended'
  ) => Promise<void>;
  onUpdateAppointmentAdmin: (
    apt: AppointmentRecord,
    status: AppointmentRecord['status'],
    notes: string,
    appointmentDate?: string,
    timeSlot?: AppointmentRecord['timeSlot'],
    branchLocation?: AppointmentRecord['branchLocation']
  ) => Promise<void>;
  onDeleteAppointment: (id: string) => Promise<void>;
  onProcessVerificationAdmin: (
    ver: DocumentVerificationRecord,
    status: DocumentVerificationRecord['status'],
    remarks: string
  ) => Promise<void>;
  onDeleteVerification: (id: string) => Promise<void>;
  onSeedSampleData: () => Promise<void>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  users,
  appointments,
  verifications,
  onUpdateUserRoleOrStatus,
  onUpdateAppointmentAdmin,
  onDeleteAppointment,
  onProcessVerificationAdmin,
  onDeleteVerification,
  onSeedSampleData,
}) => {
  const [activeTab, setActiveTab] = useState<'verifications' | 'appointments' | 'users'>('verifications');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [remarksDraft, setRemarksDraft] = useState<Record<string, string>>({});
  const [aptNotesDraft, setAptNotesDraft] = useState<Record<string, string>>({});
  const [isSeeding, setIsSeeding] = useState(false);

  const pendingVerifications = verifications.filter((v) => v.status === 'pending' || v.status === 'under_review').length;
  const pendingAppointments = appointments.filter((a) => a.status === 'pending').length;
  const verifiedDocsCount = verifications.filter((v) => v.status === 'verified').length;

  const q = searchQuery.trim().toLowerCase();

  const filteredVerifications = verifications.filter((v) => {
    const matchesSearch =
      !q ||
      v.userName.toLowerCase().includes(q) ||
      v.userEmail.toLowerCase().includes(q) ||
      v.documentNumber.toLowerCase().includes(q) ||
      v.documentType.toLowerCase().includes(q) ||
      v.country.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredAppointments = appointments.filter((a) => {
    const matchesSearch =
      !q ||
      a.userName.toLowerCase().includes(q) ||
      a.userEmail.toLowerCase().includes(q) ||
      a.phone.toLowerCase().includes(q) ||
      a.serviceType.toLowerCase().includes(q) ||
      a.branchLocation.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !q ||
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone && u.phone.toLowerCase().includes(q));
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter || u.role === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getBadgeStyle = (status: string) => {
    switch (status) {
      case 'verified':
      case 'confirmed':
      case 'completed':
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'pending':
      case 'under_review':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'rejected':
      case 'cancelled':
      case 'suspended':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await onSeedSampleData();
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Admin Control Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-300">
            <span>PassportStudio Pro</span>
            <span aria-hidden="true">·</span>
            <span>Administration & Compliance Desk</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-1">
            Studio Operations & Verification Console
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage registered applicants, track studio appointments, and process biometric document verifications.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <i className="fa-solid fa-database text-indigo-400"></i>
            <span>{isSeeding ? 'Populating Demo Queue...' : 'Load Sample Queue Data'}</span>
          </button>
        </div>
      </div>

      {/* 4-Column Admin KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500">Registered Users</div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums mt-1">
            {users.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Active accounts: <span className="font-mono tabular-nums">{users.filter((u) => u.status === 'active').length}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500">PendingAppointments</div>
          <div className="text-2xl font-extrabold text-amber-600 font-mono tabular-nums mt-1">
            {pendingAppointments}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Total scheduled: <span className="font-mono tabular-nums">{appointments.length}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500">Verification Queue</div>
          <div className="text-2xl font-extrabold text-indigo-600 font-mono tabular-nums mt-1">
            {pendingVerifications}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Awaiting officer review</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500">Approved Documents</div>
          <div className="text-2xl font-extrabold text-emerald-600 font-mono tabular-nums mt-1">
            {verifiedDocsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">300 DPI Biometric Compliant</div>
        </div>
      </div>

      {/* Filter & Navigation Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => {
              setActiveTab('verifications');
              setStatusFilter('all');
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'verifications'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fa-solid fa-file-shield"></i>
            <span>Document Verifications ({verifications.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('appointments');
              setStatusFilter('all');
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'appointments'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fa-solid fa-calendar-check"></i>
            <span>Appointments ({appointments.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('users');
              setStatusFilter('all');
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'users'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fa-solid fa-users-gear"></i>
            <span>Manage Users ({users.length})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, ID, email, branch..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700"
          >
            <option value="all">All Statuses</option>
            {activeTab === 'verifications' && (
              <>
                <option value="pending">Pending</option>
                <option value="under_review">Under Review</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </>
            )}
            {activeTab === 'appointments' && (
              <>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </>
            )}
            {activeTab === 'users' && (
              <>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="admin">Admins</option>
                <option value="user">Standard Users</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* 1. DOCUMENT VERIFICATIONS PROCESSING VIEW */}
      {activeTab === 'verifications' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Biometric & Document Verification Queue</h2>
              <p className="text-xs text-slate-500">
                Inspect applicant photo proofs, validate ID numbers, and issue verification decisions
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              Showing {filteredVerifications.length} of {verifications.length}
            </span>
          </div>

          {filteredVerifications.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="text-xs text-slate-500">No verification requests match the current filter.</div>
              <button
                onClick={handleSeed}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
              >
                Populate Sample Verification Requests
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredVerifications.map((ver) => {
                const currentRemark =
                  remarksDraft[ver.id] !== undefined ? remarksDraft[ver.id] : ver.remarks;
                return (
                  <div
                    key={ver.id}
                    className="p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 hover:bg-slate-50/60 transition"
                  >
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      {ver.photoPreviewDataUrl ? (
                        <img
                          src={ver.photoPreviewDataUrl}
                          alt={ver.documentType}
                          referrerPolicy="no-referrer"
                          className="w-16 h-20 rounded-xl object-cover border border-slate-300 bg-white shadow-sm shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-20 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                          <i className="fa-solid fa-id-card text-xl"></i>
                        </div>
                      )}

                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-extrabold text-slate-900">{ver.documentType}</span>
                          <span className="text-xs font-mono font-semibold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                            ID: {ver.documentNumber}
                          </span>
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded border uppercase ${getBadgeStyle(ver.status)}`}>
                            {ver.status.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600">
                          Applicant: <span className="font-bold text-slate-800">{ver.userName}</span> ({ver.userEmail}) · Target:{' '}
                          <span className="font-semibold text-indigo-700">{ver.country}</span>
                        </div>

                        <div className="flex items-center gap-2 pt-1 max-w-xl">
                          <input
                            type="text"
                            value={currentRemark}
                            onChange={(e) =>
                              setRemarksDraft((prev) => ({ ...prev, [ver.id]: e.target.value }))
                            }
                            placeholder="Add officer verification note or rejection reason..."
                            className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        onClick={() =>
                          onProcessVerificationAdmin(
                            ver,
                            'under_review',
                            currentRemark || 'Under biometric officer review'
                          )
                        }
                        className="px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition whitespace-nowrap"
                      >
                        Mark In-Review
                      </button>
                      <button
                        onClick={() =>
                          onProcessVerificationAdmin(
                            ver,
                            'verified',
                            currentRemark || 'Biometric & ICAO 300 DPI compliance verified.'
                          )
                        }
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <i className="fa-solid fa-check"></i>
                        <span>Approve & Verify</span>
                      </button>
                      <button
                        onClick={() =>
                          onProcessVerificationAdmin(
                            ver,
                            'rejected',
                            currentRemark || 'Background or head margin does not meet embassy standard.'
                          )
                        }
                        className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition whitespace-nowrap"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => onDeleteVerification(ver.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Delete record"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. APPOINTMENTS TRACKING VIEW */}
      {activeTab === 'appointments' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Studio Appointment Tracker</h2>
              <p className="text-xs text-slate-500">
                Confirm bookings, assign time slots, and mark studio sessions completed
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              Showing {filteredAppointments.length} of {appointments.length}
            </span>
          </div>

          {filteredAppointments.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="text-xs text-slate-500">No appointments match the current filter.</div>
              <button
                onClick={handleSeed}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
              >
                Populate Sample Appointments
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredAppointments.map((apt) => {
                const currentNotes =
                  aptNotesDraft[apt.id] !== undefined ? aptNotesDraft[apt.id] : apt.notes;
                return (
                  <div
                    key={apt.id}
                    className="p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 hover:bg-slate-50/60 transition"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900">{apt.serviceType}</span>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded border uppercase ${getBadgeStyle(apt.status)}`}>
                          {apt.status}
                        </span>
                        <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {apt.appointmentDate} · {apt.timeSlot}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600">
                        Applicant: <span className="font-bold text-slate-800">{apt.userName}</span> ({apt.userEmail}) · Phone:{' '}
                        <span className="font-mono font-semibold text-slate-800">{apt.phone}</span>
                      </div>

                      <div className="text-xs text-slate-500">
                        Branch: <span className="font-semibold text-slate-700">{apt.branchLocation}</span> · Spec:{' '}
                        <span>{apt.countrySpec}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1 max-w-2xl">
                        <input
                          type="text"
                          value={currentNotes}
                          onChange={(e) =>
                            setAptNotesDraft((prev) => ({ ...prev, [apt.id]: e.target.value }))
                          }
                          placeholder="Studio desk notes..."
                          className="flex-1 min-w-[220px] px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                        />
                        <select
                          value={apt.timeSlot}
                          onChange={(e) =>
                            onUpdateAppointmentAdmin(
                              apt,
                              apt.status,
                              currentNotes,
                              apt.appointmentDate,
                              e.target.value as any,
                              apt.branchLocation
                            )
                          }
                          className="px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
                        >
                          {TIME_SLOTS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <select
                          value={apt.branchLocation}
                          onChange={(e) =>
                            onUpdateAppointmentAdmin(
                              apt,
                              apt.status,
                              currentNotes,
                              apt.appointmentDate,
                              apt.timeSlot,
                              e.target.value as any
                            )
                          }
                          className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                        >
                          {BRANCH_LOCATIONS.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        onClick={() => onUpdateAppointmentAdmin(apt, 'confirmed', currentNotes)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition whitespace-nowrap"
                      >
                        Confirm Slot
                      </button>
                      <button
                        onClick={() => onUpdateAppointmentAdmin(apt, 'completed', currentNotes)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition whitespace-nowrap"
                      >
                        Mark Completed
                      </button>
                      <button
                        onClick={() => onUpdateAppointmentAdmin(apt, 'cancelled', currentNotes)}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition whitespace-nowrap"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => onDeleteAppointment(apt.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Delete appointment"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. USER MANAGEMENT VIEW */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Registered User Directory</h2>
              <p className="text-xs text-slate-500">
                Manage applicant accounts, grant officer/admin privileges, or suspend access
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {filteredUsers.length} Users
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase">
                  <th className="py-3 px-4">Applicant Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredUsers.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">{u.displayName}</td>
                    <td className="py-3 px-4 text-slate-600">{u.email}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{u.phone || '—'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                          u.role === 'admin'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${getBadgeStyle(u.status)}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() =>
                          onUpdateUserRoleOrStatus(
                            u,
                            u.role === 'admin' ? 'user' : 'admin',
                            u.status
                          )
                        }
                        className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold transition"
                      >
                        {u.role === 'admin' ? 'Demote to User' : 'Make Admin'}
                      </button>
                      <button
                        onClick={() =>
                          onUpdateUserRoleOrStatus(
                            u,
                            u.role,
                            u.status === 'active' ? 'suspended' : 'active'
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg border font-semibold transition ${
                          u.status === 'active'
                            ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {u.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
