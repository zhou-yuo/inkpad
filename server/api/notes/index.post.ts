import { createError } from 'h3'
import { getDb, nowIso } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { randomId, sha256 } from '../../utils/crypto'
import { readJsonBody, requireString } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readJsonBody<{
    encryptedTitle?: string
    encryptedBody?: string
    titleIv?: string
    bodyIv?: string
    categoryId?: string | null
  }>(event)
  const encryptedTitle = requireString(body.encryptedTitle, 'Encrypted title', 1, 20000)
  const encryptedBody = requireString(body.encryptedBody, 'Encrypted body', 1, 1000000)
  const titleIv = requireString(body.titleIv, 'Title IV', 8, 200)
  const bodyIv = requireString(body.bodyIv, 'Body IV', 8, 200)
  const categoryId = typeof body.categoryId === 'string' && body.categoryId.trim() ? body.categoryId : null
  if (categoryId) {
    const category = await getDb(event).prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?')
      .bind(categoryId, user.id)
      .first()
    if (!category) throw createError({ statusCode: 400, statusMessage: 'Category not found.' })
  }
  const timestamp = nowIso()
  const id = randomId('note_')

  await getDb(event).prepare(`
    INSERT INTO notes (id, user_id, encrypted_title, encrypted_body, title_iv, body_iv, category_id, preview_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, user.id, encryptedTitle, encryptedBody, titleIv, bodyIv, categoryId, await sha256(encryptedTitle), timestamp, timestamp).run()

  return { note: { id, encryptedTitle, encryptedBody, titleIv, bodyIv, categoryId, createdAt: timestamp, updatedAt: timestamp } }
})
