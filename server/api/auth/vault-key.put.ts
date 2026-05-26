import { requireUser, publicUser } from '../../utils/auth'
import { getDb, nowIso } from '../../utils/db'
import { readJsonBody, requireString } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readJsonBody<{ encryptedVaultKey?: string, vaultKeyIv?: string }>(event)
  const encryptedVaultKey = requireString(body.encryptedVaultKey, 'Encrypted vault key', 1, 2000)
  const vaultKeyIv = requireString(body.vaultKeyIv, 'Vault key IV', 8, 200)

  await getDb(event).prepare('UPDATE users SET encrypted_vault_key = ?, vault_key_iv = ?, updated_at = ? WHERE id = ?')
    .bind(encryptedVaultKey, vaultKeyIv, nowIso(), user.id)
    .run()

  return {
    user: publicUser({
      ...user,
      encrypted_vault_key: encryptedVaultKey,
      vault_key_iv: vaultKeyIv,
      updated_at: nowIso(),
    }),
  }
})
