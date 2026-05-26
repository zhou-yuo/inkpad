import { createError, getRouterParam } from 'h3'
import { getDb } from '../../utils/db'
import { requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Category id is required.' })

  const db = getDb(event)
  const category = await db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?').bind(id, user.id).first()
  if (!category) throw createError({ statusCode: 404, statusMessage: 'Category not found.' })

  await db.prepare('UPDATE notes SET category_id = NULL WHERE category_id = ? AND user_id = ?').bind(id, user.id).run()
  await db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').bind(id, user.id).run()

  return { ok: true }
})
