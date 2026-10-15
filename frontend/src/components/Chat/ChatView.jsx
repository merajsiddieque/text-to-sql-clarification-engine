import React, { useState, useRef, useEffect } from 'react';
import {
  Send, Sparkles, AlertCircle, CheckCircle2, Copy, Check,
  Code2, HelpCircle, ArrowRight, RefreshCw, UploadCloud,
  Columns, Maximize2, Minimize2, Table2
} from 'lucide-react';
import { runNaturalQuery } from '../../services/api';
import { ResultVisualizer } from './Visualizations';
import DatabaseStudioPane from './DatabaseStudioPane';

export default function ChatView({ connectionId, onOpenUploadModal }) {
  const [inputQuery, setInputQuery] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      type: 'greeting',
      content: "Hello! Connect your database or query the preloaded demo store in natural English. If your question is ambiguous, I'll ask for clarification before generating and safely executing SQL.",
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedSQLId, setCopiedSQLId] = useState(null);
  const [latestQueryResult, setLatestQueryResult] = useState(null);
  const [layoutMode, setLayoutMode] = useState('split'); // 'split' | 'chat' | 'studio'
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (queryText, selectedClarification = null) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isLoading) return;

    // Add user message to conversation
    const userMsgId = `user_${Date.now()}`;
    const newMessages = [...messages];

    if (!selectedClarification) {
      newMessages.push({
        id: userMsgId,
        role: 'user',
        content: textToSend,
      });
      setMessages(newMessages);
      setInputQuery('');
    } else {
      newMessages.push({
        id: userMsgId,
        role: 'user',
        content: `Selected clarification: "${selectedClarification}"`,
      });
      setMessages(newMessages);
    }

    setIsLoading(true);

    try {
      const response = await runNaturalQuery({
        naturalQuery: textToSend,
        connectionId,
        selectedClarification,
      });

      if (response.status === 'needs_clarification') {
        // Assistant asks clarification
        setMessages(prev => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            role: 'assistant',
            type: 'clarification',
            originalQuery: textToSend,
            reason: response.ambiguity_reason,
            question: response.clarification_question,
            options: response.clarification_options || [],
          }
        ]);
      } else if (response.status === 'success') {
        // Query executed successfully
        const resultMsg = {
          id: `asst_${Date.now()}`,
          role: 'assistant',
          type: 'result',
          originalQuery: textToSend,
          summary: response.summary,
          sql: response.sanitized_sql || response.generated_sql,
          executionResult: response.execution_result,
          visualizationType: response.visualization_type || 'table',
          validationResult: response.validation_result,
        };
        setMessages(prev => [...prev, resultMsg]);
        setLatestQueryResult(resultMsg);
      } else {
        // Execution or validation error
        setMessages(prev => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            role: 'assistant',
            type: 'error',
            error: response.error || 'Failed to process query.',
            sql: response.generated_sql,
          }
        ]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `asst_${Date.now()}`,
          role: 'assistant',
          type: 'error',
          error: err.message || 'Network error communicating with backend.',
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const copySQL = (sql, id) => {
    navigator.clipboard.writeText(sql);
    setCopiedSQLId(id);
    setTimeout(() => setCopiedSQLId(null), 2000);
  };

  return (
    <div className="max-w-[1700px] mx-auto px-4 py-3 flex-1 min-h-0 w-full flex flex-col">
      
      {/* Top Layout & Mode Switcher Bar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-brand-400" />
            Natural Query & Live Database Studio
          </span>
          <span className="text-[10px] text-slate-500 hidden sm:inline">
            • Clarification Engine
          </span>
        </div>

        {/* View Layout Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[11px]">
            <button
              onClick={() => setLayoutMode('split')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
                layoutMode === 'split'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns className="w-3 h-3" />
              <span>Split Studio</span>
            </button>
            <button
              onClick={() => setLayoutMode('chat')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
                layoutMode === 'chat'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Chat Focus</span>
            </button>
            <button
              onClick={() => setLayoutMode('studio')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
                layoutMode === 'studio'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Table2 className="w-3 h-3" />
              <span>Database Table</span>
            </button>
          </div>

          {onOpenUploadModal && (
            <button
              onClick={onOpenUploadModal}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-slate-700 transition-colors"
            >
              <UploadCloud className="w-3 h-3 text-brand-400" />
              <span className="hidden sm:inline">Upload DB</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Dual-Pane / Responsive Grid */}
      <div className={`flex-1 min-h-0 min-w-0 grid gap-4 overflow-hidden ${
        layoutMode === 'split'
          ? 'grid-cols-1 lg:grid-cols-12'
          : layoutMode === 'chat'
          ? 'grid-cols-1 max-w-4xl mx-auto w-full'
          : 'grid-cols-1'
      }`}>

        {/* ======================================================== */}
        {/* LEFT PANE: Conversational Chat & Clarification Engine   */}
        {/* ======================================================== */}
        {layoutMode !== 'studio' && (
          <div className={`flex flex-col h-full bg-slate-900/60 border border-slate-800 rounded-2xl p-4 overflow-hidden shadow-xl ${
            layoutMode === 'split' ? 'lg:col-span-6 xl:col-span-6' : 'w-full'
          }`}>
            
            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto space-y-5 pr-2 mb-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Assistant Avatar */}
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-lg bg-brand-600/30 border border-brand-500/40 flex items-center justify-center shrink-0 mt-1 shadow-sm">
                      <Sparkles className="w-4 h-4 text-brand-400" />
                    </div>
                  )}

                  {/* User Message Bubble */}
                  {msg.role === 'user' && (
                    <div className="max-w-xl bg-brand-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm font-medium shadow-md shadow-brand-600/20">
                      {msg.content}
                    </div>
                  )}

                  {/* Assistant Messages */}
                  {msg.role === 'assistant' && (
                    <div className="max-w-2xl w-full space-y-3">
                      {/* Greeting */}
                      {msg.type === 'greeting' && (
                        <div className="glass-card p-4 rounded-2xl text-xs sm:text-sm text-slate-300 leading-relaxed border border-slate-800">
                          {msg.content}
                        </div>
                      )}

                      {/* Clarification Request Card */}
                      {msg.type === 'clarification' && (
                        <div className="bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 p-4 rounded-2xl border border-amber-500/30 shadow-xl space-y-3">
                          <div className="flex items-start gap-2.5">
                            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 shrink-0">
                              <HelpCircle className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                                  Clarification Needed
                                </span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                  Ambiguity Guardrail
                                </span>
                              </div>
                              <h4 className="text-sm font-semibold text-white mt-0.5">
                                {msg.question}
                              </h4>
                              {msg.reason && (
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  {msg.reason}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Options list */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {msg.options.map((opt) => (
                              <button
                                key={opt.id}
                                disabled={isLoading}
                                onClick={() => handleSend(msg.originalQuery, opt.id)}
                                className="flex flex-col text-left p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900 transition-all group disabled:opacity-50"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-xs text-slate-200 group-hover:text-amber-300">
                                    {opt.label}
                                  </span>
                                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                                  {opt.description}
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Successful Result Card */}
                      {msg.type === 'result' && (
                        <div className="glass-panel p-4 rounded-2xl border border-slate-800 shadow-xl space-y-3">
                          {/* Executive Summary */}
                          <div className="flex items-start gap-2.5 bg-brand-950/40 p-3 rounded-xl border border-brand-800/40">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                              <div className="text-[11px] font-semibold text-brand-300 uppercase tracking-wider">
                                Summary & Insight
                              </div>
                              <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">
                                {msg.summary}
                              </p>
                            </div>
                          </div>

                          {/* Generated SQL Drawer */}
                          {msg.sql && (
                            <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-slate-800 text-xs">
                                <div className="flex items-center gap-1.5">
                                  <Code2 className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="font-mono text-slate-300 text-[11px]">Generated SQL</span>
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    SQLGlot Guardrail Passed
                                  </span>
                                </div>
                                <button
                                  onClick={() => copySQL(msg.sql, msg.id)}
                                  className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
                                >
                                  {copiedSQLId === msg.id ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-400" />
                                      <span className="text-emerald-400 text-[10px]">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span className="text-[10px]">Copy</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <pre className="p-2.5 text-[11px] font-mono text-sky-300 overflow-x-auto bg-slate-950/90 leading-relaxed">
                                {msg.sql}
                              </pre>
                            </div>
                          )}

                          {/* Embedded Chart / Mini Table in Chat View */}
                          <ResultVisualizer
                            executionResult={msg.executionResult}
                            visualizationType={msg.visualizationType}
                          />
                        </div>
                      )}

                      {/* Error Card */}
                      {msg.type === 'error' && (
                        <div className="bg-red-950/30 p-3.5 rounded-2xl border border-red-500/30 text-xs text-red-300 space-y-1.5">
                          <div className="flex items-center gap-1.5 font-semibold text-red-400">
                            <AlertCircle className="w-4 h-4" />
                            <span>Execution or Validation Error</span>
                          </div>
                          <p>{msg.error}</p>
                          {msg.sql && (
                            <pre className="p-2 bg-slate-950 text-[11px] font-mono text-slate-400 rounded-lg overflow-x-auto">
                              {msg.sql}
                            </pre>
                          )}
                        </div>
                      )}

                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-2.5 items-center text-xs text-slate-400 animate-pulse">
                  <div className="w-7 h-7 rounded-lg bg-brand-600/30 border border-brand-500/40 flex items-center justify-center">
                    <RefreshCw className="w-3.5 h-3.5 text-brand-400 animate-spin" />
                  </div>
                  <span>Evaluating ambiguity, validating SQLGlot AST, and executing query...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Natural Query Input Form (Matching screenshot placeholder & submit) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="relative flex items-center"
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask a question in natural English (e.g., 'Show top performing products' or 'Count orders by country')"
                disabled={isLoading}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl pl-4 pr-12 py-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all shadow-xl"
              />
              <button
                type="submit"
                disabled={!inputQuery.trim() || isLoading}
                className="absolute right-2 p-2 rounded-xl bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-40 disabled:hover:bg-brand-600 transition-all shadow-md shadow-brand-600/30"
                title="Send query"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

          </div>
        )}

        {/* ======================================================== */}
        {/* RIGHT PANE: Results | Messages Database Studio Grid     */}
        {/* ======================================================== */}
        {layoutMode !== 'chat' && (
          <div className={`h-full min-h-0 min-w-0 overflow-hidden ${
            layoutMode === 'split' ? 'lg:col-span-6 xl:col-span-6' : 'w-full'
          }`}>
            <DatabaseStudioPane
              connectionId={connectionId}
              latestQueryResult={latestQueryResult}
              onSelectTableForQuery={(tableName) => {
                setInputQuery(`Show summary and all rows from ${tableName}`);
              }}
            />
          </div>
        )}

      </div>

    </div>
  );
}
