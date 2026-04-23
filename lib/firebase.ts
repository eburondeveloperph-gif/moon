import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDjmcE7CiKrNpSnu20gFB2cG620HU36Zqg",
  authDomain: "gen-lang-client-0836251512.firebaseapp.com",
  databaseURL: "https://gen-lang-client-0836251512-default-rtdb.firebaseio.com",
  projectId: "gen-lang-client-0836251512",
  storageBucket: "gen-lang-client-0836251512.firebasestorage.app",
  messagingSenderId: "811711024905",
  appId: "1:811711024905:web:65c6d67b963f9fec1b8dd8",
  measurementId: "G-Z597RGXF9K"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Add Workspace scopes so the user enables/accepts them during authentication
googleProvider.addScope('https://mail.google.com/'); // Gmail
googleProvider.addScope('https://www.googleapis.com/auth/drive'); // G Drive
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets'); // Google Sheet
googleProvider.addScope('https://www.googleapis.com/auth/documents'); // Google Docs
googleProvider.addScope('https://www.googleapis.com/auth/presentations'); // Google Slides
googleProvider.addScope('https://www.googleapis.com/auth/chat.spaces'); // Google Chat
googleProvider.addScope('https://www.googleapis.com/auth/chat.messages'); // Google Chat
googleProvider.addScope('https://www.googleapis.com/auth/calendar'); // Calendar
googleProvider.addScope('https://www.googleapis.com/auth/forms.body'); // Forms
googleProvider.addScope('https://www.googleapis.com/auth/forms.responses.readonly'); // Forms
googleProvider.addScope('https://www.googleapis.com/auth/youtube'); // YouTube

export const signInWithGoogle = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
  }
};
