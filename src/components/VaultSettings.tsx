import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  ShieldAlert, KeyRound, AlertOctagon, RotateCcw, 
  Trash2, Shield, Settings, Clock, HelpCircle, HardDrive 
} from 'lucide-react';
import { VaultConfig } from '../types';
import { wipeDatabase, addAuditLog, clearAuditLogs } from '../utils/db';

interface VaultSettingsProps {
  config: VaultConfig;
  onUpdateConfig: (newConfig: Partial<VaultConfig>) => Promise<void>;
  onChangePasscode: (oldPass: string, newPass: string) => Promise<boolean>;
  onHardReset: () => void | Promise<void>;
  totalFiles: number;
}

export default function VaultSettings({
  config,
  onUpdateConfig,
  onChangePasscode,
  onHardReset,
  totalFiles
}: VaultSettingsProps) {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [isWiping, setIsWiping] = useState(false);

  const handleUpdatePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (newPass.length < 4 || newPass.length > 8) {
      setPassError('New passcode must be between 4 and 8 digits.');
      return;
    }

    if (newPass !== confirmPass) {
      setPassError('New passcodes do not match.');
      return;
    }

    try {
      const success = await onChangePasscode(oldPass, newPass);
      if (success) {
        setPassSuccess('Passcode altered and encrypted keys rotated successfully!');
        setOldPass('');
        setNewPass('');
        setConfirmPass('');
        await addAuditLog('passcode_changed', 'Successfully changed vault passcode and re-encrypted key canisters.');
      } else {
        setPassError('Invalid old passcode. Re-authentication failed.');
      }
    } catch (err) {
      console.error(err);
      setPassError('An error occurred during key rotation.');
    }
  };

  const handleWipeEverything = async () => {
    const confirmation = confirm(
      "CRITICAL DANGER: You are about to invoke a complete Factory reset. " +
      "This will destroy all encrypted file canisters, all vault configs, all activity journals, " +
      "and restore the system to day zero. All files will be lost forever. " +
      "Proceed with this action?"
    );

    if (confirmation) {
      setIsWiping(true);
      try {
        await wipeDatabase();
        localStorage.clear();
        await onHardReset();
      } catch (err) {
        console.error(err);
        alert('Failed to execute hard-wipe. Try manually clearing local storage.');
      } finally {
        setIsWiping(false);
      }
    }
  };

  const clearJournal = async () => {
    if (confirm("Clear all historic vault journal logs?")) {
      await clearAuditLogs();
      await addAuditLog('vault_wiped', 'Wiped historic vault audit logs manually');
      alert('Logs cleared successfully!');
      window.location.reload();
    }
  };

  return (
    <div id="vault-settings" className="max-w-4xl mx-auto px-4 md:px-0 py-4 grid grid-cols-1 md:grid-cols-12 gap-8">
      
      {/* Settings Navigation / Overview */}
      <div className="md:col-span-4 flex flex-col gap-6">
        <div className="glass-card rounded-3xl p-5 flex flex-col gap-4 shadow-2xl">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="text-emerald-400" size={18} />
            <h3 className="text-sm font-bold font-sans text-white">Vault Mechanics</h3>
          </div>

          <div className="flex flex-col gap-4">
            <div className="text-xs font-mono bg-white/5 p-3 rounded-xl border border-white/10">
              <span className="text-slate-400 block uppercase mb-1">Vault State</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Active Local Session
              </span>
            </div>

            <div className="text-xs font-mono bg-white/5 p-3 rounded-xl border border-white/10">
              <span className="text-slate-400 block uppercase mb-1">Encrypted Payload</span>
              <span className="text-white font-semibold">{totalFiles} Files Locked</span>
            </div>

            <div className="text-xs font-mono bg-white/5 p-3 rounded-xl border border-white/10">
              <span className="text-slate-400 block uppercase mb-1">System Mode</span>
              <span className="text-emerald-400 font-semibold">Web Client (Electron-Ready)</span>
            </div>
          </div>
        </div>

        {/* Explain Electron File Access details */}
        <div className="glass-card rounded-3xl p-5 text-xs text-slate-300 leading-relaxed font-sans flex flex-col gap-3 shadow-2xl">
          <div className="flex items-center gap-1.5 text-zinc-300 font-semibold">
            <HardDrive size={14} className="text-emerald-400" />
            <span>Local Directory Hiding</span>
          </div>
          <p>
            When porting **Sir Lock** to **Electron**, the sandbox web storage is replaced with direct Node.js `fs` access. 
          </p>
          <p>
            This ensures files can be securely deleted from host directory systems and fully isolated in a hidden volume. Under web browsers, Origin Private Storage (IndexedDB) safely stores the high-entropy ciphertext chunk data.
          </p>
        </div>
      </div>

      {/* Settings Forms Column */}
      <div className="md:col-span-8 flex flex-col gap-6">
        
        {/* Passcode Rotating Section */}
        <div className="glass-card rounded-3xl p-5 md:p-6 flex flex-col gap-5 shadow-2xl">
          <div className="flex items-center gap-2 pb-2 border-b border-white/5">
            <KeyRound className="text-emerald-400" size={18} />
            <h2 className="text-base font-bold font-sans text-white">Rotate Keys / Change Passcode</h2>
          </div>

          <form onSubmit={handleUpdatePasscode} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-slate-400 uppercase">Current Passcode</label>
                <input
                  type="password"
                  placeholder="••••"
                  value={oldPass}
                  onChange={e => setOldPass(e.target.value.replace(/\D/g, '').substring(0, 8))}
                  className="bg-white/5 border border-white/10 text-sm font-mono text-white rounded-xl py-2 px-3 focus:outline-none focus:border-emerald-500/50"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-slate-400 uppercase">New Passcode (4-8 digits)</label>
                <input
                  type="password"
                  placeholder="••••"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value.replace(/\D/g, '').substring(0, 8))}
                  className="bg-white/5 border border-white/10 text-sm font-mono text-white rounded-xl py-2 px-3 focus:outline-none focus:border-emerald-500/50"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-slate-400 uppercase">Confirm New Passcode</label>
              <input
                type="password"
                placeholder="••••"
                value={confirmPass}
                onChange={e => setConfirmPass(e.target.value.replace(/\D/g, '').substring(0, 8))}
                className="bg-white/5 border border-white/10 text-sm font-mono text-white rounded-xl py-2 px-3 focus:outline-none focus:border-emerald-500/50"
                required
              />
            </div>

            {passError && (
              <p className="text-xs font-mono text-red-400 bg-red-950/30 p-2.5 rounded-lg border border-red-900/30">
                {passError}
              </p>
            )}

            {passSuccess && (
              <p className="text-xs font-mono text-emerald-400 bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-900/30">
                {passSuccess}
              </p>
            )}

            <button
              type="submit"
              id="change-pass-submit"
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-sans font-bold text-xs rounded-xl self-end transition-colors cursor-pointer"
            >
              Rotate Key Canisters
            </button>
          </form>
        </div>

        {/* Security Parameters / Self Destruct / Panic Shield */}
        <div className="glass-card rounded-3xl p-5 md:p-6 flex flex-col gap-5 shadow-2xl">
          <div className="flex items-center gap-2 pb-2 border-b border-white/5">
            <Shield className="text-emerald-400" size={18} />
            <h2 className="text-base font-bold font-sans text-white">Security Customization</h2>
          </div>

          <div className="flex flex-col gap-5">
            {/* Self Destruct Limit setting */}
            <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-sans font-medium text-white">Self-Destruct Threshold</span>
                <span className="text-xs font-sans text-slate-400">Wipe all files after consecutive failed passcode events</span>
              </div>
              <select
                value={config.selfDestructLimit}
                onChange={async (e) => {
                  const val = parseInt(e.target.value);
                  await onUpdateConfig({ selfDestructLimit: val });
                  await addAuditLog('vault_wiped', `Configured self-destruct threshold to ${val === 0 ? 'Disabled' : `${val} failures`}`);
                }}
                className="bg-slate-900 border border-white/10 text-xs font-mono text-white rounded-lg py-1.5 px-3 focus:outline-none"
              >
                <option value={0}>Disabled</option>
                <option value={3}>3 Attempts</option>
                <option value={5}>5 Attempts</option>
                <option value={10}>10 Attempts</option>
              </select>
            </div>

            {/* Auto Lock settings */}
            <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-sans font-medium text-white">Auto-Lock Idle Timer</span>
                <span className="text-xs font-sans text-slate-400">Automatically lock down vault after lack of browser focus</span>
              </div>
              <select
                value={config.autoLockTime}
                onChange={async (e) => {
                  const val = parseInt(e.target.value);
                  await onUpdateConfig({ autoLockTime: val });
                }}
                className="bg-slate-900 border border-white/10 text-xs font-mono text-white rounded-lg py-1.5 px-3 focus:outline-none"
              >
                <option value={0}>Disabled</option>
                <option value={1}>1 Minute</option>
                <option value={5}>5 Minutes</option>
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes</option>
              </select>
            </div>
          </div>
        </div>

        {/* Factory Reset Danger Zone */}
        <div className="glass-card rounded-3xl p-5 md:p-6 flex flex-col gap-4 shadow-2xl">
          <div className="flex items-center gap-2 pb-2 border-b border-white/5">
            <ShieldAlert className="text-red-400" size={18} />
            <h2 className="text-base font-bold font-sans text-red-400">Danger Zone</h2>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-red-950/20 border border-red-900/20 rounded-2xl gap-4">
            <div className="flex flex-col gap-0.5 max-w-md">
              <span className="text-sm font-sans font-semibold text-red-450">Invoke Hard Self-Destruct / Reset</span>
              <span className="text-xs text-slate-300 leading-relaxed font-sans">
                Immediately wipes all IndexedDB tables, deletes all file canisters, clears password states, and wipes all cryptographic settings. All content deleted here is physically unrecoverable.
              </span>
            </div>

            <button
              onClick={handleWipeEverything}
              disabled={isWiping}
              id="hard-reset-btn"
              className="px-4 py-2.5 bg-red-650 hover:bg-red-500 disabled:bg-zinc-800 text-white font-sans font-bold text-xs rounded-xl self-end sm:self-center transition-colors cursor-pointer whitespace-nowrap border border-red-500/20"
            >
              {isWiping ? 'Resetting...' : 'Destroy Vault Now'}
            </button>
          </div>

          <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/10">
            <span className="text-xs font-mono text-slate-300">Clear Activity Journal Index</span>
            <button
              id="clear-journal-btn"
              onClick={clearJournal}
              className="text-xs font-mono text-slate-400 hover:text-white underline cursor-pointer"
            >
              Wipe Logs
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
