import React from 'react';
import { Database, MessageSquareCode, Layers, ShieldCheck, BarChart3, ChevronDown, CheckCircle2, Sparkles } from 'lucide-react';

export default function Header({
  activeTab,
  setActiveTab,
  connections,
  activeConnectionId,
  setActiveConnectionId
}) {
  const activeConn = connections.find(c => c.connection_id === activeConnectionId) || connections[0];

  const navItems = [
    { id: 'chat', label: 'Ask & Clarify', icon: MessageSquareCode },
    { id: 'schema', label: 'Schema Catalog', icon: Layers },
    { id: 'connections', label: 'Databases', icon: Database },
    { id: 'validator', label: 'SQL Guardrails', icon: ShieldCheck },
    { id: 'eval', label: 'Evaluation Suite', icon: BarChart3 },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-sky-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">Text-to-SQL</span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
                  Clarification Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">Natural Language • AST Guardrails • Multi-Dialect</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Active Database Selector */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
              <Database className="w-3.5 h-3.5 text-brand-400" />
              <select
                value={activeConnectionId || ''}
                onChange={(e) => setActiveConnectionId(e.target.value)}
                className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer pr-4"
              >
                {connections.map((conn) => (
                  <option key={conn.connection_id} value={conn.connection_id} className="bg-slate-900 text-slate-100">
                    {conn.name} ({conn.dialect.toUpperCase()})
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="text-[10px] font-mono text-emerald-400 uppercase">
                  {activeConn?.dialect || 'sqlite'}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
}
