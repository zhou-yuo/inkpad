import { createError } from 'h3'
import { requireUser, verifyPassword } from '../../../utils/auth'
import { readJsonBody, requireString } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readJsonBody<{ currentPassword?: string }>(event)
  const currentPassword = requireString(body.currentPassword, 'Current password', 1, 256)
  if (!await verifyPassword(user, currentPassword)) {
    throw createError({ statusCode: 401, statusMessage: 'Current password is incorrect.' })
  }
  return { ok: true }
})
