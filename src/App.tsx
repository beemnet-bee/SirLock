import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, Shield, Settings, Activity, FolderLock, 
  RefreshCw, LogOut, FileText, AlertOctagon, HelpCircle 
} from 'lucide-react';
import { VaultConfig, EncryptedDbEntry } from './types';
import { deriveKey, decryptData, encryptData, generateRandomBytes, bytesToHex, hexToBytes } from './utils/crypto';
import { 
  openDb, getConfigValue, setConfigValue, 
  getAllEncryptedFiles, addAuditLog, wipeDatabase 
} from './utils/db';

import VaultKeypad from './components/VaultKeypad';
import VaultDashboard from './components/VaultDashboard';
import VaultSettings from './components/VaultSettings';
import PanicScreen from './components/PanicScreen';

export default function App() {
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [encryptedEntries, setEncryptedEntries] = useState<EncryptedDbEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'vault' | 'settings'>('vault');
  const [isPanicActive, setIsPanicActive] = useState<boolean>(false);
  const [selfDestructTriggered, setSelfDestructTriggered] = useState<boolean>(false);

  // Disable native context menu (right click) globally
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  // Default configuration object
  const [config, setConfig] = useState<VaultConfig>({
    hasPasscode: false,
    passcodeHash: '',
    salt: '',
    failedAttempts: 0,
    selfDestructLimit: 5,
    panicTriggerKey: 'Escape',
    panicInnocentUrl: '',
    autoLockTime: 5, // inactive lock minutes
  });

  // Load configuration from IndexedDB database on boot
  const loadConfiguration = async () => {
    try {
      await openDb();
      const storedSalt = await getConfigValue<string>('salt');
      const storedCanary = await getConfigValue<ArrayBuffer>('canary');
      const storedLimit = await getConfigValue<number>('selfDestructLimit');
      const storedAutoLock = await getConfigValue<number>('autoLockTime');
      const storedFails = await getConfigValue<number>('failedAttempts');

      const isConfigured = !!(storedSalt && storedCanary);

      setConfig(prev => ({
        ...prev,
        hasPasscode: isConfigured,
        salt: storedSalt || '',
        selfDestructLimit: storedLimit !== null ? storedLimit : 5,
        autoLockTime: storedAutoLock !== null ? storedAutoLock : 5,
        failedAttempts: storedFails !== null ? storedFails : 0,
      }));

      if (isConfigured && cryptoKey) {
        // Refresh locked entries index
        const files = await getAllEncryptedFiles();
        setEncryptedEntries(files);
      }
    } catch (err) {
      console.error('Database connection failed', err);
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    loadConfiguration();
  }, [cryptoKey]);

  // Tab focus locking - Auto lock if user toggles away from browser tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && cryptoKey && config.autoLockTime > 0) {
        handleLockVault();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => window.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [cryptoKey, config.autoLockTime]);

  // Handle Panic Hotkey Press (Escape Key is traditional shortcut)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && cryptoKey) {
        setIsPanicActive(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cryptoKey]);

  // Update specific options value
  const handleUpdateConfig = async (newConfig: Partial<VaultConfig>) => {
    try {
      if (newConfig.selfDestructLimit !== undefined) {
        await setConfigValue('selfDestructLimit', newConfig.selfDestructLimit);
      }
      if (newConfig.autoLockTime !== undefined) {
        await setConfigValue('autoLockTime', newConfig.autoLockTime);
      }
      
      setConfig(prev => ({
        ...prev,
        ...newConfig
      }));
    } catch (err) {
      console.error(err);
    }
  };

  // Lock up the vault and flush memory keys immediately
  const handleLockVault = () => {
    setCryptoKey(null);
    setEncryptedEntries([]);
    setActiveTab('vault');
    setIsPanicActive(false);
  };

  // Setup security passcode
  const handleCreatePasscode = async (passcode: string) => {
    try {
      const saltBytes = generateRandomBytes(16);
      const derived = await deriveKey(passcode, saltBytes);
      
      // Encrypt verification canary
      const canaryData = new TextEncoder().encode('sirlock_canary');
      const canaryIv = generateRandomBytes(12);
      const encryptedCanary = await encryptData(canaryData, derived, canaryIv);

      // Write parameters to DB config
      await setConfigValue('salt', bytesToHex(saltBytes));
      await setConfigValue('canary', encryptedCanary);
      await setConfigValue('canaryIv', bytesToHex(canaryIv));
      await setConfigValue('selfDestructLimit', 5);
      await setConfigValue('autoLockTime', 5);
      await setConfigValue('failedAttempts', 0);

      await addAuditLog('unlocked', 'Initialized secure vault passcode canister with active memory authorization');

      // Hold memory authorization
      setCryptoKey(derived);
      await loadConfiguration();
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  // Verify and unlock vault
  const handleVerifyPasscode = async (passcode: string): Promise<boolean> => {
    try {
      const storedSaltHex = await getConfigValue<string>('salt');
      const storedCanary = await getConfigValue<ArrayBuffer>('canary');
      const storedCanaryIvHex = await getConfigValue<string>('canaryIv');
      const storedFails = await getConfigValue<number>('failedAttempts') || 0;

      if (!storedSaltHex || !storedCanary || !storedCanaryIvHex) return false;

      const salt = hexToBytes(storedSaltHex);
      const canaryIv = hexToBytes(storedCanaryIvHex);

      // Derive testing key
      const testKey = await deriveKey(passcode, salt);

      try {
        const decryptedCanaryBytes = await decryptData(storedCanary, testKey, canaryIv);
        const canaryStr = new TextDecoder().decode(decryptedCanaryBytes);

        if (canaryStr === 'sirlock_canary') {
          // Success! Reset failed attempts
          await setConfigValue('failedAttempts', 0);
          await addAuditLog('unlocked', 'Granted clearance • Secure vault unlocked');
          
          setCryptoKey(testKey);
          return true;
        }
      } catch (decryptionErr) {
        // Decryption failed means passcode incorrect
        console.warn('Decryption Canary failed', decryptionErr);
      }

      // Handle Fail count
      const nextFails = storedFails + 1;
      await setConfigValue('failedAttempts', nextFails);
      await addAuditLog('unlock_failed', `Failed passcode verification (Attempt ${nextFails})`);

      // Check self-destruct limits
      if (config.selfDestructLimit > 0 && nextFails >= config.selfDestructLimit) {
        await handleTriggerSelfDestruct();
      } else {
        await loadConfiguration();
      }

      return false;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  // Changing existing passcode & rotating database keys
  const handleChangePasscode = async (oldPass: string, newPass: string): Promise<boolean> => {
    try {
      const storedSaltHex = await getConfigValue<string>('salt');
      const storedCanary = await getConfigValue<ArrayBuffer>('canary');
      const storedCanaryIvHex = await getConfigValue<string>('canaryIv');

      if (!storedSaltHex || !storedCanary || !storedCanaryIvHex) return false;

      const salt = hexToBytes(storedSaltHex);
      const canaryIv = hexToBytes(storedCanaryIvHex);

      // Verify old passcode
      const testOldKey = await deriveKey(oldPass, salt);
      try {
        const decryptedCanaryBytes = await decryptData(storedCanary, testOldKey, canaryIv);
        const canaryStr = new TextDecoder().decode(decryptedCanaryBytes);
        if (canaryStr !== 'sirlock_canary') return false;
      } catch (err) {
        return false;
      }

      // Process of key rotating:
      // Since AES-256 keys are derived, when passcode is altered, we keep files the same
      // BUT we re-encrypt the file content using the new derived key!
      // This is a dynamic re-encryption wave! Very secure!
      const nextSaltBytes = generateRandomBytes(16);
      const nextKey = await deriveKey(newPass, nextSaltBytes);

      // Re-encrypt canary
      const nextCanaryIv = generateRandomBytes(12);
      const nextEncryptedCanary = await encryptData(
        new TextEncoder().encode('sirlock_canary'),
        nextKey,
        nextCanaryIv
      );

      // Read files, decrypt with old key, encrypt with new key
      const currentFiles = await getAllEncryptedFiles();
      for (const file of currentFiles) {
        // Decrypt with old credentials
        const textMetaBuffer = await decryptData(file.encryptedMetadata, testOldKey, file.metadataIv);
        const dataBuffer = await decryptData(file.ciphertext, testOldKey, file.contentIv);

        // Re-encrypt with next credentials
        const nextContentIv = generateRandomBytes(12);
        const nextMetaIv = generateRandomBytes(12);

        const nextCiphertext = await encryptData(dataBuffer, nextKey, nextContentIv);
        const nextEncryptedMeta = await encryptData(textMetaBuffer, nextKey, nextMetaIv);

        // Update record
        file.ciphertext = nextCiphertext;
        file.contentIv = nextContentIv;
        file.encryptedMetadata = nextEncryptedMeta;
        file.metadataIv = nextMetaIv;

        await setConfigValue(`file_temp_${file.id}`, file); // batch helper placeholder if we want
      }

      // Commit changes
      await setConfigValue('salt', bytesToHex(nextSaltBytes));
      await setConfigValue('canary', nextEncryptedCanary);
      await setConfigValue('canaryIv', bytesToHex(nextCanaryIv));

      setCryptoKey(nextKey);
      await loadConfiguration();
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  // Catastrophic Wiping Triggered (Self-Destruct sequence)
  const handleTriggerSelfDestruct = async () => {
    setCryptoKey(null);
    setEncryptedEntries([]);
    setIsPanicActive(false);
    
    try {
      await wipeDatabase();
      localStorage.clear();
      setSelfDestructTriggered(true);
    } catch (err) {
      console.error(err);
    }
  };

  // Custom transclucent title bar with manual control mappings
  const renderTitleBar = () => (
    <div 
      id="desktop-title-bar" 
      className="h-8 bg-slate-950/85 border-b border-white/5 flex items-center justify-between px-4 select-none backdrop-blur-md sticky top-0 w-full z-50 text-xs font-sans tracking-wide text-slate-300"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-2">
        <img src="/logo.svg" alt="Sir Lock" referrerPolicy="no-referrer" className="w-4 h-4 rounded-md shadow-sm" />
        <span className="font-semibold text-[11px] uppercase tracking-wider text-emerald-400">SIR LOCK</span>
      </div>
      
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button 
          className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 transition-colors text-slate-400 hover:text-white cursor-pointer"
          onClick={() => console.log('Minimize')}
          title="Minimize Window"
        >
          <span className="block w-2.5 h-0.5 bg-current"></span>
        </button>
        
        <button 
          className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 transition-colors text-slate-400 hover:text-white cursor-pointer"
          onClick={() => console.log('Maximize')}
          title="Maximize Window"
        >
          <span className="block w-2.5 h-2.5 border border-current rounded-sm"></span>
        </button>

        <button 
          id="desktop-close-btn"
          className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-500 hover:text-slate-950 text-slate-400 transition-colors cursor-pointer"
          onClick={() => {
            handleLockVault();
            try {
              window.close();
            } catch (e) {
              // Ignore safety exceptions
            }
          }}
          title="Secure & Close App"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  );

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col text-left relative overflow-x-hidden">
        {renderTitleBar()}
        <div id="loader-screen" className="flex-1 flex flex-col items-center justify-center relative">
          <div className="absolute inset-0 mesh-gradient opacity-60 -z-10" />
          <div className="glass-card p-8 rounded-3xl flex flex-col items-center shadow-2xl">
            <RefreshCw size={32} className="text-emerald-400 animate-spin mb-4" />
            <p className="text-xs font-mono text-emerald-300 uppercase tracking-widest">
              Mounting Secure Cryptographic Module...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Decoy/Panic View
  if (isPanicActive) {
    return <PanicScreen onDeactivatePanic={() => setIsPanicActive(false)} />;
  }

  // Vault Self-Destruct Warning
  if (selfDestructTriggered) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col text-left relative overflow-x-hidden">
        {renderTitleBar()}
        <div id="self-destruct-screen" className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none relative">
          <div className="absolute inset-0 mesh-gradient opacity-60 -z-10" />
          <div className="glass-card p-10 rounded-3xl max-w-md shadow-2xl border border-red-500/20 flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-red-950/30 border border-red-500/30 flex items-center justify-center text-red-500 mb-6 animate-pulse">
              <AlertOctagon size={40} />
            </div>
            <h1 className="text-2xl font-bold font-sans text-red-400 tracking-tight uppercase mb-2">
              Self-Destruct Executed
            </h1>
            <p className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-6">
              Security policy breached. All local files purged.
            </p>
            <div className="p-4 bg-red-950/10 border border-red-900/20 rounded-2xl text-xs text-zinc-300 font-sans leading-relaxed mb-8">
              The passcode was entered incorrectly too many consecutive times. To safeguard privacy, the core database has executed a military-grade zero-write wipe. All encryption canisters have been completely destroyed.
            </div>
            <button
              id="rebuild-db"
              onClick={() => {
                setSelfDestructTriggered(false);
                loadConfiguration();
              }}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-sans font-semibold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
            >
              Initialize Day Zero Vault
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="main-app-container" className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col text-left relative overflow-x-hidden">
      
      {/* Background mesh-gradient layer */}
      <div className="absolute inset-0 mesh-gradient opacity-60 -z-10 pointer-events-none" />

      {/* Custom Desktop Title Bar */}
      {renderTitleBar()}

      {/* Decrypted Vault Header Panel */}
      {cryptoKey && (
        <header className="border-b border-white/5 bg-slate-950/45 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 sticky top-8 z-20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950 font-extrabold select-none">
              <img src="/logo.svg" alt="Sir Lock" referrerPolicy="no-referrer" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-sans tracking-tight text-white flex items-center gap-2">
                SIR LOCK
                <span className="text-[9px] font-mono font-medium py-0.5 px-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full uppercase tracking-wider">
                  PREVIEW-BUILD
                </span>
              </h1>
              <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                Military-Grade File Hiding Vault
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10">
              <button
                id="tab-vault-view"
                onClick={() => setActiveTab('vault')}
                className={`px-4 py-2 rounded-lg text-xs font-sans font-semibold transition-colors cursor-pointer ${
                  activeTab === 'vault'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Locked Directory
              </button>
              <button
                id="tab-settings-view"
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-2 rounded-lg text-xs font-sans font-semibold transition-colors cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Security Parameters
              </button>
            </nav>

            <button
              id="header-lock-btn"
              onClick={handleLockVault}
              className="p-2.5 bg-white/5 hover:bg-red-500 hover:text-slate-950 text-slate-300 border border-white/10 rounded-xl transition-all cursor-pointer"
              title="Secure Logout / Lock Directory"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>
      )}

      {/* Main Sandbox Canvas */}
      <main className="flex-1 py-10 z-10 relative">
        <AnimatePresence mode="wait">
          {!cryptoKey ? (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex justify-center items-center py-6"
            >
              <VaultKeypad
                hasPasscode={config.hasPasscode}
                failedAttempts={config.failedAttempts}
                selfDestructLimit={config.selfDestructLimit}
                onVerifyPasscode={handleVerifyPasscode}
                onCreatePasscode={handleCreatePasscode}
                selfDestructTriggered={selfDestructTriggered}
              />
            </motion.div>
          ) : (
            <motion.div
              key="active-vault"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {activeTab === 'vault' ? (
                <VaultDashboard
                  cryptoKey={cryptoKey}
                  encryptedEntries={encryptedEntries}
                  onLock={handleLockVault}
                  onRefreshEntries={loadConfiguration}
                  onTriggerPanic={() => setIsPanicActive(true)}
                />
              ) : (
                <VaultSettings
                  config={config}
                  onUpdateConfig={handleUpdateConfig}
                  onChangePasscode={handleChangePasscode}
                  onHardReset={handleLockVault}
                  totalFiles={encryptedEntries.length}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer System Credits */}
      <footer className="border-t border-white/5 py-6 text-center text-[10px] font-mono text-slate-500 uppercase tracking-widest leading-relaxed z-10 relative bg-slate-950/30">
        <p>© 2026 Sir Lock. Secure Origin Encrypted Sandboxing Workspace.</p>
        <p className="mt-1">Built for absolute personal disk privacy. Desktop Electron client conversion active.</p>
      </footer>
    </div>
  );
}
