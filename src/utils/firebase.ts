import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendEmailVerification, 
  sendPasswordResetEmail,
  signOut
} from "firebase/auth";
import { 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc, 
  getDoc, 
  getDocFromServer,
  setDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  limit, 
  orderBy,
  arrayUnion,
  arrayRemove,
  serverTimestamp
} from "firebase/firestore";
import CryptoJS from "crypto-js";
import firebaseConfig from "../../firebase-applet-config.json";

// Standard Firebase SDK initializations
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Enable fully robust persistent local cache for multi-tab offline operations as recommended
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// Strict client verification test on initial boot
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("Firestore client is offline. Check Firebase settings.");
    }
  }
}
testFirestoreConnection();

// --- Skill Compliant Struct: Firestore error handling ---
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error Exception Logged: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- PII Security & Encrypted Local Storage Helper ---
const SECURE_LOCAL_SECRET = "INV_SECURE_ERP_SALT_2026";

export const encryptedStorage = {
  setItem: (key: string, value: any): void => {
    try {
      const plaintext = typeof value === "string" ? value : JSON.stringify(value);
      const ciphertext = CryptoJS.AES.encrypt(plaintext, SECURE_LOCAL_SECRET).toString();
      localStorage.setItem(`_enc_${key}`, ciphertext);
    } catch (e) {
      console.error("Encryption local write failure:", e);
    }
  },
  getItem: <T = any>(key: string): T | null => {
    try {
      const ciphertext = localStorage.getItem(`_enc_${key}`);
      if (!ciphertext) return null;
      const bytes = CryptoJS.AES.decrypt(ciphertext, SECURE_LOCAL_SECRET);
      const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
      if (!decryptedText) return null;
      try {
        return JSON.parse(decryptedText) as T;
      } catch (_) {
        return decryptedText as unknown as T;
      }
    } catch (e) {
      console.error("Decryption local load failure:", e);
      return null;
    }
  },
  removeItem: (key: string): void => {
    localStorage.removeItem(`_enc_${key}`);
  }
};

// --- Security Features: Audit Logs & Fail Attempt Limiting ---
export interface AuditLogItem {
  id: string;
  userId: string | null;
  email: string;
  action: string;
  status: "success" | "failure" | "blocked" | "reset";
  timestamp: string;
  deviceDetails: string;
}

// Log actions dynamically both as telemetry and securely into Firestore if signed in
export async function logAuditEntry(
  email: string,
  userId: string | null,
  action: string,
  status: "success" | "failure" | "blocked" | "reset"
) {
  const logId = `AUDIT_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const record: AuditLogItem = {
    id: logId,
    userId,
    email,
    action,
    status,
    timestamp: new Date().toISOString(),
    deviceDetails: navigator.userAgent || "Desktop Terminal"
  };

  // Local mirror
  const logsList = encryptedStorage.getItem<AuditLogItem[]>("inv_audit_logs") || [];
  encryptedStorage.setItem("inv_audit_logs", [record, ...logsList].slice(0, 50)); // cap local storage limits

  // Write to cloud database if permitted
  try {
    await setDoc(doc(db, "audit_logs", logId), {
      ...record,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    // If not authenticated, we let it slide since rules match auth. But we try to write when authenticated!
    console.log("Background cloud log write saved offline or restricted.");
  }
}

// --- Device Handshake Multi-Device Setup ---
export function getOrCreateDeviceId(): string {
  let devId = encryptedStorage.getItem<string>("device_identifier");
  if (!devId) {
    devId = `DEVICE_NODE_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    encryptedStorage.setItem("device_identifier", devId);
  }
  return devId;
}

// --- Lockout control & Status verification functions ---
export interface UserStatusCheckResult {
  allowed: boolean;
  reason: string;
  status: "active" | "disabled" | "locked";
  failedAttempts: number;
  userId?: string;
  role?: string;
}

