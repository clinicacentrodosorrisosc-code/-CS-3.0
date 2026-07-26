import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebaseConfig';

const provider = new GoogleAuthProvider();
// Add required Google Workspace scopes
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.addScope('https://www.googleapis.com/auth/documents.readonly');

let cachedAccessToken: string | null = null;

// Initialize auth state listener
export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // If logged in via Firebase but token is not in cache (e.g. page reload),
        // we prompt sign-in again to refresh token or standard flow.
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google
export const signInWithGoogleDocs = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Não foi possível obter o token de acesso do Google.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-in failed:', error);
    throw error;
  }
};

export const getGoogleAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logoutGoogleDocs = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

// Fetch google docs from user's GDrive
export const fetchGoogleDocs = async (token: string): Promise<any[]> => {
  try {
    const response = await fetch(
      'https://www.googleapis.com/drive/v3/files?q=mimeType=\'application/vnd.google-apps.document\'&fields=files(id,name,mimeType,createdTime,modifiedTime,size,webViewLink,owners)',
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    if (!response.ok) {
      throw new Error(`Drive API returned status ${response.status}`);
    }
    const data = await response.json();
    return data.files || [];
  } catch (err) {
    console.error('Error fetching Google Docs list:', err);
    throw err;
  }
};

// Export Google Doc as plain text for printing/previewing
export const fetchGoogleDocContent = async (fileId: string, token: string): Promise<string> => {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to export Google Doc. Status ${response.status}`);
    }
    const textContent = await response.text();
    return textContent;
  } catch (err) {
    console.error('Error fetching Google Doc text:', err);
    throw err;
  }
};
