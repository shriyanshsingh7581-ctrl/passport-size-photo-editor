/**
 * Hardened Red Team Security Test Suite for firestore.rules
 * Verifies all 12 "Dirty Dozen" adversarial payloads return PERMISSION_DENIED.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TEST_SUITE: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Privilege Escalation on User Registration',
    collection: '/users/attacker_uid',
    operation: 'create',
    auth: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    payload: {
      uid: 'attacker_uid',
      displayName: 'Attacker',
      email: 'attacker@example.com',
      phone: '9999999999',
      role: 'admin',
      status: 'active',
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP'
    },
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 2,
    name: 'Shadow Field Injection on User Update',
    collection: '/users/user_1',
    operation: 'update',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: {
      uid: 'user_1',
      displayName: 'User One',
      email: 'user1@example.com',
      phone: '9999999999',
      role: 'user',
      status: 'active',
      isSuperAdmin: true,
      createdAt: 'EXISTING_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP'
    },
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 3,
    name: 'Unverified Admin Email Spoofing',
    collection: '/users/victim_uid',
    operation: 'get',
    auth: { uid: 'spoof_admin', email: 'shriyanshsingh7581@gmail.com', email_verified: false },
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 4,
    name: 'PII Leak via Cross-User Profile Read',
    collection: '/users/user_2',
    operation: 'get',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 5,
    name: 'Orphaned Appointment Creation (Missing User Profile)',
    collection: '/appointments/apt_1',
    operation: 'create',
    auth: { uid: 'ghost_user', email: 'ghost@example.com', email_verified: true },
    payload: {
      userId: 'ghost_user',
      userName: 'Ghost User',
      userEmail: 'ghost@example.com',
      phone: '9876543210',
      serviceType: 'Passport Photo Shoot',
      countrySpec: 'India Standard Passport Size (35×45 mm)',
      branchLocation: 'Kochi Main Studio — MG Road',
      appointmentDate: '2026-11-15',
      timeSlot: '10:30 AM',
      status: 'pending',
      notes: '',
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP'
    },
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 6,
    name: 'Identity Spoofing on Appointment Creation',
    collection: '/appointments/apt_2',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: {
      userId: 'user_2',
      userName: 'User Two',
      userEmail: 'user2@example.com',
      phone: '9876543210',
      serviceType: 'Passport Photo Shoot',
      countrySpec: 'India Standard Passport Size (35×45 mm)',
      branchLocation: 'Kochi Main Studio — MG Road',
      appointmentDate: '2026-11-15',
      timeSlot: '10:30 AM',
      status: 'pending',
      notes: '',
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP'
    },
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 7,
    name: 'State Shortcutting on Appointment Creation',
    collection: '/appointments/apt_3',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: {
      userId: 'user_1',
      userName: 'User One',
      userEmail: 'user1@example.com',
      phone: '9876543210',
      serviceType: 'Passport Photo Shoot',
      countrySpec: 'India Standard Passport Size (35×45 mm)',
      branchLocation: 'Kochi Main Studio — MG Road',
      appointmentDate: '2026-11-15',
      timeSlot: '10:30 AM',
      status: 'confirmed',
      notes: '',
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP'
    },
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 8,
    name: 'Terminal State Bypass on Completed Appointment',
    collection: '/appointments/apt_completed',
    operation: 'update',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: {
      notes: 'Trying to modify completed appointment',
      updatedAt: 'SERVER_TIMESTAMP'
    },
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 9,
    name: 'Self-Verification of Document Request',
    collection: '/verifications/ver_1',
    operation: 'update',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: {
      status: 'verified',
      updatedAt: 'SERVER_TIMESTAMP'
    },
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 10,
    name: 'Value Poisoning / Oversized Payload on Verification',
    collection: '/verifications/ver_2',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: {
      userId: 'user_1',
      userName: 'User One',
      userEmail: 'user1@example.com',
      documentType: 'Indian Passport',
      documentNumber: 'X'.repeat(100),
      country: 'India',
      photoPreviewDataUrl: '',
      status: 'pending',
      remarks: '',
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP'
    },
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 11,
    name: 'Timestamp Forgery on Saved Photo',
    collection: '/savedPhotos/photo_1',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: {
      userId: 'user_1',
      presetName: 'India Standard Passport Size (35×45 mm)',
      dimensionsText: '35 × 45 mm @ 300 DPI',
      bgColor: '#FFFFFF',
      previewDataUrl: 'data:image/jpeg;base64,validdata',
      createdAt: '2020-01-01T00:00:00Z'
    },
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 12,
    name: 'Unauthorized Blanket List Scraping',
    collection: '/appointments',
    operation: 'list',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED'
  }
];
