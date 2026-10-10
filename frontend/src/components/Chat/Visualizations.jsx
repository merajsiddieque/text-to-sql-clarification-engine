import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Table, BarChart2, Download, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

const COLORS = ['#38bdf8', '#818cf8', '#34d399', '#f472b6', '#fbbf24', '#a78bfa', '#fb7185', '#2dd4bf'];

export function ResultVisualizer({ executionResult, visualizationType = 'table' }) {
  const [viewMode, setViewMode] = useState(visualizationType === 'metric' ? 'metric' : (visualizationType === 'table' ? 'table' : 'chart'));
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  const columns = executionResult?.columns || [];
  const rawRows = executionResult?.rows || [];

  // Sort rows if requested
  const sortedRows = useMemo(() => {
    if (!sortConfig.key) return rawRows;
    return [...rawRows].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortConfig.direction === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [rawRows, sortConfig]);

  // Paginated rows
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return sortedRows.slice(start, start + rowsPerPage);
  }, [sortedRows, page]);

  const totalPages = Math.ceil(sortedRows.length / rowsPerPage);

  const handleSort = (col) => {
    setSortConfig(prev => ({
      key: col,
      direction: prev.key === col && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const exportCSV = () => {
    if (!rawRows.length) return;
    const header = columns.join(',');
    const body = rawRows.map(r => columns.map(c => JSON.stringify(r[c] ?? '')).join(',')).join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_result_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!rawRows.length) {
    return (
      <div className="p-6 text-center text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800">
        No records returned.
      </div>
    );
  }

  // Single metric display
  if (viewMode === 'metric' || (rawRows.length === 1 && columns.length <= 2)) {
    const firstRow = rawRows[0];
    const metricVal = Object.values(firstRow)[1] ?? Object.values(firstRow)[0];
    const metricLabel = Object.keys(firstRow)[1] ?? Object.keys(firstRow)[0];
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-2xl border border-slate-800 text-center">
        <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">
          {metricLabel.replace(/_/g, ' ')}
        </span>
        <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-sky-300 to-indigo-300 mt-2">
          {typeof metricVal === 'number' ? metricVal.toLocaleString() : metricVal}
        </div>
      </div>
    );
  }

  // Determine chart dimensions
  const labelKey = columns[0];
  const numericKeys = columns.slice(1).filter(col => typeof rawRows[0]?.[col] === 'number');
  const metricKey = numericKeys[0] || columns[1];

  return (
    <div className="space-y-3">
      {/* View Switcher Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'table'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            Table ({rawRows.length})
          </button>
          <button
            onClick={() => setViewMode('chart')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'chart'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Chart ({visualizationType.toUpperCase()})
          </button>
        </div>

        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-lg transition-colors border border-slate-800"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {/* CHART VIEW */}
      {viewMode === 'chart' && (
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 h-72">
          <ResponsiveContainer width="100%" height="100%">
            {visualizationType === 'line' ? (
              <LineChart data={rawRows} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey={labelKey} stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Line type="monotone" dataKey={metricKey} stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 4, fill: '#38bdf8' }} />
              </LineChart>
            ) : visualizationType === 'pie' ? (
              <PieChart>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Pie
                  data={rawRows}
                  dataKey={metricKey}
                  nameKey={labelKey}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {rawRows.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            ) : (
              <BarChart data={rawRows} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey={labelKey} stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Bar dataKey={metricKey} fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-300 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-800">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-800/80 transition-colors select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{col}</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                {paginatedRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    {columns.map((col) => (
                      <td key={col} className="px-4 py-2.5 whitespace-nowrap">
                        {row[col] !== null && row[col] !== undefined ? String(row[col]) : <span className="text-slate-600">null</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 bg-slate-950/60 border-t border-slate-800 text-xs text-slate-400">
              <span>Page {page} of {totalPages} ({rawRows.length} rows)</span>
              <div className="flex items-center gap-1">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
