import React, { useState, useRef, useEffect } from 'react';
import {
  Send, Sparkles, AlertCircle, CheckCircle2, Copy, Check,
  Code2, HelpCircle, ArrowRight, CornerDownLeft, RefreshCw
} from 'lucide-react';
import { runNaturalQuery } from '../../services/api';
import { ResultVisualizer } from './Visualizations';

const EXAMPLE_QUERIES = [
  { text: "What are our top performing products?", tag: "Ambiguous Metric" },
  { text: "Show total revenue by shipping country for completed orders", tag: "Join & Filter" },
  { text: "Show the count of customers grouped by country", tag: "Aggregation" },
  { text: "Who are our active customers?", tag: "Ambiguous Flag" },
  { text: "Show products with unit price over 100 dollars", tag: "Simple Filter" },
];

export default function ChatView({ connectionId }) {
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
        setMessages(prev => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            role: 'assistant',
            type: 'result',
            originalQuery: textToSend,
            summary: response.summary,
            sql: response.sanitized_sql || response.generated_sql,
            executionResult: response.execution_result,
            visualizationType: response.visualization_type || 'table',
            validationResult: response.validation_result,
          }
        ]);
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
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-6xl mx-auto px-4 py-4">
      
      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-2">
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
              <div className="max-w-3xl w-full space-y-3">
                {/* Greeting */}
                {msg.type === 'greeting' && (
                  <div className="glass-card p-4 rounded-2xl text-sm text-slate-300 leading-relaxed border border-slate-800">
                    {msg.content}
                  </div>
                )}

                {/* Clarification Request Card */}
                {msg.type === 'clarification' && (
                  <div className="bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 p-5 rounded-2xl border border-amber-500/30 shadow-xl shadow-amber-950/20 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 shrink-0">
                        <HelpCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                            Clarification Needed
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            Ambiguity Guardrail
                          </span>
                        </div>
                        <h4 className="text-base font-semibold text-white mt-1">
                          {msg.question}
                        </h4>
                        {msg.reason && (
                          <p className="text-xs text-slate-400 mt-1">
                            {msg.reason}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Options list */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                      {msg.options.map((opt) => (
                        <button
                          key={opt.id}
                          disabled={isLoading}
                          onClick={() => handleSend(msg.originalQuery, opt.id)}
                          className="flex flex-col text-left p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900 transition-all group disabled:opacity-50"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-slate-200 group-hover:text-amber-300">
                              {opt.label}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                            {opt.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Successful Result Card */}
                {msg.type === 'result' && (
                  <div className="glass-panel p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                    {/* Executive Summary */}
                    <div className="flex items-start gap-3 bg-brand-950/40 p-3.5 rounded-xl border border-brand-800/40">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-semibold text-brand-300 uppercase tracking-wider">
                          Summary & Insight
                        </div>
                        <p className="text-sm text-slate-200 mt-0.5 leading-relaxed">
                          {msg.summary}
                        </p>
                      </div>
                    </div>

                    {/* Generated SQL Drawer */}
                    {msg.sql && (
                      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-slate-800 text-xs">
                          <div className="flex items-center gap-2">
                            <Code2 className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-mono text-slate-300 font-medium">Generated SQL</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              SQLGlot Verified Read-Only
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
                        <pre className="p-3 text-xs font-mono text-sky-300 overflow-x-auto bg-slate-950/90 leading-relaxed">
                          {msg.sql}
                        </pre>
                      </div>
                    )}

                    {/* Visualizer (Table + Charts) */}
                    <ResultVisualizer
                      executionResult={msg.executionResult}
                      visualizationType={msg.visualizationType}
                    />
                  </div>
                )}

                {/* Error Card */}
                {msg.type === 'error' && (
                  <div className="bg-red-950/30 p-4 rounded-2xl border border-red-500/30 text-sm text-red-300 space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-red-400">
                      <AlertCircle className="w-4 h-4" />
                      Execution or Validation Error
                    </div>
                    <p className="text-xs">{msg.error}</p>
                    {msg.sql && (
                      <pre className="p-2 bg-slate-950 text-xs font-mono text-slate-400 rounded-lg overflow-x-auto">
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
          <div className="flex gap-3 items-center text-xs text-slate-400 animate-pulse">
            <div className="w-8 h-8 rounded-lg bg-brand-600/30 border border-brand-500/40 flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-brand-400 animate-spin" />
            </div>
            <span>Evaluating ambiguity, validating SQLGlot AST, and executing query...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Queries Chips */}
      {messages.length <= 2 && (
        <div className="mb-3">
          <div className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
            Suggested Prompts
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((ex, i) => (
              <button
                key={i}
                disabled={isLoading}
                onClick={() => handleSend(ex.text)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 hover:border-brand-500/50 hover:bg-slate-800/80 transition-all text-left"
              >
                <span>{ex.text}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-brand-400 font-mono">
                  {ex.tag}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Box */}
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
          placeholder="Ask a question in natural English (e.g., 'Show top performing products' or 'Count orders by country')..."
          disabled={isLoading}
          className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl pl-4 pr-14 py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all shadow-xl"
        />
        <button
          type="submit"
          disabled={!inputQuery.trim() || isLoading}
          className="absolute right-2.5 p-2 rounded-xl bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-40 disabled:hover:bg-brand-600 transition-all shadow-md shadow-brand-600/30"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

    </div>
  );
}
