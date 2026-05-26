type User = {
  id: string
  account: string
  encryptionIdentity: string
  displayName: string
  role: 'admin' | 'user'
  encryptionSalt: string
  encryptedVaultKey: string | null
  vaultKeyIv: string | null
}

export function useSession() {
  const user = useState<User | null>('session-user', () => null)
  const loading = useState('session-loading', () => false)
  const cryptoBox = useVaultCrypto()

  async function refresh() {
    loading.value = true
    try {
      const response = await $fetch<{ user: User | null }>('/api/auth/me')
      user.value = response.user
      return response.user
    } finally {
      loading.value = false
    }
  }

  async function login(account: string, password: string) {
    const response = await $fetch<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: { account, password },
    })
    user.value = response.user
    try {
      await cryptoBox.unlockWithPassword(password, response.user)
    } catch {
      cryptoBox.lock()
    }
    return response.user
  }

  async function register(account: string, password: string, displayName: string) {
    const response = await $fetch<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: { account, password, displayName },
    })
    user.value = response.user
    await cryptoBox.generateVaultKey()
    await saveWrappedVaultKey(password)
    return response.user
  }

  async function unlock(password: string) {
    if (!user.value) throw new Error('Please sign in first.')
    await cryptoBox.unlockWithPassword(password, user.value)
  }

  async function verifyCurrentPassword(currentPassword: string) {
    await $fetch('/api/auth/password/verify', {
      method: 'POST',
      body: { currentPassword },
    })
  }

  async function saveWrappedVaultKey(password: string) {
    if (!user.value) throw new Error('Please sign in first.')
    const wrapped = await cryptoBox.wrapCurrentVaultKey(password, user.value)
    const response = await $fetch<{ user: User }>('/api/auth/vault-key', {
      method: 'PUT',
      body: {
        encryptedVaultKey: wrapped.cipherText,
        vaultKeyIv: wrapped.iv,
      },
    })
    user.value = response.user
    return response.user
  }

  async function updatePassword(currentPassword: string, newPassword: string) {
    if (!user.value) throw new Error('Please sign in first.')
    const wrapped = await cryptoBox.wrapCurrentVaultKey(newPassword, user.value)
    await $fetch('/api/auth/password', {
      method: 'PUT',
      body: {
        currentPassword,
        newPassword,
        encryptedVaultKey: wrapped.cipherText,
        vaultKeyIv: wrapped.iv,
      },
    })
    user.value = {
      ...user.value,
      encryptedVaultKey: wrapped.cipherText,
      vaultKeyIv: wrapped.iv,
    }
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    cryptoBox.lock()
    user.value = null
  }

  return {
    user,
    loading,
    refresh,
    login,
    register,
    unlock,
    saveWrappedVaultKey,
    verifyCurrentPassword,
    updatePassword,
    logout,
    vaultKey: cryptoBox.key,
    vaultMode: cryptoBox.mode,
  }
}