export async function checkUserStatusAndAttempts(email: string): Promise<UserStatusCheckResult> {
  const normEmail = email.toLowerCase();
  try {
    const q = query(collection(db, "users"), where("email", "==", normEmail), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docData = snap.docs[0].data();
      const status = (docData.status || "active") as "active" | "disabled" | "locked";
      const failedAttempts = docData.failedAttempts || 0;
      const userId = snap.docs[0].id;
      const role = docData.role;

      if (status === "disabled") {
        return {
          allowed: false,
          reason: "This operator account profile has been disabled under administrative policy regulations.",
          status,
          failedAttempts,
          userId,
          role
        };
      }
      if (status === "locked" || failedAttempts >= 5) {
        return {
          allowed: false,
          reason: "This operator account profile is locked due to 5+ repeated failed login attempts.",
          status: "locked",
          failedAttempts,
          userId,
          role
        };
      }

      return {
        allowed: true,
        reason: "",
        status,
        failedAttempts,
        userId,
        role
      };
    }
  } catch (err) {
    console.error("Firestore user status query failed:", err);
  }
  return { allowed: true, reason: "", status: "active", failedAttempts: 0 };
}

export async function registerFailedLoginAttempt(email: string): Promise<number> {
  const normEmail = email.toLowerCase();
  
  // Update in local failure count first
  const localFailuresKey = `failures_${normEmail}`;
  const currentCount = (encryptedStorage.getItem<number>(localFailuresKey) || 0) + 1;
  encryptedStorage.setItem(localFailuresKey, currentCount);

  // Look up user doc to record failure securely
  try {
    const q = query(collection(db, "users"), where("email", "==", normEmail), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const userDoc = snap.docs[0];
      const nextCount = (userDoc.data().failedAttempts || 0) + 1;
      
      const updates: any = { failedAttempts: nextCount };
      if (nextCount >= 5) {
        updates.status = "locked";
        await logAuditEntry(normEmail, userDoc.id, "Account Auto-Locked from Repeated Failures", "blocked");
      } else {
        await logAuditEntry(normEmail, userDoc.id, `Unsuccessful Login Attempt #${nextCount}`, "failure");
      }
      
      await updateDoc(userDoc.ref, updates);
      return nextCount;
    }
  } catch (err) {
    console.error("Cloud failed login logging unsuccessful:", err);
  }

  if (currentCount >= 5) {
    await logAuditEntry(normEmail, null, "Local Lockout Triggered via brute force guard", "blocked");
  } else {
    await logAuditEntry(normEmail, null, `Local unsuccessful login attempt #${currentCount}`, "failure");
  }
  return currentCount;
}

export async function resetFailedLoginAttempts(userId: string, email: string) {
  try {
    const docRef = doc(db, "users", userId);
    await updateDoc(docRef, {
      failedAttempts: 0,
      lastLoginAt: serverTimestamp()
    });
    encryptedStorage.setItem(`failures_${email.toLowerCase()}`, 0);
  } catch (e) {
    console.error("Failure reset on cloud skipped:", e);
  }
}

// --- Control Multi-Device Session ---
export async function updateActiveDevices(userId: string, deviceId: string, action: "login" | "logout"): Promise<string[]> {
  try {
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const currentDevices: string[] = docSnap.data().devices || [];
      let updatedDevices = [...currentDevices];
      
      if (action === "login") {
        if (!updatedDevices.includes(deviceId)) {
          updatedDevices.push(deviceId);
        }
      } else {
        updatedDevices = updatedDevices.filter(d => d !== deviceId);
      }
      
      await updateDoc(docRef, {
        devices: updatedDevices
      });
      return updatedDevices;
    }
  } catch (e) {
    console.error("Failed to sync devices on cloud document:", e);
  }
  return [];
}

// --- Authentic Firebase wrappers (Requirements) ---

// 1. Unified Operator registration procedure
export async function registerNewOperator(email: string, password: string, name: string, role: string) {
  const res = await createUserWithEmailAndPassword(auth, email, password);
  if (res.user) {
    try {
      // Send email verification link - relaxed to avoid breaking registration on server sending failures
      try {
        await sendEmailVerification(res.user);
      } catch (emailErr) {
        console.warn("Could not send email verification link, bypassing:", emailErr);
      }
      
      // Create Firestore custom operator profile
      const profile = {
        uid: res.user.uid,
        name,
        email: email.toLowerCase(),
        role,
        status: "active",
        failedAttempts: 0,
        devices: [getOrCreateDeviceId()],
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, "users", res.user.uid), profile);
      await logAuditEntry(email, res.user.uid, "Sign-up / Operator account registered", "success");
      return { user: res.user, firestoreUser: profile };
    } catch (err: any) {
      console.error("Firestore document write during registration failed, cleaning up Auth user:", err);
      try {
        await res.user.delete();
      } catch (delErr) {
        console.warn("Auth user rollback cleanup failed:", delErr);
      }
      throw err;
    }
  }
  throw new Error("Creation returned an empty user node.");
}

