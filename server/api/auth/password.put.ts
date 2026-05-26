import { createError } from 'h3'
import { requireUser, updateUserPassword, updateUserPasswordAndVaultKey, verifyPassword } from '../../utils/auth'
import { readJsonBody, requireString } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readJsonBody<{
    currentPassword?: string
    newPassword?: string
    encryptedVaultKey?: string
    vaultKeyIv?: string
  }>(event)
  const currentPassword = requireString(body.currentPassword, 'Current password', 1, 256)
  const newPassword = requireString(body.newPassword, 'New password', 8, 256)
  if (!await verifyPassword(user, currentPassword)) {
    throw createError({ statusCode: 401, statusMessage: 'Current password is incorrect.' })
  }
  if (body.encryptedVaultKey && body.vaultKeyIv) {
    const encryptedVaultKey = requireString(body.encryptedVaultKey, 'Encrypted vault key', 1, 2000)
    const vaultKeyIv = requireString(body.vaultKeyIv, 'Vault key IV', 8, 200)
    await updateUserPasswordAndVaultKey(event, user.id, newPassword, encryptedVaultKey, vaultKeyIv)
  } else {
    await updateUserPassword(event, user.id, newPassword)
  }
  return { ok: true }
})
