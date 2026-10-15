import React, { useState } from 'react';
import { deleteUser, EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, sendPasswordResetEmail } from 'firebase/auth';
import { AlertCircle, CheckCircle2, Database, MessageSquareCode, Layers, BarChart3, ChevronDown, CircleHelp, Upload, UserRound, LogOut, KeyRound, Trash2, X } from 'lucide-react';
import { auth } from '../../firebase';

export default function Header({ activeTab, setActiveTab, connections, activeConnectionId, setActiveConnectionId, onOpenUploadModal, authUser, onSignOut }) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isAccountBusy, setIsAccountBusy] = useState(false);
  const [accountFeedback, setAccountFeedback] = useState(null);
  const [failedProfilePhotoUrl, setFailedProfilePhotoUrl] = useState(null);
  const hasProfilePhoto = Boolean(authUser?.photoURL && failedProfilePhotoUrl !== authUser.photoURL);

  const handlePasswordReset = async () => {
    setAccountFeedback(null);
    setIsAccountBusy(true);
    try {
      await sendPasswordResetEmail(auth, authUser.email);
      setAccountFeedback({ type: 'success', message: 'If this account uses a password, a reset link has been sent to your email.' });
    } catch {
      setAccountFeedback({ type: 'error', message: 'Could not send a reset link. Please try again.' });
    } finally {
      setIsAccountBusy(false);
    }
  };

  const handleDeleteAccount = async (event) => {
    event.preventDefault();
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setIsAccountBusy(true);
    setAccountFeedback(null);
    try {
      const usesPassword = currentUser.providerData.some(provider => provider.providerId === 'password');
      const usesGoogle = currentUser.providerData.some(provider => provider.providerId === 'google.com');
      if (usesPassword) {
        if (!deletePassword) {
          setAccountFeedback({ type: 'error', message: 'Enter your password to confirm account deletion.' });
          return;
        }
        const credential = EmailAuthProvider.credential(currentUser.email, deletePassword);
        await reauthenticateWithCredential(currentUser, credential);
      } else if (usesGoogle) {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await reauthenticateWithPopup(currentUser, provider);
      } else {
        setAccountFeedback({ type: 'error', message: 'This sign-in method needs a fresh sign-in before the account can be deleted.' });
        return;
      }
      await deleteUser(currentUser);
      setIsDeleteDialogOpen(false);
      setIsProfileMenuOpen(false);
    } catch (error) {
      const message = error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential'
        ? 'The password is incorrect. Try again.'
        : error?.code === 'auth/popup-closed-by-user'
          ? 'Google reauthentication was cancelled.'
          : 'Could not delete this account. Please sign in again and retry.';
      setAccountFeedback({ type: 'error', message });
    } finally {
      setIsAccountBusy(false);
    }
  };
  const navItems = [
    { id: 'chat', label: 'Query workspace', icon: MessageSquareCode },
    { id: 'schema', label: 'Schema', icon: Layers },
    { id: 'connections', label: 'Connections', icon: Database },
    { id: 'eval', label: 'Benchmarks', icon: BarChart3 },
  ];

  return (
    <header className="app-header">
      <div className="header-inner">
        <a className="brand-lockup" href="#workspace" onClick={e => { e.preventDefault(); setActiveTab('chat'); }} aria-label="AI SQL workspace">
          <span className="brand-mark"><Database size={19} strokeWidth={2.2} /></span>
          <span className="brand-copy"><strong>AI SQL</strong><small>DATA WORKSPACE</small></span>
        </a>

        <nav className="primary-nav" aria-label="Main navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)} className={`nav-item ${activeTab === id ? 'active' : ''}`} aria-current={activeTab === id ? 'page' : undefined}>
              <Icon size={16} strokeWidth={1.9} /><span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="header-actions">
          <label className="connection-select" title="Select active database">
            <span className="connection-status" />
            <select value={activeConnectionId || ''} onChange={e => e.target.value === '__upload__' ? onOpenUploadModal() : setActiveConnectionId(e.target.value)} aria-label="Active database">
              {connections.map(conn => <option key={conn.connection_id} value={conn.connection_id}>{conn.name}</option>)}
              <option value="__upload__">Add a database…</option>
            </select>
            <ChevronDown size={14} />
          </label>
          <button className="header-icon-button" aria-label="Upload database" title="Upload database" onClick={onOpenUploadModal}><Upload size={16} /></button>
          <button className="header-icon-button help-button" aria-label="Help"><CircleHelp size={17} /></button>
          <button className="user-avatar" type="button" title={authUser?.displayName || 'User profile'} aria-label="User profile" aria-expanded={isProfileMenuOpen} onClick={() => { setIsProfileMenuOpen(open => !open); setAccountFeedback(null); }}>
            {hasProfilePhoto && <img src={authUser.photoURL} alt="" referrerPolicy="no-referrer" onError={() => setFailedProfilePhotoUrl(authUser.photoURL)} />}
            {!hasProfilePhoto && <UserRound size={16} strokeWidth={2} />}
          </button>
          {isProfileMenuOpen && <div className="profile-menu">
            {authUser?.displayName && <strong className="profile-name">{authUser.displayName}</strong>}
            <span className="profile-email">{authUser?.email || 'Signed in'}</span>
            {accountFeedback && <div className={`profile-feedback ${accountFeedback.type}`} role="status">{accountFeedback.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}{accountFeedback.message}</div>}
            <button type="button" onClick={handlePasswordReset} disabled={isAccountBusy}><KeyRound size={14} /> Forgot password</button>
            <button className="profile-delete-action" type="button" onClick={() => { setAccountFeedback(null); setDeletePassword(''); setIsDeleteDialogOpen(true); }}><Trash2 size={14} /> Delete account</button>
            <button type="button" onClick={onSignOut}><LogOut size={14} /> Sign out</button>
          </div>}
        </div>
      </div>
      <div className="workspace-context">
        <span className="context-name">AI SQL</span>
        <span className="context-separator">/</span>
        <span>Workspace</span>
      </div>
      {isDeleteDialogOpen && <div className="account-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !isAccountBusy) setIsDeleteDialogOpen(false); }}>
        <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
          <button className="account-dialog-close" type="button" aria-label="Close" onClick={() => setIsDeleteDialogOpen(false)} disabled={isAccountBusy}><X size={17} /></button>
          <div className="account-dialog-icon"><Trash2 size={19} /></div>
          <h2 id="delete-account-title">Delete your account?</h2>
          <p>This permanently deletes your AI SQL account. You’ll need to create a new account to use this workspace again.</p>
          {auth.currentUser?.providerData.some(provider => provider.providerId === 'password') && <label className="delete-password-label">Confirm with your password<input type="password" autoComplete="current-password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} placeholder="Password" /></label>}
          {accountFeedback && <div className={`profile-feedback ${accountFeedback.type}`} role="alert">{accountFeedback.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}{accountFeedback.message}</div>}
          <div className="account-dialog-actions"><button type="button" className="account-cancel" onClick={() => setIsDeleteDialogOpen(false)} disabled={isAccountBusy}>Cancel</button><button type="button" className="account-delete-confirm" onClick={handleDeleteAccount} disabled={isAccountBusy}>{isAccountBusy ? 'Deleting…' : 'Delete account'}</button></div>
        </section>
      </div>}
    </header>
  );
}
