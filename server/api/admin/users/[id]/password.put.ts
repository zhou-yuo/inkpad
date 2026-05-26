import { createError, getRouterParam } from 'h3'
import { requireAdmin, updateUserPassword } from '../../../../utils/auth'
import { getDb } from '../../../../utils/db'
import { readJsonBody, requireString } from '../../../../utils/validation'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const userId = getRouterParam(event, 'id')
  if (!userId) throw createError({ statusCode: 400, statusMessage: 'User id is required.' })
  const body = await readJsonBody<{ newPassword?: string }>(event)
  const newPassword = requireString(body.newPassword, 'New password', 8, 256)
  const user = await getDb(event).prepare('SELECT id FROM users WHERE id = ?').bind(userId).first<{ id: string }>()
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found.' })
  await updateUserPassword(event, userId, newPassword)
  return { ok: true }
})