// 2. Complete Firebase Authenticate operator session
export async function signInOperator(email: string, password: string) {
  const normEmail = email.toLowerCase();
  try {
    const res = await signInWithEmailAndPassword(auth, normEmail, password);
    if (res.user) {
      // Look up Firestore profile details
      const docRef = doc(db, "users", res.user.uid);
      let userSnap = await getDoc(docRef);
      
      let fData: any;
      if (!userSnap.exists()) {
        // Auto bootstrap non-existent accounts
        fData = {
          uid: res.user.uid,
          name: res.user.displayName || "Operator",
          email: normEmail,
          role: "Staff",
          status: "active",
          failedAttempts: 0,
          devices: [getOrCreateDeviceId()],
          createdAt: new Date().toISOString()
        };
        await setDoc(docRef, fData);
      } else {
        fData = userSnap.data();
        if (fData && (fData.status === "disabled" || fData.status === "locked")) {
          await auth.signOut();
          throw new Error(`This operator account is currently ${fData.status}. Please contact the system administrator.`);
        }
      }

      // Reset failed counters and append device
      await resetFailedLoginAttempts(res.user.uid, normEmail);
      await updateActiveDevices(res.user.uid, getOrCreateDeviceId(), "login");
      await logAuditEntry(normEmail, res.user.uid, "Login Successful (Session Authenticated)", "success");
      return { user: res.user, firestoreUser: fData };
    }
    throw new Error("Authentication returned an empty user node.");
  } catch (error: any) {
    // Record login attempts failure
    await registerFailedLoginAttempt(normEmail);
    throw error;
  }
}

// 3. Password reset
export async function sendPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, email);
  await logAuditEntry(email.toLowerCase(), null, "Password reset request dispatched to email", "reset");
}

// 4. Verification re-sending
export async function resendEmailVerificationLink() {
  if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser);
    await logAuditEntry(auth.currentUser.email || "unknown", auth.currentUser.uid, "Verification link dispatched manually", "reset");
  } else {
    throw new Error("No active user session found to dispatch activation email.");
  }
}

// 5. Google workspace provider integration
export async function firebaseSignInWithGoogle() {
  const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
  const provider = new GoogleAuthProvider();
  const res = await signInWithPopup(auth, provider);
  if (res.user) {
    const docRef = doc(db, "users", res.user.uid);
    let fData: any;

    try {
      const userSnap = await getDoc(docRef);
      if (!userSnap.exists()) {
        fData = {
          uid: res.user.uid,
          name: res.user.displayName || "Google Operator",
          email: res.user.email?.toLowerCase() || "",
          role: "Staff",
          status: "active",
          failedAttempts: 0,
          devices: [getOrCreateDeviceId()],
          createdAt: new Date().toISOString()
        };
        try {
          await setDoc(docRef, fData);
        } catch (writeErr) {
          console.warn("Failed to setDoc on Google sign-in (client offline):", writeErr);
        }
      } else {
        fData = userSnap.data();
      }
    } catch (err: any) {
      console.warn("Firestore lookup failed during Google Sign-In, falling back to local user state:", err);
      fData = {
        uid: res.user.uid,
        name: res.user.displayName || "Google Operator",
        email: res.user.email?.toLowerCase() || "",
        role: "Staff",
        status: "active",
        failedAttempts: 0,
        devices: [getOrCreateDeviceId()],
        createdAt: new Date().toISOString()
      };
    }

    // Safely attempt optional post-login writes without crashing the auth process if offline
    try {
      await resetFailedLoginAttempts(res.user.uid, res.user.email || "");
    } catch (err) {
      console.warn("Could not reset failed login attempts (offline):", err);
    }

    try {
      await updateActiveDevices(res.user.uid, getOrCreateDeviceId(), "login");
    } catch (err) {
      console.warn("Could not update active devices (offline):", err);
    }

    try {
      await logAuditEntry(res.user.email || "google_auth", res.user.uid, "Connected using Google SSO Credential syncs", "success");
    } catch (err) {
      console.warn("Could not log audit entry (offline):", err);
    }

    return { user: res.user, firestoreUser: fData };
  }
  throw new Error("Google login handshake aborted.");
}
