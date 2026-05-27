import { createError, getRouterParam } from 'h3'
import { getDb, nowIso } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { sha256 } from '../../utils/crypto'
import { readJsonBody, requireString } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Note id is required.' })
  const existing = await getDb(event).prepare('SELECT id FROM notes WHERE id = ? AND user_id = ? AND deleted_at IS NULL').bind(id, user.id).first()
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Note not found.' })

  const body = await readJsonBody<{
    encryptedTitle?: string
    encryptedBody?: string
    titleIv?: string
    bodyIv?: string
    categoryId?: string | null
    tags?: unknown
  }>(event)
  const encryptedTitle = requireString(body.encryptedTitle, 'Encrypted title', 1, 20000)
  const encryptedBody = requireString(body.encryptedBody, 'Encrypted body', 1, 1000000)
  const titleIv = requireString(body.titleIv, 'Title IV', 8, 200)
  const bodyIv = requireString(body.bodyIv, 'Body IV', 8, 200)
  const categoryId = typeof body.categoryId === 'string' && body.categoryId.trim() ? body.categoryId : null
  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean))]
        .slice(0, 5)
    : []
  if (categoryId) {
    const category = await getDb(event).prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?')
      .bind(categoryId, user.id)
      .first()
    if (!category) throw createError({ statusCode: 400, statusMessage: 'Category not found.' })
  }
  const updatedAt = nowIso()

  await getDb(event).prepare(`
    UPDATE notes
    SET encrypted_title = ?, encrypted_body = ?, title_iv = ?, body_iv = ?, category_id = ?, tags = ?, preview_hash = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).bind(encryptedTitle, encryptedBody, titleIv, bodyIv, categoryId, JSON.stringify(tags), await sha256(encryptedTitle), updatedAt, id, user.id).run()

  return { note: { id, encryptedTitle, encryptedBody, titleIv, bodyIv, categoryId, tags, updatedAt } }
})
