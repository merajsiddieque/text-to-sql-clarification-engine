import React, { useState } from 'react';
import { createUserWithEmailAndPassword, GoogleAuthProvider, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { ArrowLeft, ArrowRight, CheckCircle2, Database, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { auth } from '../../../firebase';
import './AuthScreen.css';

const firebaseMessages = {
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled. Contact your administrator.',
  'auth/user-not-found': 'No account was found for this email. Create an account to continue.',
  'auth/wrong-password': 'The password is incorrect. Try again or reset it.',
  'auth/invalid-credential': 'The email or password is incorrect.',
  'auth/email-already-in-use': 'An account already exists for this email. Sign in instead.',
  'auth/weak-password': 'Choose a password with at least 6 characters.',
  'auth/popup-closed-by-user': 'The Google sign-in window was closed before finishing.',
  'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups and try again.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase Authentication.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/network-request-failed': 'Could not reach the authentication service. Check your connection.',
};

function getErrorMessage(error) {
  return firebaseMessages[error?.code] || 'We could not complete that request. Please try again.';
}

function GoogleMark() {
  return <svg aria-hidden="true" width="17" height="17" viewBox="0 0 48 48"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.9Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.8a12 12 0 0 1 0-7.6V15H5.8a20 20 0 0 0 0 18l6.8-5.2Z"/><path fill="#EA4335" d="M24 11.8c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 5.7 29.5 4 24 4A20 20 0 0 0 5.8 15l6.8 5.2c1.6-4.8 6.1-8.4 11.4-8.4Z"/></svg>;
}

export default function AuthScreen({ user, onRefreshUser }) {
  const [mode, setMode] = useState(user && !user.emailVerified ? 'verify' : 'signin');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const clearFeedback = () => { setError(''); setNotice(''); };
  const changeMode = (nextMode) => { clearFeedback(); setMode(nextMode); };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    clearFeedback();
    setBusy(true);
    try {
      if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email.trim());
        setNotice('If an account exists for this email, a password reset link is on its way.');
      } else if (mode === 'signup') {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        setMode('verify');
        await sendEmailVerification(credential.user);
        setNotice('Verification link sent. Open the email to confirm your address, then return here.');
      } else {
        const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
        if (!credential.user.emailVerified) {
          setMode('verify');
          await sendEmailVerification(credential.user);
          setNotice('Your email is not verified yet. We sent a fresh verification link.');
        }
      }
    } catch (authError) {
      setError(getErrorMessage(authError));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    clearFeedback();
    setBusy(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (authError) {
      setError(getErrorMessage(authError));
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (!auth.currentUser) return;
    clearFeedback();
    setBusy(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setNotice('A new verification link has been sent.');
    } catch (authError) {
      setError(getErrorMessage(authError));
    } finally {
      setBusy(false);
    }
  };

  const handleCheckVerification = async () => {
    clearFeedback();
    setBusy(true);
    try {
      const verified = await onRefreshUser();
      if (verified) setNotice('Email verified. Your workspace is ready.');
      else setError('We have not received verification yet. Open the link in your email, then check again.');
    } catch (authError) {
      setError(getErrorMessage(authError));
    } finally {
      setBusy(false);
    }
  };

  const handleChangeAccount = async () => {
    clearFeedback();
    setBusy(true);
    try {
      await signOut(auth);
      setEmail('');
      setPassword('');
      setMode('signin');
    } catch (authError) {
      setError(getErrorMessage(authError));
    } finally {
      setBusy(false);
    }
  };

  const isVerify = mode === 'verify';
  const isForgot = mode === 'forgot';
  const isSignup = mode === 'signup';

  return (
    <main className="auth-page">
      <section className="auth-layout">
        <aside className="auth-intro">
          <div className="auth-brand"><span className="auth-brand-icon"><Database size={19} /></span><span>AI SQL</span></div>
          <div className="auth-intro-copy">
            <span className="auth-eyebrow">A clear view of your data</span>
            <h1>Ask better questions.<br />Get reliable SQL.</h1>
            <p>Connect your database and explore it in plain language, with schema context and a reviewable query at every step.</p>
          </div>
          <div className="auth-proof"><ShieldCheck size={17} /><span>Secure access to your data workspace</span></div>
          <div className="auth-decoration" aria-hidden="true"><span /><span /><span /><span /><span /></div>
        </aside>

        <section className="auth-card" aria-labelledby="auth-title">
          {isVerify ? (
            <>
              <div className="auth-icon-wrap success"><Mail size={21} /></div>
              <span className="auth-eyebrow">One last step</span>
              <h2 id="auth-title">Verify your email</h2>
              <p className="auth-description">We sent a verification link to <strong>{user?.email || email}</strong>. Verify your address before opening the workspace.</p>
              <div className="auth-notice verify-note"><Mail size={16} /><span>Check your inbox and spam folder for the Firebase verification email.</span></div>
              {error && <div className="auth-alert error" role="alert">{error}</div>}
              {notice && <div className="auth-alert success" role="status"><CheckCircle2 size={16} />{notice}</div>}
              <button className="auth-primary" type="button" onClick={handleCheckVerification} disabled={busy}>
                {busy ? 'Checking…' : 'I’ve verified my email'} <ArrowRight size={16} />
              </button>
              <button className="auth-secondary" type="button" onClick={handleResend} disabled={busy}>Resend verification email</button>
              <button className="auth-text-button back-to-signin" type="button" onClick={handleChangeAccount} disabled={busy}>Use a different account</button>
            </>
          ) : (
            <>
              <span className="auth-eyebrow">{isForgot ? 'Account recovery' : 'Welcome to AI SQL'}</span>
              <h2 id="auth-title">{isForgot ? 'Reset your password' : isSignup ? 'Create your account' : 'Sign in to your workspace'}</h2>
              <p className="auth-description">{isForgot ? 'We’ll email you a secure link to choose a new password.' : isSignup ? 'Use your work email to get started.' : 'Continue with your email or Google account.'}</p>

              {!isForgot && (
                <button className="auth-google" type="button" onClick={handleGoogleSignIn} disabled={busy}>
                  <GoogleMark /> Continue with Google
                </button>
              )}

              {!isForgot && <div className="auth-divider"><span>or {isSignup ? 'sign up' : 'continue'} with email</span></div>}

              <form className="auth-form" onSubmit={handleEmailSubmit}>
                <label htmlFor="auth-email">Email address</label>
                <div className="auth-input-wrap"><Mail size={16} /><input id="auth-email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={event => setEmail(event.target.value)} required /></div>
                {!isForgot && <>
                  <div className="auth-label-row"><label htmlFor="auth-password">Password</label>{!isSignup && <button className="auth-text-button" type="button" onClick={() => changeMode('forgot')}>Forgot password?</button>}</div>
                  <div className="auth-input-wrap"><LockKeyhole size={16} /><input id="auth-password" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} placeholder={isSignup ? 'At least 6 characters' : 'Enter your password'} minLength={6} value={password} onChange={event => setPassword(event.target.value)} required /></div>
                </>}
                {error && <div className="auth-alert error" role="alert">{error}</div>}
                {notice && <div className="auth-alert success" role="status"><CheckCircle2 size={16} />{notice}</div>}
                <button className="auth-primary" type="submit" disabled={busy}>{busy ? 'Please wait…' : isForgot ? 'Send reset link' : isSignup ? 'Create account' : 'Sign in'} {!busy && <ArrowRight size={16} />}</button>
              </form>

              {isForgot ? (
                <button className="auth-text-button auth-bottom-link" type="button" onClick={() => changeMode('signin')}><ArrowLeft size={14} /> Back to sign in</button>
              ) : (
                <p className="auth-switch">{isSignup ? 'Already have an account?' : 'New to AI SQL?'} <button className="auth-text-button" type="button" onClick={() => changeMode(isSignup ? 'signin' : 'signup')}>{isSignup ? 'Sign in' : 'Create an account'}</button></p>
              )}
            </>
          )}
          <p className="auth-legal">By continuing, you agree to use this workspace responsibly.</p>
        </section>
      </section>
    </main>
  );
}
