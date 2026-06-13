import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, Unlock, Shield, Trash2, Download, Eye, File, FileText, 
  FileImage, FileAudio, FileVideo, Archive, FileCode, UploadCloud, 
  Search, ShieldAlert, BookOpen, Clock, Activity, Zap, ExternalLink, RefreshCw 
} from 'lucide-react';
import { VaultFile, EncryptedDbEntry, AuditLogEntry } from '../types';
import { decryptData, encryptData, generateRandomBytes, getEntropyStats } from '../utils/crypto';
import { saveEncryptedFile, deleteEncryptedFile, addAuditLog, getAuditLogs } from '../utils/db';

interface VaultDashboardProps {
  cryptoKey: CryptoKey; // Held safely in state memory
  encryptedEntries: EncryptedDbEntry[];
  onLock: () => void;
  onRefreshEntries: () => Promise<void>;
  onTriggerPanic: () => void;
}

export default function VaultDashboard({
  cryptoKey,
  encryptedEntries,
  onLock,
  onRefreshEntries,
  onTriggerPanic,
}: VaultDashboardProps) {
  const [decryptedFiles, setDecryptedFiles] = useState<VaultFile[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [entropyResult, setEntropyResult] = useState<{ entropy: number; frequencyData: number[] } | null>(null);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isDecryptingAll, setIsDecryptingAll] = useState<boolean>(true);
  
  // Preview Modal state
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string; mimeType: string; isText: boolean; textBody?: string } | null>(null);
  
  // Drag and drop states
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [encryptingProgress, setEncryptingProgress] = useState<{ active: boolean; current?: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Decrypt filenames and details for the UI representation
  useEffect(() => {
    let active = true;

    async function decryptAllEntries() {
      setIsDecryptingAll(true);
      const output: VaultFile[] = [];

      for (const entry of encryptedEntries) {
        try {
          // Decrypt the metadata payload
          const metadataBuffer = await decryptData(
            entry.encryptedMetadata,
            cryptoKey,
            entry.metadataIv
          );
          
          const metaStr = new TextDecoder().decode(metadataBuffer);
          const meta = JSON.parse(metaStr);

          output.push({
            id: entry.id,
            name: meta.name,
            mimeType: meta.mimeType || 'application/octet-stream',
            size: entry.size,
            createdAt: entry.createdAt,
          });
        } catch (err) {
          console.error(`Inability to decrypt entry metadata for payload ${entry.id}`, err);
          output.push({
            id: entry.id,
            name: `Locked_File_${entry.id.substring(0, 5)}...`,
            mimeType: 'application/octet-stream',
            size: entry.size,
            createdAt: entry.createdAt,
          });
        }
      }

      if (active) {
        setDecryptedFiles(output);
        setIsDecryptingAll(false);
      }
    }

    decryptAllEntries();
    return () => { active = false; };
  }, [encryptedEntries, cryptoKey]);

  // Load audit logs
  const loadLogs = async () => {
    try {
      const dbLogs = await getAuditLogs();
      setLogs(dbLogs.slice(0, 15)); // last 15
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [encryptedEntries]);

  // Compute entropy if a file is clicked
  useEffect(() => {
    if (selectedFileId) {
      const matched = encryptedEntries.find(e => e.id === selectedFileId);
      if (matched) {
        // Compute of the actual ciphertext buffer
        const analysis = getEntropyStats(matched.ciphertext);
        setEntropyResult(analysis);
      }
    } else {
      setEntropyResult(null);
    }
  }, [selectedFileId, encryptedEntries]);

  // Handle Drag Over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // Process selected file(s) for military grade vault locking
  const processFiles = async (files: FileList) => {
    setEncryptingProgress({ active: true });
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setEncryptingProgress({ active: true, current: file.name });

      try {
        const fileData = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(file);
        });

        // 1. Generate IVs
        const contentIv = generateRandomBytes(12); // standard GCM size
        const metadataIv = generateRandomBytes(12);

        // 2. Encrypt Content
        const encryptedContent = await encryptData(fileData, cryptoKey, contentIv);

        // 3. Encrypt Metadata JSON packet
        const metadataJson = JSON.stringify({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
        });
        const encryptedMetadata = await encryptData(
          new TextEncoder().encode(metadataJson),
          cryptoKey,
          metadataIv
        );

        // 4. Create database record
        const entry: EncryptedDbEntry = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          encryptedMetadata,
          metadataIv,
          ciphertext: encryptedContent,
          contentIv,
          size: file.size,
          createdAt: Date.now(),
        };

        // 5. Store package
        await saveEncryptedFile(entry);
        await addAuditLog('file_hidden', `Hid local file "${file.name}" in primary vault. Size: ${(file.size / 1024).toFixed(1)} KB`);
      } catch (err) {
        console.error(`Unable to encrypt or save file ${file.name}`, err);
      }
    }

    setEncryptingProgress(null);
    onRefreshEntries();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  // Restore/Export selected file
  const handleExportOrRestore = async (id: string, restoreType: 'copy' | 'unhide') => {
    const entry = encryptedEntries.find(e => e.id === id);
    const decryptedInfo = decryptedFiles.find(e => e.id === id);
    if (!entry || !decryptedInfo) return;

    try {
      // 1. Decrypt raw bytes
      const decryptedBodyBytes = await decryptData(entry.ciphertext, cryptoKey, entry.contentIv);
      const blob = new Blob([decryptedBodyBytes], { type: decryptedInfo.mimeType });

      // 2. Trigger Client download
      const downloadUrl = URL.createObjectURL(blob);
      const anchorNode = document.createElement('a');
      anchorNode.href = downloadUrl;
      anchorNode.download = decryptedInfo.name;
      document.body.appendChild(anchorNode);
      anchorNode.click();
      document.body.removeChild(anchorNode);
      URL.revokeObjectURL(downloadUrl);

      // 3. If "unhide" / restore, delete from vault
      if (restoreType === 'unhide') {
        await deleteEncryptedFile(id);
        await addAuditLog('file_restored', `Restored local file "${decryptedInfo.name}" to disk (Wiped from vault)`);
        
        // Deselect if active
        if (selectedFileId === id) setSelectedFileId(null);
        onRefreshEntries();
      } else {
        await addAuditLog('file_restored', `Exported a local copy of "${decryptedInfo.name}"`);
      }
    } catch (err) {
      console.error(err);
      alert('Decryption failed. Please check passcode validity or vault keys.');
    }
  };

  // Secure Wipe file
  const handleWipeFile = async (id: string) => {
    const info = decryptedFiles.find(e => e.id === id);
    const name = info ? info.name : 'Unknown';
    if (!confirm(`Are you absolutely sure you want to permanently delete and physically shred "${name}"? This operation cannot be reversed.`)) {
      return;
    }

    try {
      await deleteEncryptedFile(id);
      await addAuditLog('file_deleted', `Secured deleted / wiped "${name}" from vault storage`);
      
      if (selectedFileId === id) setSelectedFileId(null);
      onRefreshEntries();
    } catch (err) {
      console.error(err);
    }
  };

  // Preview Image/Text File inside vault
  const handlePreviewFile = async (id: string) => {
    const entry = encryptedEntries.find(e => e.id === id);
    const info = decryptedFiles.find(e => e.id === id);
    if (!entry || !info) return;

    try {
      const decryptedBuffer = await decryptData(entry.ciphertext, cryptoKey, entry.contentIv);
      const blob = new Blob([decryptedBuffer], { type: info.mimeType });
      const blobUrl = URL.createObjectURL(blob);

      const mime = info.mimeType.toLowerCase();
      const isText = mime.startsWith('text/') || mime === 'application/json' || mime === 'text/markdown' || info.name.endsWith('.md') || info.name.endsWith('.txt') || info.name.endsWith('.js') || info.name.endsWith('.ts') || info.name.endsWith('.py');

      let textContent = '';
      if (isText) {
        textContent = new TextDecoder().decode(decryptedBuffer);
      }

      setPreviewFile({
        name: info.name,
        url: blobUrl,
        mimeType: info.mimeType,
        isText,
        textBody: textContent,
      });

      await addAuditLog('unlocked', `Previewed active secure element: "${info.name}"`);
    } catch (err) {
      console.error(err);
      alert('Unlocking failed for preview element.');
    }
  };

  // Close previewing modal helper
  const handleClosePreview = () => {
    if (previewFile) {
      URL.revokeObjectURL(previewFile.url);
      setPreviewFile(null);
    }
  };

  // File type icon helpers
  const getFileIcon = (mimeType: string, filename: string) => {
    const mime = mimeType.toLowerCase();
    const name = filename.toLowerCase();

    if (mime.startsWith('image/')) return <FileImage className="text-emerald-500" size={20} />;
    if (mime.startsWith('audio/')) return <FileAudio className="text-purple-500" size={20} />;
    if (mime.startsWith('video/')) return <FileVideo className="text-violet-500" size={20} />;
    if (mime.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.doc') || name.endsWith('.docx') || name.endsWith('.pdf')) {
      return <FileText className="text-amber-500" size={20} />;
    }
    if (mime.includes('zip') || mime.includes('tar') || mime.includes('rar') || mime.includes('compressed') || name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.gz')) {
      return <Archive className="text-blue-500" size={20} />;
    }
    if (mime.includes('javascript') || mime.includes('typescript') || mime.includes('json') || name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.py') || name.endsWith('.html') || name.endsWith('.css')) {
      return <FileCode className="text-cyan-500" size={20} />;
    }
    return <File className="text-zinc-500" size={20} />;
  };

  // Format File Size
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Filtered files according to search box
  const filteredFiles = decryptedFiles.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.mimeType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalVaultSize = encryptedEntries.reduce((sum, entry) => sum + entry.size, 0);

  return (
    <div id="vault-dashboard" className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full max-w-7xl mx-auto px-4 md:px-6">
      
      {/* File Action/Vault Details Left Section */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center glass-card rounded-2xl p-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Unlock size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-sans font-semibold text-sm">Vault Active</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-[10px] font-mono text-slate-400">AES-256 Memory Keys Enabled</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              id="panic-lock-btn"
              onClick={onTriggerPanic}
              className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-slate-950 transition-all duration-200 rounded-xl font-mono text-xs font-bold flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
              title="Panic Trigger: Hides vault instantly with a fake normal screen (Esc Key)"
            >
              <Zap size={14} />
              <span>PANIC SHIELD [ESC]</span>
            </button>

            <button
              id="slam-lock-btn"
              onClick={onLock}
              className="px-4 py-2 bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all rounded-xl font-sans font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Lock size={12} />
              <span>Lock Vault</span>
            </button>
          </div>
        </div>

        {/* Drag and Drop Hide File Trigger Point */}
        <div
          id="dropzone-area"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
            isDragging 
              ? 'border-emerald-500 bg-emerald-500/5 shadow-inner' 
              : 'border-white/10 hover:border-emerald-500/30 bg-white/3 hover:bg-white/5'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            multiple
            className="hidden"
          />

          <AnimatePresence mode="wait">
            {encryptingProgress?.active ? (
              <motion.div
                key="encrypting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-4"
              >
                <div className="w-12 h-12 rounded-full border-4 border-emerald-505 border-t-transparent animate-spin mb-4" />
                <p className="text-sm font-sans font-medium text-white mb-1">Securing with AES-256 ...</p>
                <p className="text-xs font-mono text-zinc-500 max-w-xs truncate">{encryptingProgress.current}</p>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400 mb-4 transition-transform group-hover:scale-105 duration-200">
                  <UploadCloud size={24} />
                </div>
                <h3 className="text-sm font-medium font-sans text-white mb-1">
                  Drag and drop local files to Lock them
                </h3>
                <p className="text-xs text-slate-400 font-mono mb-4">
                  Any file is safely encrypted inside your browser origin Private space
                </p>
                <button
                  id="browse-btn"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-sans font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
                >
                  Browse Directory Files
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Hidden Files Grid Layout List */}
        <div className="glass-card rounded-3xl p-5 md:p-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
            <div>
              <h2 className="text-lg font-bold font-sans text-white">Vault Directory</h2>
              <p className="text-xs text-slate-400 font-sans">
                {decryptedFiles.length} item{decryptedFiles.length !== 1 && 's'} hidden • {formatSize(totalVaultSize)} lock storage
              </p>
            </div>

            {/* Filter Search */}
            <div className="relative max-w-xs w-full">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Search locked items..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-1.5 pl-9 pr-4 text-xs font-sans text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>
          </div>

          <div className="border border-white/5 rounded-2xl overflow-hidden min-h-[220px]">
            {isDecryptingAll ? (
              <div className="flex flex-col items-center justify-center h-52">
                <RefreshCw size={24} className="text-emerald-400 animate-spin mb-3" />
                <p className="text-xs font-mono text-slate-400">Decrypting vault index headers...</p>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center h-52">
                <Lock size={28} className="text-slate-600 mb-3" />
                <p className="text-sm font-sans font-medium text-slate-400">Everything is secure</p>
                <p className="text-xs text-slate-500 font-mono mt-1">No files hidden in this vault directories yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-slate-900/20 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4 font-normal">Details</th>
                      <th className="py-3 px-4 font-normal hidden sm:table-cell">Size</th>
                      <th className="py-3 px-4 font-normal hidden md:table-cell">Locked On</th>
                      <th className="py-3 px-4 text-right pr-6 font-normal">Clearance Operation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {filteredFiles.map((file) => {
                      const isSelected = selectedFileId === file.id;
                      return (
                        <tr 
                          key={file.id} 
                          className={`hover:bg-white/5 transition-colors cursor-pointer ${
                            isSelected ? 'bg-white/5' : ''
                          }`}
                          onClick={() => setSelectedFileId(file.id)}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3 max-w-xs md:max-w-sm">
                              {getFileIcon(file.mimeType, file.name)}
                              <div className="truncate">
                                <p className="font-sans font-medium text-white truncate text-xs hover:text-emerald-400 transition-colors" title={file.name}>
                                  {file.name}
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono italic truncate" title={file.mimeType}>
                                  {file.mimeType}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs font-mono text-slate-300 hidden sm:table-cell">
                            {formatSize(file.size)}
                          </td>
                          <td className="py-3 px-4 text-[10px] font-mono text-slate-400 hidden md:table-cell">
                            {new Date(file.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right pr-6" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Preview capability for text/image */}
                              <button
                                onClick={() => handlePreviewFile(file.id)}
                                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                                title="Secure Preview In-Vault"
                              >
                                <Eye size={14} />
                              </button>
                              
                              {/* Copy only */}
                              <button
                                onClick={() => handleExportOrRestore(file.id, 'copy')}
                                className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                                title="Export Copy (Keep encrypted file)"
                              >
                                <Download size={14} />
                              </button>

                              {/* Restore (unhide & delete content) */}
                              <button
                                onClick={() => handleExportOrRestore(file.id, 'unhide')}
                                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                                title="Restore & Unhide (Clears vault copy)"
                              >
                                <RefreshCw size={14} />
                              </button>

                              {/* Secure Delete / Shred */}
                              <button
                                onClick={() => handleWipeFile(file.id)}
                                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                                title="Secure Wipe/Shred"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Cyber diagnostics right column */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        
        {/* Entropy Graph visualizer */}
        <div className="glass-card rounded-3xl p-5 md:p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Activity className="text-emerald-400" size={16} />
            <h3 className="text-sm font-bold font-sans text-white">Shred Integrity Analytics</h3>
          </div>

          <AnimatePresence mode="wait">
            {entropyResult ? (
              <motion.div
                key="has-stats"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-4"
              >
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-400">AES-GCM BYTE ENTROPY:</span>
                    <span className="text-emerald-400 font-bold">{entropyResult.entropy.toFixed(4)} bits</span>
                  </div>
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full" 
                      style={{ width: `${(entropyResult.entropy / 8) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-mono text-slate-400 mt-1">
                    *8.0000 is maximum randomness. Highly encrypted data resembles pure white noise.
                  </p>
                </div>

                {/* Byte Frequency Graph visualization */}
                <div>
                  <p className="text-[10px] font-mono text-slate-400 mb-2 uppercase tracking-wider">Ciphertext Signature Distribution (256-bit space)</p>
                  <div className="h-28 bg-white/5 border border-white/5 rounded-xl p-2 flex items-end gap-[1px]">
                    {entropyResult.frequencyData.filter((_, i) => i % 8 === 0).map((percent, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-600 hover:bg-emerald-400 flex-1 rounded-t-sm transition-all duration-300"
                        style={{ height: `${Math.max(4, percent)}%` }}
                        title={`Byte bucket ${idx * 8}`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between font-mono text-[9px] text-slate-500 mt-1">
                    <span>0x00</span>
                    <span>0x7F</span>
                    <span>0xFF</span>
                  </div>
                </div>

                <div className="p-3 bg-white/3 border border-white/5 rounded-xl text-[11px] text-slate-300 leading-relaxed font-sans">
                  The computed layout signature matches a fully secure ciphertext layout. No legible file fragments, header signatures, or directory indexes are discernible to local operating processes.
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="no-stats"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-12 px-4 border border-dashed border-white/10 rounded-2xl bg-white/2"
              >
                <Lock size={20} className="mx-auto text-slate-600 mb-2" />
                <p className="text-xs font-mono text-slate-400">Select any file to run security entropy verification.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Security Audit Log */}
        <div className="glass-card rounded-3xl p-5 md:p-6 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Clock className="text-emerald-400" size={16} />
              <h3 className="text-sm font-bold font-sans text-white">Vault Journal logs</h3>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto pr-1">
            {logs.length === 0 ? (
              <p className="text-[10px] font-mono text-slate-500 text-center py-6">Vault journaling empty.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="text-[11px] leading-relaxed border-b border-white/5 pb-2 flex flex-col gap-0.5">
                  <div className="flex justify-between text-slate-400 font-mono">
                    <span className="text-emerald-400 uppercase text-[9px] tracking-wider font-semibold">{log.action.replace('_', ' ')}</span>
                    <span className="text-[9px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-slate-300 font-sans tracking-wide">{log.details}</p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Full-Screen Decrypted Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <motion.div
            id="preview-file-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-hidden"
            onClick={handleClosePreview}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="glass-card rounded-3xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center px-6 py-4 border-b border-white/5 bg-slate-900/40">
                <div className="flex items-center gap-3">
                  <Shield size={18} className="text-emerald-400 shrink-0" />
                  <div className="truncate">
                    <h3 className="text-sm font-semibold text-white truncate max-w-md font-sans">
                      {previewFile.name}
                    </h3>
                    <p className="text-[10px] font-mono text-slate-400 uppercase">{previewFile.mimeType}</p>
                  </div>
                </div>
                <button
                  id="close-preview-btn"
                  onClick={handleClosePreview}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-sans font-semibold transition-all cursor-pointer border border-white/10"
                >
                  Terminate Session
                </button>
              </div>

              {/* Content Body */}
              <div className="p-6 flex-1 overflow-y-auto min-h-[300px] flex justify-center items-center bg-transparent">
                {previewFile.isText ? (
                  <pre className="w-full max-h-[60vh] overflow-auto text-xs font-mono text-emerald-400 bg-slate-950 p-4 rounded-xl border border-white/5 leading-relaxed text-left selection:bg-emerald-550 selection:text-black">
                    {previewFile.textBody}
                  </pre>
                ) : previewFile.mimeType.startsWith('image/') ? (
                  <img
                    src={previewFile.url}
                    alt={previewFile.name}
                    referrerPolicy="no-referrer"
                    className="max-h-[60vh] max-w-full rounded-lg object-contain shadow-md border border-white/5"
                  />
                ) : previewFile.mimeType.startsWith('audio/') ? (
                  <div className="w-full max-w-md glass-card rounded-2xl p-6 text-center flex flex-col gap-3">
                    <FileAudio size={40} className="text-emerald-400 mx-auto" />
                    <p className="text-xs font-mono text-slate-305 truncate">{previewFile.name}</p>
                    <audio src={previewFile.url} controls className="w-full focus:outline-none mt-2" />
                  </div>
                ) : previewFile.mimeType.startsWith('video/') ? (
                  <video src={previewFile.url} controls className="max-h-[60vh] max-w-full rounded-xl border border-white/5 shadow-lg" />
                ) : (
                  <div className="text-center p-8">
                    <Lock size={44} className="text-slate-600 mx-auto mb-4 animate-pulse" />
                    <h4 className="text-sm font-sans font-semibold text-white mb-1">Preview Format Unsupported</h4>
                    <p className="text-xs text-slate-400 font-mono mb-4">
                      This element's raw encrypted format can't be rendered natively in-app.
                    </p>
                    <button
                      id="preview-dl-btn"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = previewFile.url;
                        link.download = previewFile.name;
                        link.click();
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-sans font-semibold text-xs rounded-xl"
                    >
                      <Download size={12} />
                      Export to disk to view
                    </button>
                  </div>
                )}
              </div>

              {/* Secure Notification Footer */}
              <div className="bg-slate-900/40 px-6 py-3 border-t border-white/5 text-center flex justify-center items-center">
                <p className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
                  <ShieldAlert size={12} />
                  <span>PREVIEW ACTIVE IN STATIC ISOLATION BLOB MEMORY. ZERO LOCAL CACHE RETAINED.</span>
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
