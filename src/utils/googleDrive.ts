import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/drive.file");
provider.setCustomParameters({
  prompt: "consent"
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize Auth listener and resolve state
export const initGoogleAuth = (
  onAuthSuccess?: (user: FirebaseUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Load token from memory-cache alternative for immediate session restores securely
  const sessionToken = sessionStorage.getItem("inv_drive_token");
  if (sessionToken) {
    cachedAccessToken = sessionToken;
  }

  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      sessionStorage.removeItem("inv_drive_token");
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: FirebaseUser; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to get Google Access Token from identification.");
    }
    cachedAccessToken = credential.accessToken;
    sessionStorage.setItem("inv_drive_token", cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error("Google Sign-In failed:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken || sessionStorage.getItem("inv_drive_token");
};

export const googleSignOut = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  sessionStorage.removeItem("inv_drive_token");
};

/**
 * Drive File Helper APIs
 */
const BACKUP_FILE_NAME = "inventory_service_backup.json";

export interface DriveBackupMetadata {
  id: string;
  name: string;
  modifiedTime: string;
}

// Find existing backup file description
export const findBackupFile = async (token: string): Promise<DriveBackupMetadata | null> => {
  const query = encodeURIComponent(`name='${BACKUP_FILE_NAME}' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)&spaces=drive`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    let errorMsg = `Drive file search failed with status: ${response.status}`;
    try {
      const errData = await response.json();
      if (errData?.error?.message) {
        errorMsg += ` (${errData.error.message})`;
      }
    } catch (_) {}
    throw new Error(errorMsg);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0] as DriveBackupMetadata;
  }
  return null;
};

// Write current datasets securely onto Google Drive
export const uploadBackupToDrive = async (token: string, payload: any): Promise<DriveBackupMetadata> => {
  // 1. Check if backup file already exists
  let fileMeta = await findBackupFile(token);
  let fileId = fileMeta?.id;

  if (!fileId) {
    // 2. Create high level metadata on Drive
    const createUrl = "https://www.googleapis.com/drive/v3/files";
    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: BACKUP_FILE_NAME,
        mimeType: "application/json"
      })
    });

    if (!createRes.ok) {
      let errorMsg = `Failed to create Google Drive backup placeholder. Status: ${createRes.status}`;
      try {
        const errData = await createRes.json();
        if (errData?.error?.message) {
          errorMsg += ` (${errData.error.message})`;
        }
      } catch (_) {}
      throw new Error(errorMsg);
    }

    const created = await createRes.json();
    fileId = created.id;
  }

  if (!fileId) {
    throw new Error("Could not construct cloud backup container ID.");
  }

  // 3. Upload raw JSON into media payload of that specified fileId
  const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
  const uploadRes = await fetch(uploadUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      version: "1.0",
      backedUpAt: new Date().toISOString(),
      ...payload
    })
  });

  if (!uploadRes.ok) {
    let errorMsg = `Media payload uploading failed. Status: ${uploadRes.status}`;
    try {
      const errData = await uploadRes.json();
      if (errData?.error?.message) {
        errorMsg += ` (${errData.error.message})`;
      }
    } catch (_) {}
    throw new Error(errorMsg);
  }

  // Fetch updated info to display correct modified date
  const infoUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,modifiedTime`;
  const infoRes = await fetch(infoUrl, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (infoRes.ok) {
    return await infoRes.json();
  }

  return {
    id: fileId,
    name: BACKUP_FILE_NAME,
    modifiedTime: new Date().toISOString()
  };
};

// Retrieve backup file and download payload
export const downloadBackupFromDrive = async (token: string, fileId: string): Promise<any> => {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    let errorMsg = `Failed to download backup database from Drive: Status ${response.status}`;
    try {
      const errData = await response.json();
      if (errData?.error?.message) {
        errorMsg += ` (${errData.error.message})`;
      }
    } catch (_) {}
    throw new Error(errorMsg);
  }

  return await response.json();
};
