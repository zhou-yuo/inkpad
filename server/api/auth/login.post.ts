import { createError } from 'h3'
import { createSession, publicUser, verifyUser } from '../../utils/auth'
import { readJsonBody, requireString } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const body = await readJsonBody<{ account?: string, password?: string }>(event)
  const account = requireString(body.account, 'Account', 3, 40)
  const password = requireString(body.password, 'Password', 1, 256)
  const user = await verifyUser(event, account, password)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid account or password.' })
  }
  await createSession(event, user.id)
  return { user: publicUser(user) }
})
