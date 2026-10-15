import React, { useState, useRef } from 'react';
import {
  UploadCloud, FileCode2, Database, FileSpreadsheet, Archive,
  CheckCircle2, AlertCircle, X, Loader2, Sparkles, ArrowRight
} from 'lucide-react';
import { uploadDatabaseFile } from '../../services/api';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_IN_MEMORY_TABLE_BYTES = 25 * 1024 * 1024;

const SUPPORTED_FORMATS = [
  { ext: '.sql', format: 'SQL script', use: 'Create tables, insert data, run queries, or restore a database from a script', icon: FileCode2, color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
  { ext: '.sqlite', format: 'SQLite DB file', use: 'Store an entire database in a single file', icon: Database, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  { ext: '.db', format: 'Database file', use: 'Local database storage, often SQLite', icon: Database, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  { ext: '.dump', format: 'Database dump', use: 'Database backup or export script', icon: FileCode2, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' },
  { ext: '.csv', format: 'Comma-separated values', use: 'Import or export tabular data with auto-inferred columns', icon: FileSpreadsheet, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { ext: '.tsv', format: 'Tab-separated values', use: 'Import or export tabular data with tab separators', icon: FileSpreadsheet, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { ext: '.bak', format: 'SQL backup script', use: 'SQL text dumps only; binary backup files are not supported', icon: Archive, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  { ext: '.sql.gz', format: 'Compressed SQL script', use: 'Transfer large SQL exports efficiently via gzip decompression', icon: Archive, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
];

export default function DatabaseUploadModal({ isOpen, onClose, onUploadSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [customName, setCustomName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    setError(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelected = (file) => {
    setError(null);
    const name = file.name.toLowerCase();
    const isValid = [
      '.sql', '.sqlite', '.db', '.dump', '.csv', '.tsv', '.bak', '.sql.gz'
    ].some(ext => name.endsWith(ext));

    if (!isValid) {
      setSelectedFile(null);
      setError(`Unsupported file format. Please upload one of: .sql, .sqlite, .db, .dump, .csv, .tsv, .bak, .sql.gz`);
      return;
    }

    const isTabular = name.endsWith('.csv') || name.endsWith('.tsv');
    const sizeLimit = isTabular ? MAX_IN_MEMORY_TABLE_BYTES : MAX_UPLOAD_BYTES;
    if (file.size > sizeLimit) {
      setSelectedFile(null);
      setError(`${isTabular ? 'CSV/TSV files' : 'Uploads'} are limited to ${Math.round(sizeLimit / (1024 * 1024))} MB.`);
      return;
    }

    setSelectedFile(file);
    if (!customName) {
      // Suggest clean title
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setCustomName(baseName.charAt(0).toUpperCase() + baseName.slice(1));
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    setError(null);

    try {
      const res = await uploadDatabaseFile(selectedFile, customName);
      setUploadResult(res);
      if (onUploadSuccess) {
        onUploadSuccess(res);
      }
      setTimeout(() => {
        handleClose();
      }, 1600);
    } catch (err) {
      setError(err.message || 'Failed to process and register database file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setCustomName('');
    setError(null);
    setUploadResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Upload Database or Data File
              </h3>
              <p className="text-xs text-slate-400">
                CSV/TSV runs in memory; database files are staged temporarily, then removed after import
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {uploadResult ? (
            <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-3 animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/40">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">Database Ready for Querying!</h4>
              <p className="text-xs text-slate-300">
                Registered database <span className="text-emerald-300 font-semibold font-mono">"{uploadResult.name}"</span> with{' '}
                <span className="font-semibold text-white">{uploadResult.table_count} tables</span> ({uploadResult.tables?.join(', ') || 'tables detected'}).
              </p>
              <p className="text-[11px] text-emerald-400 animate-pulse">
                This upload stays in memory for the active server session and is cleared when removed or restarted.
              </p>
            </div>
          ) : (
            <>
              {/* Drag & Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
                  dragOver
                    ? 'border-brand-500 bg-brand-500/10'
                    : selectedFile
                    ? 'border-emerald-500/50 bg-slate-950/60'
                    : 'border-slate-700 hover:border-slate-500 bg-slate-950/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".sql,.sqlite,.db,.dump,.csv,.tsv,.bak,.sql.gz"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelected(e.target.files[0]);
                    }
                  }}
                />

                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${
                  selectedFile
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-300'
                }`}>
                  {selectedFile ? <CheckCircle2 className="w-6 h-6" /> : <UploadCloud className="w-6 h-6" />}
                </div>

                {selectedFile ? (
                  <div>
                    <span className="font-semibold text-sm text-white">{selectedFile.name}</span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Click to change file
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="font-medium text-sm text-slate-200">
                      Drag and drop your database file here, or <span className="text-brand-400 font-semibold underline">browse</span>
                    </span>
                    <span className="text-xs text-slate-400 block mt-1">
                      Supports .sql, .sqlite, .db, .dump, .csv, .tsv, .bak, .sql.gz • up to 50 MB (CSV/TSV 25 MB)
                    </span>
                  </div>
                )}
              </div>

              {/* Optional Custom Display Name */}
              {selectedFile && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Database Display Name
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g., Q3 Sales Analytics"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Supported File Extensions Reference Guide */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                  <span>Supported Database Formats</span>
                  <span className="text-[10px] text-brand-400">In-memory query • temporary staging for DB / SQL files</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {SUPPORTED_FORMATS.map((fmt) => {
                    const Icon = fmt.icon;
                    return (
                      <div
                        key={fmt.ext}
                        className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5 hover:border-slate-700 transition-colors"
                      >
                        <div className={`p-1.5 rounded-lg border shrink-0 ${fmt.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-white text-[11px]">{fmt.ext}</span>
                            <span className="text-[10px] text-slate-400 truncate">{fmt.format}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                            {fmt.use}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!uploadResult && (
          <div className="flex items-center justify-end gap-3 px-6 py-3.5 border-t border-slate-800 bg-slate-900/60">
            <button
              type="button"
              onClick={handleClose}
              disabled={isUploading}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:hover:bg-brand-600 text-xs font-semibold text-white shadow-md shadow-brand-600/30 transition-all"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing & Ingesting Database...
                </>
              ) : (
                <>
                  <span>Upload & Connect</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
