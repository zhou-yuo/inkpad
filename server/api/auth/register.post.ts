import { createSession, createUser, publicUser } from '../../utils/auth'
import { readJsonBody, requireString } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const body = await readJsonBody<{ account?: string, password?: string, displayName?: string }>(event)
  const account = requireString(body.account, 'Account', 3, 40)
  const password = requireString(body.password, 'Password', 8, 256)
  const displayName = typeof body.displayName === 'string' ? body.displayName : ''
  const user = await createUser(event, account, password, displayName)
  await createSession(event, user.id)
  return { user: publicUser(user) }
})
