import { createError } from 'h3'
import { getDb, nowIso } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { randomId } from '../../utils/crypto'
import { readJsonBody, requireString } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readJsonBody<{ name?: string }>(event)
  const name = requireString(body.name, 'Category name', 1, 40).trim()
  const existing = await getDb(event).prepare('SELECT id FROM categories WHERE user_id = ? AND LOWER(name) = LOWER(?)')
    .bind(user.id, name)
    .first()
  if (existing) throw createError({ statusCode: 409, statusMessage: 'Category already exists.' })

  const timestamp = nowIso()
  const id = randomId('cat_')
  await getDb(event).prepare(`
    INSERT INTO categories (id, user_id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(id, user.id, name, timestamp, timestamp).run()

  return { category: { id, name, createdAt: timestamp, updatedAt: timestamp } }
})
