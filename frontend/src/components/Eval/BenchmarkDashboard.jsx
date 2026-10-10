import React, { useState, useEffect } from 'react';
import { BarChart3, CheckCircle2, XCircle, Play, Timer, Shield, HelpCircle, Activity } from 'lucide-react';
import { runBenchmarkSuite } from '../../services/api';

export default function BenchmarkDashboard() {
  const [benchmark, setBenchmark] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);

  const handleRun = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const data = await runBenchmarkSuite();
      setBenchmark(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    handleRun();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-brand-400" />
            <h2 className="text-lg font-bold text-white">Evaluation Benchmark Harness</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Measures SQL execution accuracy, ambiguity detection quality, security injection blocks, and end-to-end latency across golden benchmark datasets.
          </p>
        </div>

        <button
          onClick={handleRun}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white shadow-md shadow-brand-600/30 transition-all disabled:opacity-50"
        >
          <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
          {isRunning ? 'Running Benchmark Tests...' : 'Execute Benchmark Suite'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-950/30 border border-red-500/30 rounded-2xl text-xs text-red-300">
          Failed to execute benchmark: {error}
        </div>
      )}

      {benchmark && (
        <>
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Overall Accuracy
              </span>
              <div className="text-3xl font-extrabold text-emerald-400 mt-2">
                {benchmark.accuracy_percentage}%
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {benchmark.passed_tests} of {benchmark.total_tests} tests passed
              </span>
            </div>

            <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                Ambiguity Accuracy
              </span>
              <div className="text-3xl font-extrabold text-amber-400 mt-2">
                {benchmark.ambiguity_detection_accuracy}%
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Clarification triggers
              </span>
            </div>

            <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-sky-400" />
                Security Defense Block
              </span>
              <div className="text-3xl font-extrabold text-sky-400 mt-2">
                {benchmark.security_block_accuracy}%
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Attacks blocked
              </span>
            </div>

            <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-indigo-400" />
                Average Latency
              </span>
              <div className="text-3xl font-extrabold text-indigo-300 mt-2">
                {benchmark.avg_latency_ms} <span className="text-sm font-normal text-slate-400">ms</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Per query execution
              </span>
            </div>

          </div>

          {/* Category Breakdown Badges */}
          <div className="bg-slate-900/30 p-4 rounded-2xl border border-slate-800 flex flex-wrap gap-3 items-center">
            <span className="text-xs font-semibold text-slate-400 mr-2">Category Accuracy:</span>
            {Object.entries(benchmark.category_breakdown || {}).map(([cat, stats]) => (
              <div key={cat} className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <span className="font-semibold text-slate-200 capitalize">{cat.replace('_', ' ')}:</span>
                <span className="font-mono text-emerald-400 font-bold">{stats.accuracy_pct}%</span>
                <span className="text-slate-500 text-[10px]">({stats.passed}/{stats.total})</span>
              </div>
            ))}
          </div>

          {/* Test Execution Results Table */}
          <div className="bg-slate-900/40 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Evaluation Test Cases Trajectory
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Test ID</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Query</th>
                    <th className="px-4 py-3">Latency</th>
                    <th className="px-4 py-3">Result / Guardrail Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {benchmark.results?.map((res) => (
                    <tr key={res.test_id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3">
                        {res.passed ? (
                          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-4 h-4" /> Passed
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-red-400 font-semibold">
                            <XCircle className="w-4 h-4" /> Failed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-200">{res.test_id}</td>
                      <td className="px-4 py-3 capitalize text-slate-400">{res.category.replace('_', ' ')}</td>
                      <td className="px-4 py-3 font-sans text-slate-200 max-w-xs truncate">{res.query}</td>
                      <td className="px-4 py-3 text-indigo-300">{res.latency_ms} ms</td>
                      <td className="px-4 py-3 text-slate-400 font-sans text-[11px] max-w-sm truncate">
                        {res.error || res.details?.summary || (res.details?.clarification_question ? `Clarified: ${res.details.clarification_question}` : 'Executed successfully')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
