import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, reload, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import AuthScreen from './components/Auth/AuthScreen';
import Header from './components/Header';
import ChatView from './components/Chat/ChatView';
import SchemaExplorer from './components/Schema/SchemaExplorer';
import ConnectionWizard from './components/Connections/ConnectionWizard';
import BenchmarkDashboard from './components/Eval/BenchmarkDashboard';
import DatabaseUploadModal from './components/Connections/DatabaseUploadModal';
import { fetchConnections } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [connections, setConnections] = useState([]);
  const [activeConnectionId, setActiveConnectionId] = useState('demo-ecommerce');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const loadConnections = useCallback(async () => {
    try {
      const data = await fetchConnections();
      setConnections(data);
      setActiveConnectionId(current => data.some(connection => connection.connection_id === current)
        ? current
        : (data[0]?.connection_id || ''));
    } catch (err) {
      console.error("Failed to load connections:", err);
      // Fallback default
      setConnections([
        { connection_id: 'demo-ecommerce', name: 'Demo E-commerce Store', dialect: 'sqlite', is_demo: true }
      ]);
    }
  }, []);

  useEffect(() => onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        await reload(user);
      } catch {
        // Keep the Firebase auth state and show the sign-in screen if refresh fails.
      }
    }
    setAuthUser(user);
    if (user?.emailVerified) await loadConnections();
    setIsAuthLoading(false);
  }), [loadConnections]);

  const refreshAuthUser = async () => {
    if (!auth.currentUser) return;
    await reload(auth.currentUser);
    const emailVerified = auth.currentUser.emailVerified;
    setAuthUser({
      uid: auth.currentUser.uid,
      email: auth.currentUser.email,
      displayName: auth.currentUser.displayName,
      photoURL: auth.currentUser.photoURL,
      emailVerified,
    });
    if (emailVerified) await loadConnections();
    return emailVerified;
  };

  const handleUploadSuccess = async (uploadRes) => {
    await loadConnections();
    if (uploadRes && uploadRes.connection_id) {
      setActiveConnectionId(uploadRes.connection_id);
    }
    setActiveTab('chat');
  };

  return (
    <div className="app-shell min-h-screen text-slate-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white">
      {isAuthLoading ? (
        <div className="auth-loading" role="status">Loading your workspace…</div>
      ) : !authUser?.emailVerified ? (
        <AuthScreen user={authUser} onRefreshUser={refreshAuthUser} />
      ) : <>
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        connections={connections}
        activeConnectionId={activeConnectionId}
        setActiveConnectionId={setActiveConnectionId}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        authUser={authUser}
        onSignOut={() => signOut(auth)}
      />

      <main className="flex-1 min-h-0 flex flex-col">
        {activeTab === 'chat' && (
          <ChatView
            connectionId={activeConnectionId}
            onOpenUploadModal={() => setIsUploadModalOpen(true)}
          />
        )}
        {activeTab === 'schema' && (
          <SchemaExplorer connectionId={activeConnectionId} />
        )}
        {activeTab === 'connections' && (
          <ConnectionWizard
            connections={connections}
            onConnectionsChanged={loadConnections}
            activeConnectionId={activeConnectionId}
            setActiveConnectionId={setActiveConnectionId}
            onOpenUploadModal={() => setIsUploadModalOpen(true)}
          />
        )}
        {activeTab === 'eval' && (
          <BenchmarkDashboard />
        )}
      </main>

      {/* Manual Database / File Upload Modal */}
      <DatabaseUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
      </>
      }
    </div>
  );
}
