# Firebase Security Specification (`security_spec.md`)

This document defines the attribute-based access control (ABAC) matrix, validation schemas, and structural boundaries of the Inventory Service Suite backend.

## 1. Data Invariants

1. **User Identity Isolation**: No authenticated or anonymous user may read another user's private state, change their own role, or access system records unless explicitly granted by their role (Owner, Manager, Staff).
2. **Strict Immutable Timestamps**: All chronological logs and inventory item additions must use `request.time` for temporal validity. Client dates are not trusted.
3. **No Phantom Updates**: For any update transaction, users may only modify fields they are explicitly entitled to through action-based allowlists.
4. **Verified Emails Only**: All operators must have a verified email (`request.auth.token.email_verified == true`) to perform core write actions, preventing fake signup spam.

---

## 2. The "Dirty Dozen" Malicious Payloads

The following payloads represent targeted attacks attempting to breach system security. All must return `PERMISSION_DENIED`:

### Identity Spoofing & self-promotion
1. **Self-Assigned Admin privileges**: A new registrant attempts to register themselves with `role: "Owner"` or `role: "Admin"`.
2. **Impersonated Author UID field**: User `attacker123` attempts to write a Stock Movement Log with `operatorName: "Vijay Naik"` or setting the creator ID of another document to a different UID.

### State Shortcutting & Phantom Fields
3. **Ghost Fields injection**: A malicious user attempts to update a CCTV product catalog adding extra fields like `isApprovedByOwner: true` or `discountCode: "100FREE"`.
4. **Terminal State override**: An operator attempts to alter a Service Job currently marked as `Delivered` back to `Received` to tamper with historical pricing records.

### Resource Poisoning & Denial of Wallet
5. **Huge ID characters payload**: Injecting a extremely long junk string as a document or collection UUID (e.g., a 2KB key) to exhaust index sizes.
6. **Malicious Negative Quantity**: Attempting to set an inventory stock item quantity to a negative number or a non-integer float.

### Spatial Bypass & Orphan Writes
7. **Orphan Log without CCTV Reference**: Creating a Stock Movement Log targeting a non-existent or deleted hardware element ID.
8. **Malicious Empty Name Input**: Registering a customer profile with an empty string or a name of more than 500 characters.

### Privilege Escalation & Cross-tenant leaking
9. **Private Document Intrusion**: A Technician attempting to view or download another administrator's system-only configuration logs.
10. **Unchecked List Scraping**: Bypassing query filters to list all security configurations, hoping the system trusts the client to limit.
11. **Malicious Array Bloat**: Adding 1,000 tags into a list to crash UI render loops and exhaust memory.
12. **Tampering with audit logs**: Attempting to edit or delete existing `movement_logs` records.

---

## 3. Test Runner Configurations

Our integration checks will assert:
* `assertSucceeds(createUserProfile)` with correct verified signature.
* `assertFails(updateRoleBySelf)` as standard operator.
* `assertFails(maliciousGhostFieldWrite)`.
* `assertFails(auditLogAltering)`.
