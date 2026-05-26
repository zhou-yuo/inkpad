import { createError, getRouterParam } from 'h3'
import { getDb, nowIso } from '../../utils/db'
import { requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Note id is required.' })
  const timestamp = nowIso()
  await getDb(event).prepare('UPDATE notes SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .bind(timestamp, timestamp, id, user.id)
    .run()
  return { ok: true }
})
