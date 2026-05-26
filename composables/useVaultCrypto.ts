type EncryptedValue = {
  cipherText: string
  iv: string
}

type VaultUser = {
  encryptionIdentity: string
  encryptionSalt: string
  encryptedVaultKey: string | null
  vaultKeyIv: string | null
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
}

function base64ToBytes(input: string) {
  return Uint8Array.from(atob(input), (char) => char.charCodeAt(0))
}

export function useVaultCrypto() {
  const key = useState<CryptoKey | null>('vault-key', () => null)
  const mode = useState<'vault' | 'legacy' | null>('vault-mode', () => null)
  const unlockedAt = useState<number | null>('vault-unlocked-at', () => null)
  const lastActivityAt = useState<number>('vault-last-activity-at', () => Date.now())

  async function deriveWrappingKey(password: string, identity: string, salt: string) {
    const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey'])
    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(`${identity.toLowerCase()}:${salt}`),
        iterations: 250000,
        hash: 'SHA-256',
      },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    )
  }

  async function deriveLegacyNoteKey(password: string, user: VaultUser) {
    key.value = await deriveWrappingKey(password, user.encryptionIdentity, user.encryptionSalt)
    mode.value = 'legacy'
    unlockedAt.value = Date.now()
    touch()
  }

  async function generateVaultKey() {
    key.value = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    )
    mode.value = 'vault'
    unlockedAt.value = Date.now()
    touch()
  }

  async function importVaultKey(rawKey: ArrayBuffer) {
    key.value = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])
    mode.value = 'vault'
    unlockedAt.value = Date.now()
    touch()
  }

  async function wrapCurrentVaultKey(password: string, user: VaultUser): Promise<EncryptedValue> {
    if (!key.value || mode.value !== 'vault') throw new Error('Vault key is not available.')
    const wrappingKey = await deriveWrappingKey(password, user.encryptionIdentity, user.encryptionSalt)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const rawKey = await crypto.subtle.exportKey('raw', key.value)
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, rawKey)
    return {
      cipherText: bytesToBase64(new Uint8Array(cipher)),
      iv: bytesToBase64(iv),
    }
  }

  async function unlockWithPassword(password: string, user: VaultUser) {
    if (!user.encryptedVaultKey || !user.vaultKeyIv) {
      await deriveLegacyNoteKey(password, user)
      return 'legacy' as const
    }

    const wrappingKey = await deriveWrappingKey(password, user.encryptionIdentity, user.encryptionSalt)
    const rawKey = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(user.vaultKeyIv) },
      wrappingKey,
      base64ToBytes(user.encryptedVaultKey),
    )
    await importVaultKey(rawKey)
    return 'vault' as const
  }

  async function encryptText(plainText: string): Promise<EncryptedValue> {
    if (!key.value) throw new Error('Encryption key is locked.')
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key.value, encoder.encode(plainText))
    return {
      cipherText: bytesToBase64(new Uint8Array(cipher)),
      iv: bytesToBase64(iv),
    }
  }

  async function decryptText(cipherText: string, iv: string) {
    if (!key.value) throw new Error('Encryption key is locked.')
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(iv) },
      key.value,
      base64ToBytes(cipherText),
    )
    return decoder.decode(plain)
  }

  function lock() {
    key.value = null
    mode.value = null
    unlockedAt.value = null
  }

  function touch() {
    lastActivityAt.value = Date.now()
  }

  return {
    key,
    mode,
    unlockedAt,
    lastActivityAt,
    deriveWrappingKey,
    generateVaultKey,
    wrapCurrentVaultKey,
    unlockWithPassword,
    encryptText,
    decryptText,
    lock,
    touch,
  }
}
