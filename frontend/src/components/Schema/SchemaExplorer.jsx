import React, { useState, useEffect } from 'react';
import { Layers, Key, Link2, RefreshCw, Search, Database, Hash, FileText } from 'lucide-react';
import { fetchSchema, refreshSchema } from '../../services/api';

export default function SchemaExplorer({ connectionId }) {
  const [schema, setSchema] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTable, setSelectedTable] = useState(null);
  const [error, setError] = useState(null);

  const loadSchema = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSchema(connectionId);
      setSchema(data);
      const tableNames = Object.keys(data.tables || {});
      if (tableNames.length > 0 && !selectedTable) {
        setSelectedTable(tableNames[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const data = await refreshSchema(connectionId);
      setSchema(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadSchema();
  }, [connectionId]);

  const tables = schema?.tables || {};
  const filteredTableNames = Object.keys(tables).filter(t =>
    t.toLowerCase().includes(search.toLowerCase())
  );

  const currentTableMeta = selectedTable ? tables[selectedTable] : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">Schema Catalog & Discovery</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 font-mono uppercase">
              {schema?.dialect || 'sqlite'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Grounding metadata inspected directly from active database connection.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Schema
        </button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-brand-400" />
          <span>Inspecting database schema tables & constraints...</span>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-950/30 border border-red-500/30 rounded-2xl text-red-300 text-sm">
          Failed to load schema: {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Left Table List Sidebar */}
          <div className="md:col-span-4 bg-slate-900/40 rounded-2xl border border-slate-800 p-4 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search tables..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
              {filteredTableNames.map((tblName) => {
                const isSelected = selectedTable === tblName;
                const tbl = tables[tblName];
                return (
                  <button
                    key={tblName}
                    onClick={() => setSelectedTable(tblName)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-xs transition-all ${
                      isSelected
                        ? 'bg-brand-600/20 text-brand-300 border border-brand-500/40 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Layers className={`w-4 h-4 ${isSelected ? 'text-brand-400' : 'text-slate-500'}`} />
                      <span className="truncate">{tblName}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {tbl.columns?.length || 0} cols
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Table Column Details */}
          <div className="md:col-span-8 bg-slate-900/40 rounded-2xl border border-slate-800 p-5 space-y-4">
            {currentTableMeta ? (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white font-mono">{currentTableMeta.name}</h3>
                      <p className="text-xs text-slate-400">
                        {currentTableMeta.columns.length} columns • ~{currentTableMeta.row_count ?? 0} estimated rows
                      </p>
                    </div>
                  </div>
                </div>

                {/* Columns Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-300 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-2.5">Column</th>
                        <th className="px-4 py-2.5">Type</th>
                        <th className="px-4 py-2.5">Keys / Constraints</th>
                        <th className="px-4 py-2.5">Sample Values</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                      {currentTableMeta.columns.map((col) => {
                        const foreignKey = currentTableMeta.foreign_keys?.find(
                          fk => fk.constrained_column.toLowerCase() === col.name.toLowerCase()
                        );
                        return (
                          <tr key={col.name} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-2.5 font-semibold text-slate-100 flex items-center gap-1.5">
                              {col.is_primary_key && <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                              {foreignKey && <Link2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                              <span>{col.name}</span>
                            </td>
                            <td className="px-4 py-2.5 text-sky-400 font-medium">
                              {col.data_type}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-wrap gap-1">
                                {col.is_primary_key && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    PK
                                  </span>
                                )}
                                {foreignKey && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                    FK → {foreignKey.referred_table}.{foreignKey.referred_column}
                                  </span>
                                )}
                                {!col.is_nullable && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                    NOT NULL
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-[11px] text-slate-400 max-w-xs truncate">
                              {col.sample_values?.length > 0 ? (
                                <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                  {col.sample_values.slice(0, 3).join(', ')}
                                </span>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-slate-500">
                Select a table to inspect columns.
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
