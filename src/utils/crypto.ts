/**
 * Sir Lock - Secure Cryptography Service (Web Crypto API)
 * Implements PBKDF2 key derivation and AES-256-GCM symmetric encryption.
 */

// Helper: Convert string to Uint8Array
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Helper: Convert Uint8Array to string
export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

// Helper: Convert ArrayBuffer/Uint8Array to hex string (for storing salts or hashes)
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Convert hex string to Uint8Array
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Helper: Generate secure random bytes
export function generateRandomBytes(length: number): Uint8Array {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return array;
}

/**
 * Derives an AES-GCM 256-bit key from a passcode and salt using PBKDF2
 */
export async function deriveKey(passcode: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    stringToBytes(passcode),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false, // key is not extractable (highly secure!)
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data using AES-GCM
 */
export async function encryptData(
  data: ArrayBuffer | Uint8Array,
  key: CryptoKey,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  return window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    data
  );
}

/**
 * Decrypt data using AES-GCM
 */
export async function decryptData(
  ciphertext: ArrayBuffer | Uint8Array,
  key: CryptoKey,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  return window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    ciphertext
  );
}

/**
 * Create a visual representation of raw encrypted content (entropy visualizations)
 */
export function getEntropyStats(buffer: ArrayBuffer): { entropy: number; frequencyData: number[] } {
  const view = new Uint8Array(buffer);
  const frequencies = new Array(256).fill(0);
  const len = view.length;

  if (len === 0) return { entropy: 0, frequencyData: frequencies };

  for (let i = 0; i < len; i++) {
    frequencies[view[i]]++;
  }

  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (frequencies[i] > 0) {
      const p = frequencies[i] / len;
      entropy -= p * Math.log2(p);
    }
  }

  // Normalize frequency data for simple visualization bar graphs
  const maxFreq = Math.max(...frequencies) || 1;
  const frequencyData = frequencies.map(f => (f / maxFreq) * 100);

  return { entropy, frequencyData };
}
