import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ChatView from './components/Chat/ChatView';
import SchemaExplorer from './components/Schema/SchemaExplorer';
import ConnectionWizard from './components/Connections/ConnectionWizard';
import ValidatorPlayground from './components/Validator/ValidatorPlayground';
import BenchmarkDashboard from './components/Eval/BenchmarkDashboard';
import { fetchConnections } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [connections, setConnections] = useState([]);
  const [activeConnectionId, setActiveConnectionId] = useState('demo-ecommerce');
  const [isLoading, setIsLoading] = useState(true);

  const loadConnections = async () => {
    try {
      const data = await fetchConnections();
      setConnections(data);
      if (data.length > 0 && !activeConnectionId) {
        setActiveConnectionId(data[0].connection_id);
      }
    } catch (err) {
      console.error("Failed to load connections:", err);
      // Fallback default
      setConnections([
        { connection_id: 'demo-ecommerce', name: 'Demo E-commerce Store', dialect: 'sqlite', is_demo: true }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConnections();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        connections={connections}
        activeConnectionId={activeConnectionId}
        setActiveConnectionId={setActiveConnectionId}
      />

      <main className="flex-1">
        {activeTab === 'chat' && (
          <ChatView connectionId={activeConnectionId} />
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
          />
        )}
        {activeTab === 'validator' && (
          <ValidatorPlayground connectionId={activeConnectionId} />
        )}
        {activeTab === 'eval' && (
          <BenchmarkDashboard />
        )}
      </main>
    </div>
  );
}
