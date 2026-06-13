import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, ShieldAlert, KeyRound, ArrowRight, Delete, RotateCcw, AlertTriangle } from 'lucide-react';

interface VaultKeypadProps {
  hasPasscode: boolean;
  failedAttempts: number;
  selfDestructLimit: number;
  onVerifyPasscode: (passcode: string) => Promise<boolean>;
  onCreatePasscode: (passcode: string) => Promise<void>;
  selfDestructTriggered: boolean;
}

export default function VaultKeypad({
  hasPasscode,
  failedAttempts,
  selfDestructLimit,
  onVerifyPasscode,
  onCreatePasscode,
  selfDestructTriggered,
}: VaultKeypadProps) {
  const [passcode, setPasscode] = useState<string>('');
  const [setupStep, setSetupStep] = useState<'create' | 'confirm'>('create');
  const [tempPasscode, setTempPasscode] = useState<string>('');
  const [statusText, setStatusText] = useState<string>('');
  const [isError, setIsError] = useState<boolean>(false);
  const [shakeId, setShakeId] = useState<number>(0);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  useEffect(() => {
    if (!hasPasscode) {
      setSetupStep('create');
      setStatusText('Set a secure passcode (4 to 8 digits)');
    } else {
      setStatusText('Enter passcode to unlock vault');
    }
  }, [hasPasscode]);

  const handleKeyPress = (num: string) => {
    if (isVerifying) return;
    setIsError(false);
    if (passcode.length < 8) {
      setPasscode(prev => prev + num);
    }
  };

  const handleDelete = () => {
    if (isVerifying) return;
    setIsError(false);
    setPasscode(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (isVerifying) return;
    setIsError(false);
    setPasscode('');
  };

  const handleSubmit = async () => {
    if (passcode.length < 4) {
      setIsError(true);
      setShakeId(prev => prev + 1);
      setStatusText('Passcode must be at least 4 digits');
      return;
    }

    setIsVerifying(true);
    if (!hasPasscode) {
      // First Time Setup Handler
      if (setupStep === 'create') {
        const firstPass = passcode;
        setTempPasscode(firstPass);
        setPasscode('');
        setSetupStep('confirm');
        setStatusText('Confirm your secure passcode');
      } else {
        if (passcode === tempPasscode) {
          try {
            await onCreatePasscode(passcode);
          } catch (err) {
            console.error(err);
            setStatusText('Failed to build encrypt module. Try again.');
            setIsError(true);
            setShakeId(prev => prev + 1);
            setPasscode('');
            setSetupStep('create');
          }
        } else {
          setIsError(true);
          setShakeId(prev => prev + 1);
          setPasscode('');
          setSetupStep('create');
          setTempPasscode('');
          setStatusText("Passcodes did not match. Let's try again.");
        }
      }
    } else {
      // Unlocking Handler
      const success = await onVerifyPasscode(passcode);
      if (!success) {
        setIsError(true);
        setShakeId(prev => prev + 1);
        setPasscode('');
        setStatusText('Invalid passcode. Access Denied.');
      }
    }
    setIsVerifying(false);
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selfDestructTriggered) return;
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        handleClear();
      } else if (e.key === 'Enter') {
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [passcode, setupStep, tempPasscode, hasPasscode, selfDestructTriggered, isVerifying]);

  const progressDots = Array.from({ length: Math.max(4, passcode.length) }).map((_, idx) => {
    const isActive = idx < passcode.length;
    return (
      <motion.div
        key={idx}
        animate={{
          scale: isActive ? [1, 1.2, 1] : 1,
          backgroundColor: isActive ? '#10b981' : 'rgba(255, 255, 255, 0.05)'
        }}
        transition={{ duration: 0.15 }}
        className="w-4 h-4 rounded-full border border-white/10"
      />
    );
  });

  return (
    <div id="vault-keypad-container" className="flex flex-col items-center justify-center max-w-md w-full mx-auto px-6 py-12 glass-card rounded-3xl shadow-2xl relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Lock Indicator Header */}
      <div className="flex flex-col items-center mb-6">
        <motion.div
          animate={
            isError ? { x: [-10, 10, -10, 10, -5, 5, 0] } : {}
          }
          key={shakeId}
          transition={{ duration: 0.4 }}
          className={`w-16 h-16 rounded-full flex items-center justify-center border-2 mb-4 shadow-lg ${
            isError
              ? 'border-red-500 bg-red-950/30 text-red-400'
              : !hasPasscode
              ? 'border-emerald-500 bg-emerald-950/20 text-emerald-400'
              : 'border-white/10 bg-white/5 text-slate-400'
          }`}
        >
          {isError ? (
            <ShieldAlert size={28} className="animate-pulse" />
          ) : !hasPasscode ? (
            <KeyRound size={28} className="animate-bounce" />
          ) : (
            <Shield size={28} />
          )}
        </motion.div>

        <h1 className="text-2xl font-bold font-sans tracking-tight text-white mb-1 selection:bg-emerald-500 selection:text-black">
          SIR LOCK
        </h1>
        <p className="text-xs font-mono text-emerald-400 tracking-wider uppercase mb-3 font-semibold">
          FILE HIDING VAULT
        </p>

        <motion.div
          key={statusText}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-xs text-center px-4 py-2 rounded-xl border font-medium ${
            isError 
              ? 'text-red-400 bg-red-950/10 border-red-900/20' 
              : !hasPasscode 
              ? 'text-emerald-400 bg-emerald-950/10 border-emerald-900/20 animate-pulse font-semibold'
              : 'text-slate-300 bg-white/5 border-white/10'
          }`}
        >
          {statusText}
        </motion.div>
      </div>

      {/* Warning if self-destruct limits exist */}
      {hasPasscode && selfDestructLimit > 0 && failedAttempts > 0 && (
        <div className="flex items-center gap-2 mb-6 px-4 py-2 bg-red-950/30 border border-red-900/30 text-red-400 rounded-xl text-xs font-mono animate-pulse w-full justify-center">
          <AlertTriangle size={14} />
          <span>
            {selfDestructLimit - failedAttempts} attempts remaining before Self-Destruct
          </span>
        </div>
      )}

      {/* Entry Dots Indicator */}
      <div className="flex gap-3 justify-center mb-10 h-6">
        {progressDots}
      </div>

      {/* Keypad Grid */}
      <div className="grid grid-cols-3 gap-4 xl:gap-5 w-full max-w-[280px]">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
          <motion.button
            key={num}
            id={`keypad-btn-${num}`}
            whileHover={{ scale: 1.05, borderColor: 'rgba(255, 255, 255, 0.2)' }}
            whileTap={{ scale: 0.95, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
            onClick={() => handleKeyPress(num)}
            className="h-16 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center font-sans font-medium text-lg text-white shadow-sm transition-colors duration-150 cursor-pointer"
          >
            {num}
          </motion.button>
        ))}

        {/* Clear Button */}
        <motion.button
          id="keypad-btn-clear"
          whileHover={{ scale: 1.05, borderColor: '#ef4444' }}
          whileTap={{ scale: 0.95 }}
          onClick={handleClear}
          className="h-16 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-red-400 font-mono text-xs font-semibold uppercase tracking-wider cursor-pointer"
        >
          <RotateCcw size={16} />
        </motion.button>

        {/* Key 0 */}
        <motion.button
          key="0"
          id="keypad-btn-0"
          whileHover={{ scale: 1.05, borderColor: 'rgba(255, 255, 255, 0.2)' }}
          whileTap={{ scale: 0.95, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
          onClick={() => handleKeyPress('0')}
          className="h-16 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center font-sans font-medium text-lg text-white shadow-sm cursor-pointer"
        >
          0
        </motion.button>

        {/* Delete Button */}
        <motion.button
          id="keypad-btn-delete"
          whileHover={{ scale: 1.05, borderColor: 'rgba(255, 255, 255, 0.2)' }}
          whileTap={{ scale: 0.95 }}
          onClick={handleDelete}
          className="h-16 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 cursor-pointer"
        >
          <Delete size={18} />
        </motion.button>
      </div>

      {/* Enter/Unlock Activation Action */}
      <div className="w-full max-w-[280px] mt-6">
        <motion.button
          id="keypad-btn-submit"
          onClick={handleSubmit}
          disabled={passcode.length < 4 || isVerifying}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 font-sans font-semibold text-sm transition-all duration-300 shadow-md cursor-pointer ${
            passcode.length >= 4 && !isVerifying
              ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/20'
              : 'bg-white/5 text-slate-600 border border-white/5 pointer-events-none'
          }`}
        >
          <span>{isVerifying ? 'Decrypting...' : !hasPasscode && setupStep === 'confirm' ? 'Confirm & Initialize' : !hasPasscode ? 'Continue' : 'Grant Clearance'}</span>
          <ArrowRight size={16} />
        </motion.button>
      </div>

      {/* Visual Footprints */}
      <div className="mt-8 text-center">
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest leading-relaxed px-4">
          Military-grade AES-256 Client-Side Isolation
        </p>
      </div>
    </div>
  );
}
