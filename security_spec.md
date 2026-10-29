# Security Specification — PassportStudio Pro

## 1. Data Invariants

1. **Identity Integrity (`users/{userId}`)**:
   - Every user profile document ID `{userId}` must match `request.auth.uid` and `incoming().uid`.
   - Non-admin users can only create their profile with `role == 'user'` and `status == 'active'`. Only the bootstrapped admin (`shriyanshsingh7581@gmail.com` with `email_verified == true`) or an existing admin (`users/$(request.auth.uid).data.role == 'admin'`) can assign or hold `role == 'admin'`.
   - `uid` and `createdAt` are immutable after creation.

2. **Appointment Ownership & State (`appointments/{appointmentId}`)**:
   - An appointment can only be created if `incoming().userId == request.auth.uid` and `exists(/databases/$(database)/documents/users/$(request.auth.uid))`.
   - Non-admin users can only create appointments with `status == 'pending'`.
   - Once an appointment reaches a terminal state (`status == 'completed'` or `status == 'cancelled'`), non-admin users cannot modify it.
   - Non-admin owners can only cancel their appointment (`status == 'cancelled'`) or update `notes`. Admins can transition status across `['pending', 'confirmed', 'completed', 'cancelled']` and update `notes`.

3. **Document Verification Ownership & State (`verifications/{verificationId}`)**:
   - A document verification request can only be created if `incoming().userId == request.auth.uid` and `exists(/databases/$(database)/documents/users/$(request.auth.uid))`.
   - Non-admin users can only create verifications with `status == 'pending'`.
   - Once a verification reaches a terminal state (`status == 'verified'` or `status == 'rejected'`), non-admin users cannot modify it.
   - Only admins can transition `status` to `'under_review'`, `'verified'`, or `'rejected'` and update `remarks`.

4. **Saved Photos (`savedPhotos/{photoId}`)**:
   - A saved photo can only be created if `incoming().userId == request.auth.uid` and `exists(/databases/$(database)/documents/users/$(request.auth.uid))`.
   - Saved photos are immutable once created (only `create`, `get`, `list`, and `delete` by owner or admin).

---

## 2. The "Dirty Dozen" Payloads

1. **Privilege Escalation on User Registration**:
   - Target: `/users/attacker_uid` (`create`)
   - Payload: `{ "uid": "attacker_uid", "displayName": "Attacker", "email": "attacker@example.com", "phone": "9999999999", "role": "admin", "status": "active", "createdAt": "SERVER_TIMESTAMP", "updatedAt": "SERVER_TIMESTAMP" }`
   - Expected: `PERMISSION_DENIED` (Self-assigned `admin` role blocked).

2. **Shadow Field Injection on User Update**:
   - Target: `/users/user_1` (`update`)
   - Payload: `{ ...existingUser, "isSuperAdmin": true, "updatedAt": "SERVER_TIMESTAMP" }`
   - Expected: `PERMISSION_DENIED` (`hasOnly` and `affectedKeys` block ghost fields).

3. **Unverified Admin Email Spoofing**:
   - Target: `/users/victim_uid` (`get` by unverified `shriyanshsingh7581@gmail.com` where `email_verified: false`)
   - Expected: `PERMISSION_DENIED` (`isAdmin()` requires `email_verified == true`).

4. **PII Leak via Cross-User Profile Read**:
   - Target: `/users/user_2` (`get` by authenticated `user_1`)
   - Expected: `PERMISSION_DENIED` (Strict PII isolation: only `isOwner(userId)` or `isAdmin()` can read `/users/{userId}`).

5. **Orphaned Appointment Creation (Missing User Profile)**:
   - Target: `/appointments/apt_1` (`create` by `ghost_user` with no `/users/ghost_user` document)
   - Expected: `PERMISSION_DENIED` (Global consistency check `exists(/users/$(request.auth.uid))` fails).

6. **Identity Spoofing on Appointment Creation**:
   - Target: `/appointments/apt_2` (`create` by `user_1` setting `userId: "user_2"`)
   - Expected: `PERMISSION_DENIED` (`data.userId == request.auth.uid` fails).

7. **State Shortcutting on Appointment Creation**:
   - Target: `/appointments/apt_3` (`create` by `user_1` setting `status: "confirmed"`)
   - Expected: `PERMISSION_DENIED` (Initial status must be `'pending'` for non-admins).

8. **Terminal State Bypass on Completed Appointment**:
   - Target: `/appointments/apt_completed` (`update` by `user_1` trying to change `notes` when `existing().status == 'completed'`)
   - Expected: `PERMISSION_DENIED` (Terminal state lock blocks non-admin updates).

9. **Self-Verification of Document Request**:
   - Target: `/verifications/ver_1` (`update` by owner `user_1` setting `status: "verified"`)
   - Expected: `PERMISSION_DENIED` (Only `isAdmin()` can set `status` to `'verified'`).

10. **Value Poisoning / Oversized Payload on Verification**:
    - Target: `/verifications/ver_2` (`create` with `documentNumber` length > 50 or `remarks` length > 500)
    - Expected: `PERMISSION_DENIED` (Strict `isValidVerification` boundary limits reject oversized strings).

11. **Timestamp Forgery on Saved Photo**:
    - Target: `/savedPhotos/photo_1` (`create` with past/future client timestamp `createdAt != request.time`)
    - Expected: `PERMISSION_DENIED` (Temporal integrity `incoming().createdAt == request.time` fails).

12. **Unauthorized Blanket List Scraping**:
    - Target: `/appointments` (`list` query by `user_1` without filtering `where('userId', '==', 'user_1')`)
    - Expected: `PERMISSION_DENIED` (`allow list` enforces `resource.data.userId == request.auth.uid || isAdmin()`).
