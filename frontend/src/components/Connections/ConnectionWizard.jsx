import React, { useState } from 'react';
import { Database, Plus, CheckCircle2, AlertCircle, Trash2, PlugZap, Shield } from 'lucide-react';
import { testConnection, createConnection, deleteConnection } from '../../services/api';

export default function ConnectionWizard({ connections, onConnectionsChanged, activeConnectionId, setActiveConnectionId }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    dialect: 'postgres',
    host: 'localhost',
    port: 5432,
    database: '',
    username: 'postgres',
    password: '',
    connection_uri: '',
    sqlite_path: '',
  });

  const [testStatus, setTestStatus] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const handleDialectChange = (dialect) => {
    setFormData(prev => ({
      ...prev,
      dialect,
      port: dialect === 'postgres' ? 5432 : (dialect === 'mysql' ? 3306 : null),
    }));
    setTestStatus(null);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestStatus(null);
    setFormError(null);
    try {
      const res = await testConnection(formData);
      setTestStatus(res);
    } catch (err) {
      setTestStatus({ success: false, message: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      const newConn = await createConnection(formData);
      await onConnectionsChanged();
      setActiveConnectionId(newConn.connection_id);
      setShowAddForm(false);
      setFormData({
        name: '',
        dialect: 'postgres',
        host: 'localhost',
        port: 5432,
        database: '',
        username: 'postgres',
        password: '',
        connection_uri: '',
        sqlite_path: '',
      });
      setTestStatus(null);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (connId) => {
    if (!window.confirm("Are you sure you want to remove this connection?")) return;
    try {
      await deleteConnection(connId);
      await onConnectionsChanged();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white">Database Connections</h2>
          <p className="text-xs text-slate-400 mt-1">
            Connect your own cloud or local SQL database with credential encryption at rest.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(prev => !prev)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white shadow-md shadow-brand-600/30 transition-all"
        >
          <Plus className="w-4 h-4" />
          {showAddForm ? 'Cancel' : 'Connect New Database'}
        </button>
      </div>

      {/* Add Connection Form Drawer */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-slate-900/80 p-6 rounded-2xl border border-brand-500/30 space-y-5 shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <PlugZap className="w-4 h-4 text-brand-400" />
              Configure Database Adapter
            </h3>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              Credentials Fernet-encrypted
            </span>
          </div>

          {/* Dialect selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Engine Dialect</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'postgres', label: 'PostgreSQL (Cloud/Local)', badge: 'Neon, Supabase, RDS' },
                { id: 'mysql', label: 'MySQL / MariaDB', badge: 'Cloud or Local' },
                { id: 'sqlite', label: 'SQLite', badge: 'File-based' },
              ].map(d => (
                <button
                  type="button"
                  key={d.id}
                  onClick={() => handleDialectChange(d.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    formData.dialect === d.id
                      ? 'bg-brand-600/20 border-brand-500 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold text-xs">{d.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{d.badge}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Form fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Display Name</label>
              <input
                type="text"
                required
                placeholder="e.g., Production Neon Replica"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            {formData.dialect === 'sqlite' ? (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">SQLite File Path</label>
                <input
                  type="text"
                  required
                  placeholder="C:/path/to/database.db"
                  value={formData.sqlite_path}
                  onChange={e => setFormData({ ...formData, sqlite_path: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Host / Endpoint</label>
                  <input
                    type="text"
                    required
                    placeholder="ep-example.neon.tech"
                    value={formData.host}
                    onChange={e => setFormData({ ...formData, host: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Database Name</label>
                  <input
                    type="text"
                    required
                    placeholder="neondb"
                    value={formData.database}
                    onChange={e => setFormData({ ...formData, database: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Port</label>
                  <input
                    type="number"
                    value={formData.port || ''}
                    onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) || 5432 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </>
            )}
          </div>

          {/* Test Status feedback */}
          {testStatus && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              testStatus.success
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                : 'bg-red-950/30 border-red-500/30 text-red-300'
            }`}>
              {testStatus.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />}
              <span>{testStatus.message}</span>
            </div>
          )}

          {formError && (
            <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/30 text-xs text-red-300">
              {formError}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              disabled={isTesting || !formData.name}
              onClick={handleTest}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors disabled:opacity-40"
            >
              {isTesting ? 'Testing Ping...' : 'Test Connection'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.name}
              className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white shadow-md shadow-brand-600/30 transition-all disabled:opacity-40"
            >
              {isSubmitting ? 'Saving...' : 'Save & Register Database'}
            </button>
          </div>
        </form>
      )}

      {/* Existing Connections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {connections.map((conn) => {
          const isActive = conn.connection_id === activeConnectionId;
          return (
            <div
              key={conn.connection_id}
              className={`p-5 rounded-2xl border transition-all ${
                isActive
                  ? 'bg-slate-900 border-brand-500 shadow-xl shadow-brand-500/10'
                  : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${
                    isActive ? 'bg-brand-500/20 border-brand-500/30 text-brand-400' : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}>
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">{conn.name}</h4>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold mt-1 inline-block">
                      {conn.dialect}
                    </span>
                  </div>
                </div>

                {!conn.is_demo && (
                  <button
                    onClick={() => handleDelete(conn.connection_id)}
                    className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between pt-3 border-t border-slate-800/80">
                <span className="text-xs text-slate-400">
                  {conn.is_demo ? 'Built-in Demo' : 'Custom Connected'}
                </span>
                {isActive ? (
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Active Database
                  </span>
                ) : (
                  <button
                    onClick={() => setActiveConnectionId(conn.connection_id)}
                    className="text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    Select Database →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
