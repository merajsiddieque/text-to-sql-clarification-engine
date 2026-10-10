import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Play, CheckCircle2, AlertTriangle, Code2, Sparkles } from 'lucide-react';
import { validateSQL } from '../../services/api';

const SAMPLE_PAYLOADS = [
  { label: 'Safe Read-Only Query', sql: 'SELECT p.name, p.unit_price FROM products p WHERE p.unit_price > 50;' },
  { label: 'Stacked SQL Injection Attack', sql: 'SELECT * FROM customers; DROP TABLE customers;' },
  { label: 'Forbidden UPDATE DML', sql: "UPDATE customers SET account_status = 'suspended' WHERE customer_id = 1;" },
  { label: 'Dangerous Function DOS', sql: 'SELECT pg_sleep(10);' },
  { label: 'Schema Grounding Hallucination', sql: 'SELECT ssn, private_salary FROM non_existent_payroll_table;' },
  { label: 'Auto Limit Injection', sql: 'SELECT * FROM orders;' },
];

export default function ValidatorPlayground({ connectionId }) {
  const [sqlInput, setSqlInput] = useState(SAMPLE_PAYLOADS[0].sql);
  const [result, setResult] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

  const handleValidate = async (queryText) => {
    const textToRun = queryText || sqlInput;
    setIsValidating(true);
    try {
      const res = await validateSQL({ sql: textToRun, connectionId });
      setResult(res);
    } catch (err) {
      setResult({
        is_valid: false,
        errors: [err.message],
        warnings: [],
        tables_used: [],
        columns_used: [],
      });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      
      {/* Top Banner */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-brand-400" />
          <h2 className="text-lg font-bold text-white">SQLGlot AST Guardrail Playground</h2>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Test any SQL query against multi-engine AST parsing, strict read-only guarantees, DDL/DML blocking, schema grounding, and automatic LIMIT injection.
        </p>
      </div>

      {/* Preset test buttons */}
      <div>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
          Test Security Attack & Grounding Presets
        </span>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_PAYLOADS.map((sample, i) => (
            <button
              key={i}
              onClick={() => {
                setSqlInput(sample.sql);
                handleValidate(sample.sql);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-brand-500/50 hover:bg-slate-800 text-xs text-slate-300 transition-all"
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input & Output Split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Editor Box */}
        <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Target SQL Expression</span>
            <button
              onClick={() => handleValidate()}
              disabled={isValidating || !sqlInput.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white shadow-md shadow-brand-600/30 transition-all disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {isValidating ? 'Analyzing AST...' : 'Validate AST'}
            </button>
          </div>

          <textarea
            rows={8}
            value={sqlInput}
            onChange={(e) => setSqlInput(e.target.value)}
            placeholder="Type or paste any SQL expression..."
            className="w-full bg-slate-950 font-mono text-xs text-sky-300 p-4 rounded-xl border border-slate-800 focus:outline-none focus:border-brand-500 leading-relaxed resize-none"
          />
        </div>

        {/* Validation Result Inspection Box */}
        <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 space-y-4">
          <span className="text-xs font-semibold text-slate-300 block">AST Analysis Output</span>

          {result ? (
            <div className="space-y-4">
              {/* Verdict Header */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                result.is_valid
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/30 border-red-500/40 text-red-300'
              }`}>
                <div className="flex items-center gap-2.5 font-bold text-sm">
                  {result.is_valid ? <ShieldCheck className="w-5 h-5 text-emerald-400" /> : <ShieldAlert className="w-5 h-5 text-red-400" />}
                  <span>{result.is_valid ? 'APPROVED (Read-Only SELECT)' : 'BLOCKED (Guardrail Violation)'}</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 uppercase border border-slate-800">
                  AST Verified
                </span>
              </div>

              {/* Security Errors */}
              {result.errors?.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wider">Errors</span>
                  {result.errors.map((err, i) => (
                    <div key={i} className="text-xs p-2.5 rounded-lg bg-red-950/50 border border-red-500/20 text-red-300">
                      {err}
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings / Limit Injections */}
              {result.warnings?.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Guardrail Injections</span>
                  {result.warnings.map((warn, i) => (
                    <div key={i} className="text-xs p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/20 text-amber-300">
                      {warn}
                    </div>
                  ))}
                </div>
              )}

              {/* Extracted Schema Entities */}
              <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Tables Detected</span>
                  <span className="font-mono text-slate-200 mt-1 block">
                    {result.tables_used?.length ? result.tables_used.join(', ') : 'None'}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Columns Referenced</span>
                  <span className="font-mono text-slate-200 mt-1 block truncate">
                    {result.columns_used?.length ? result.columns_used.join(', ') : 'None'}
                  </span>
                </div>
              </div>

              {/* Sanitized Transpiled Query */}
              {result.sanitized_sql && (
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Sanitized & Dialect-Transpiled SQL
                  </span>
                  <pre className="p-3 bg-slate-950 font-mono text-xs text-emerald-300 rounded-xl border border-slate-800 overflow-x-auto">
                    {result.sanitized_sql}
                  </pre>
                </div>
              )}

            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 text-xs">
              Click "Validate AST" or choose a preset attack to inspect the safety guardrails.
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
