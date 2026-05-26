import { getCurrentUser, publicUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  return { user: user ? publicUser(user) : null }
})
