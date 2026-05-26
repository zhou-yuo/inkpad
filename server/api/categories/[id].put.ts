import { createError, getRouterParam } from 'h3'
import { getDb, nowIso } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { readJsonBody, requireString } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Category id is required.' })

  const body = await readJsonBody<{ name?: string }>(event)
  const name = requireString(body.name, 'Category name', 1, 40).trim()
  const db = getDb(event)
  const category = await db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?').bind(id, user.id).first()
  if (!category) throw createError({ statusCode: 404, statusMessage: 'Category not found.' })

  const duplicate = await db.prepare('SELECT id FROM categories WHERE user_id = ? AND LOWER(name) = LOWER(?) AND id != ?')
    .bind(user.id, name, id)
    .first()
  if (duplicate) throw createError({ statusCode: 409, statusMessage: 'Category already exists.' })

  const updatedAt = nowIso()
  await db.prepare('UPDATE categories SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .bind(name, updatedAt, id, user.id)
    .run()

  return { category: { id, name, updatedAt } }
})
