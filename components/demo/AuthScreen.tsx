import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signInWithGoogle } from '../../lib/firebase';
import './AuthScreen.css';

interface AuthScreenProps {
  children: React.ReactNode;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const isLocalDevHost =
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error(e);
    } finally {
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-page">
        <div className="ambient-glow glow-1" />
        <div className="ambient-glow glow-2" />
        <div className="auth-loading">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  if (user || isLocalDevHost) {
    return <>{children}</>;
  }

  return (
    <div className="auth-page">
      <div className="ambient-glow glow-1" />
      <div className="ambient-glow glow-2" />

      <main className="auth-main-stage">
        <div className="auth-modal">
          <div className="auth-modal-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M2 12h2M6 8v8M10 5v14M14 9v6M18 7v10M22 12h-2" stroke="url(#wf-grad)" strokeWidth="2" strokeLinecap="round"/>
              <defs>
                <linearGradient id="wf-grad" x1="2" y1="12" x2="22" y2="12" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#a5b4fc"/>
                  <stop offset="1" stopColor="#7dd3fc"/>
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="auth-modal-header">
            <h1>Sign in to continue</h1>
            <p>Access your native audio sandboxes and custom function calling environments.</p>
          </div>

          <div className="auth-methods">
            <button
              className="auth-btn-google"
              onClick={handleGoogleSignIn}
              disabled={signingIn}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {signingIn ? 'Signing in...' : 'Continue with Google'}
            </button>

            <div className="auth-divider">
              <span>or</span>
            </div>

            <button className="auth-btn-secondary" type="button" disabled aria-disabled="true">
              <span className="material-symbols-outlined">mail</span>
              Continue with Email
            </button>
          </div>

          <div className="auth-modal-footer">
            By continuing, you agree to Beatrice Playground's<br />
            <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
          </div>
        </div>
      </main>
    </div>
  );
};

export default AuthScreen;
