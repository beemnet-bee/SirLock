export interface VaultFile {
  id: string;
  name: string; // decrypted name in UI, but stored encrypted in DB
  mimeType: string; // decrypted mime type in UI, but stored encrypted in DB
  size: number; // size in bytes
  createdAt: number; // timestamp
}

export interface EncryptedDbEntry {
  id: string;
  encryptedMetadata: ArrayBuffer; // AES-GCM encrypted JSON with {name, mimeType}
  metadataIv: Uint8Array;
  ciphertext: ArrayBuffer; // AES-GCM encrypted file contents
  contentIv: Uint8Array;
  size: number; // original size in bytes
  createdAt: number;
}

export interface VaultConfig {
  hasPasscode: boolean;
  passcodeHash: string; // SHA-256 hash or similar for quick unlock validation
  salt: string; // salt used for PBKDF2
  failedAttempts: number;
  selfDestructLimit: number; // 0 for disabled, or e.g., 5 attempts
  panicTriggerKey: string; // e.g., "Escape"
  panicInnocentUrl: string; // or a custom innocent layout
  autoLockTime: number; // in minutes, 0 for never
}

export interface AuditLogEntry {
  id: string;
  action: 'unlock_failed' | 'unlocked' | 'file_hidden' | 'file_restored' | 'file_deleted' | 'vault_wiped' | 'passcode_changed' | 'self_destructed';
  timestamp: number;
  details: string;
}
