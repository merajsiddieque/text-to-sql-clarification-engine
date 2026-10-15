import React, { useState, useEffect } from 'react';
import {
  Table2, MessageSquare, RefreshCw, Download, Search,
  ChevronRight, Database, CheckCircle2, Clock, Code2, AlertTriangle, Layers
} from 'lucide-react';
import { fetchSchema, fetchTableData } from '../../services/api';

export default function DatabaseStudioPane({
  connectionId,
  latestQueryResult,
  onSelectTableForQuery
}) {
  const [activeTab, setActiveTab] = useState('results'); // 'results' | 'messages'
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'query'
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableData, setTableData] = useState(null);
  const [isLoadingTable, setIsLoadingTable] = useState(false);
  const [tableError, setTableError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Load schema tables whenever connectionId changes
  useEffect(() => {
    let isMounted = true;
    async function loadTables() {
      if (!connectionId) return;
      try {
        const schema = await fetchSchema(connectionId);
        if (!isMounted) return;
        const tblNames = Object.keys(schema.tables || {});
        setTables(tblNames);
        if (tblNames.length > 0) {
          setSelectedTable(tblNames[0]);
        }
      } catch (err) {
        console.error("Failed to load schema for studio pane:", err);
      }
    }
    loadTables();
    return () => { isMounted = false; };
  }, [connectionId]);

  // Load table data whenever selectedTable changes
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!connectionId || !selectedTable) return;
      setIsLoadingTable(true);
      setTableError(null);
      try {
        const data = await fetchTableData(connectionId, selectedTable, 100);
        if (isMounted) {
          setTableData(data);
        }
      } catch (err) {
        if (isMounted) {
          setTableError(err.message);
        }
      } finally {
        if (isMounted) {
          setIsLoadingTable(false);
        }
      }
    }

    if (viewMode === 'table') {
      loadData();
    }
    return () => { isMounted = false; };
  }, [connectionId, selectedTable, viewMode]);

  // When latestQueryResult updates, automatically show query view mode or allow user toggling
  useEffect(() => {
    if (latestQueryResult && latestQueryResult.executionResult) {
      setViewMode('query');
    }
  }, [latestQueryResult]);

  const refreshCurrentTable = async () => {
    if (!connectionId || !selectedTable) return;
    setIsLoadingTable(true);
    try {
      const data = await fetchTableData(connectionId, selectedTable, 100);
      setTableData(data);
    } catch (err) {
      setTableError(err.message);
    } finally {
      setIsLoadingTable(false);
    }
  };

  // Determine which dataset to display
  const activeDataset = viewMode === 'query' && latestQueryResult?.executionResult
    ? {
        title: 'Query Execution Result',
        columns: latestQueryResult.executionResult.columns || [],
        rows: latestQueryResult.executionResult.rows || [],
        total_rows: latestQueryResult.executionResult.total_rows || 0,
        execution_time_ms: latestQueryResult.executionResult.execution_time_ms || 0,
        sql: latestQueryResult.sql || latestQueryResult.generated_sql,
        isQuery: true,
      }
    : {
        title: selectedTable ? `Fetched Table: ${selectedTable}` : 'Fetched Table from database',
        columns: tableData?.columns || [],
        rows: tableData?.rows || [],
        total_rows: tableData?.total_rows || (tableData?.rows?.length || 0),
        execution_time_ms: tableData?.execution_time_ms || 0,
        sql: selectedTable ? `SELECT * FROM "${selectedTable}" LIMIT 100;` : '',
        isQuery: false,
      };

  // Filter rows based on search
  const filteredRows = activeDataset.rows.filter(row => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return Object.values(row).some(val => 
      val !== null && val !== undefined && String(val).toLowerCase().includes(term)
    );
  });

  const exportCSV = () => {
    if (!activeDataset.rows.length) return;
    const cols = activeDataset.columns;
    const csvContent = [
      cols.join(','),
      ...activeDataset.rows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedTable || 'query_result'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0 bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      
      {/* Studio Top Bar with Results & Messages Tabs */}
      <div className="flex items-center justify-between px-3 pt-2 pb-0 bg-slate-950 border-b border-slate-800">
        
        {/* SSMS Style Tabs: Results | Messages */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('results')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all border-t-2 ${
              activeTab === 'results'
                ? 'bg-slate-900 text-sky-400 border-sky-500 shadow-sm'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Table2 className="w-3.5 h-3.5" />
            <span>Results</span>
            {activeDataset.rows.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
                {activeDataset.rows.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('messages')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all border-t-2 ${
              activeTab === 'messages'
                ? 'bg-slate-900 text-sky-400 border-sky-500 shadow-sm'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Messages</span>
          </button>
        </div>

        {/* View Mode Toggle: Fetched Table vs Latest Query */}
        <div className="flex items-center gap-2 pb-1.5">
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                viewMode === 'table'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Browse Tables
            </button>
            <button
              onClick={() => setViewMode('query')}
              disabled={!latestQueryResult?.executionResult}
              className={`px-2.5 py-1 rounded-md font-medium transition-all disabled:opacity-40 ${
                viewMode === 'query'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Query Result
            </button>
          </div>
        </div>

      </div>

      {/* Secondary Controls Bar: Table Picker, Search & Export */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-900/70 border-b border-slate-800/80 text-xs">
        
        {/* Table Selector or Active Query Label */}
        <div className="flex items-center gap-2">
          {viewMode === 'table' ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Table:
              </span>
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-brand-500 cursor-pointer"
              >
                {tables.map(tbl => (
                  <option key={tbl} value={tbl}>{tbl}</option>
                ))}
              </select>
              <button
                onClick={refreshCurrentTable}
                title="Refresh Table Data"
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTable ? 'animate-spin' : ''}`} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold text-slate-200 text-xs">
                Executed SQL Query Output
              </span>
            </div>
          )}

          {/* User annotation badge matching screenshot */}
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-medium font-mono">
            Fetched Table from database
          </span>
        </div>

        {/* Right action tools: Filter search & Export */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Search className="w-3 h-3 text-slate-500 absolute left-2" />
            <input
              type="text"
              placeholder="Filter rows..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-6 pr-2 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 w-28 sm:w-36"
            />
          </div>

          <button
            onClick={exportCSV}
            disabled={!activeDataset.rows.length}
            title="Export to CSV"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-[11px] font-medium transition-colors"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>

      </div>

      {/* Main Studio Display Area */}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden bg-slate-950/90 relative">
        
        {/* TAB 1: RESULTS (The Classic SSMS / Data Grid Viewer) */}
        {activeTab === 'results' && (
          <div className="min-w-full h-full min-h-0 min-w-0 flex flex-col">
            {isLoadingTable ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-brand-400" />
                <span className="text-xs">Fetching table rows from database...</span>
              </div>
            ) : tableError ? (
              <div className="p-4 m-4 rounded-xl bg-red-950/30 border border-red-500/30 text-red-300 text-xs">
                {tableError}
              </div>
            ) : activeDataset.columns.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500 gap-2">
                <Layers className="w-8 h-8 text-slate-600" />
                <p className="text-xs">No records or columns to display.</p>
                <p className="text-[11px] text-slate-600">Select a table from the dropdown above or run a query in the chat.</p>
              </div>
            ) : (
              <div className="overflow-auto flex-1 min-h-0 min-w-0 overscroll-contain">
                <table className="w-full min-w-max border-collapse text-left text-xs font-mono">
                  
                  {/* Table Header Row */}
                  <thead className="sticky top-0 bg-slate-900 border-b border-slate-700 z-10 shadow-sm">
                    <tr>
                      {/* SSMS Row Number Header */}
                      <th className="w-12 px-2.5 py-2 text-center text-[10px] font-semibold text-slate-400 bg-slate-950 border-r border-slate-800 select-none">
                        #
                      </th>
                      {activeDataset.columns.map((col) => (
                        <th
                          key={col}
                          className="px-3.5 py-2 font-semibold text-slate-200 border-r border-slate-800 whitespace-nowrap text-[11px] bg-slate-900/90"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{col}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  {/* Table Body Rows */}
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950">
                    {filteredRows.map((row, rowIdx) => (
                      <tr
                        key={rowIdx}
                        className="hover:bg-slate-800/50 transition-colors group"
                      >
                        {/* SSMS Row Number Index */}
                        <td className="px-2 py-1.5 text-center text-[11px] text-slate-400 bg-slate-950/80 border-r border-slate-800/90 font-mono select-none group-hover:text-slate-200">
                          {rowIdx + 1}
                        </td>

                        {/* Cell Values */}
                        {activeDataset.columns.map((col) => {
                          const val = row[col];
                          const isNull = val === null || val === undefined;

                          return (
                            <td
                              key={col}
                              className={`px-3.5 py-1.5 border-r border-slate-800/60 whitespace-nowrap text-xs ${
                                isNull
                                  ? 'text-amber-300/80 italic font-sans bg-amber-500/5'
                                  : typeof val === 'number'
                                  ? 'text-emerald-400'
                                  : 'text-slate-200'
                              }`}
                              title={String(val ?? 'NULL')}
                            >
                              {isNull ? 'NULL' : String(val)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>

                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MESSAGES (SSMS Style Output & Status) */}
        {activeTab === 'messages' && (
          <div className="p-4 space-y-4 text-xs font-mono text-slate-300 leading-relaxed overflow-auto h-full">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-[11px]">
                <CheckCircle2 className="w-4 h-4" />
                <span>Command(s) completed successfully.</span>
              </div>
              <div className="text-[11px] text-slate-400 space-y-1 pt-1">
                <p>• Rows returned: <span className="text-white font-bold">{activeDataset.total_rows}</span></p>
                <p>• Execution duration: <span className="text-sky-300">{activeDataset.execution_time_ms} ms</span></p>
                <p>• Timestamp: <span className="text-slate-400">{new Date().toLocaleString()}</span></p>
                <p>• Guardrail Verification: <span className="text-emerald-400">Read-Only Enforced via SQLGlot AST</span></p>
              </div>
            </div>

            {/* Executed SQL Statement */}
            {activeDataset.sql && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-brand-400" />
                  <span>Executed SQL Query</span>
                </div>
                <pre className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-sky-300 text-xs overflow-x-auto whitespace-pre-wrap">
                  {activeDataset.sql}
                </pre>
              </div>
            )}

            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">Connection Engine Information:</p>
              <p>• Active Database ID: <span className="text-brand-300">{connectionId}</span></p>
              <p>• Dialect: <span className="text-emerald-300 font-bold uppercase">SQLite</span></p>
              <p>• Total Discovered Tables: <span className="text-white">{tables.length}</span></p>
            </div>
          </div>
        )}

      </div>

      {/* Studio Status Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Ready</span>
          <span>•</span>
          <span>{filteredRows.length} of {activeDataset.total_rows} rows</span>
        </div>
        <div className="flex items-center gap-3">
          <span>{activeDataset.execution_time_ms} ms</span>
          <span>•</span>
          <span className="uppercase text-slate-500">Read-Only</span>
        </div>
      </div>

    </div>
  );
}
