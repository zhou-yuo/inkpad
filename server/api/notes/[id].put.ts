import { createError, getRouterParam } from 'h3'
import { getDb, nowIso } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { sha256 } from '../../utils/crypto'
import { readJsonBody, requireString } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Note id is required.' })
  const existing = await getDb(event).prepare('SELECT id, visibility, published_at FROM notes WHERE id = ? AND user_id = ? AND deleted_at IS NULL').bind(id, user.id).first<{ id: string, visibility: string, published_at: string | null }>()
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Note not found.' })

  const body = await readJsonBody<{
    encryptedTitle?: string
    encryptedBody?: string
    titleIv?: string
    bodyIv?: string
    visibility?: unknown
    publicTitle?: unknown
    publicBody?: unknown
    tags?: unknown
  }>(event)
  const encryptedTitle = requireString(body.encryptedTitle, 'Encrypted title', 1, 20000)
  const encryptedBody = requireString(body.encryptedBody, 'Encrypted body', 1, 1000000)
  const titleIv = requireString(body.titleIv, 'Title IV', 8, 200)
  const bodyIv = requireString(body.bodyIv, 'Body IV', 8, 200)
  const visibility = body.visibility === 'public' ? 'public' : 'private'
  const publicTitle = visibility === 'public' ? requireString(body.publicTitle, 'Public title', 1, 20000).trim() : null
  const publicBody = visibility === 'public' ? requireString(body.publicBody, 'Public body', 0, 1000000) : null
  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean))]
        .slice(0, 5)
    : []
  const updatedAt = nowIso()
  const publishedAt = visibility === 'public'
    ? existing.visibility === 'public' ? existing.published_at || updatedAt : updatedAt
    : null

  await getDb(event).prepare(`
    UPDATE notes
    SET encrypted_title = ?, encrypted_body = ?, title_iv = ?, body_iv = ?, visibility = ?, public_title = ?, public_body = ?, published_at = ?, tags = ?, preview_hash = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).bind(encryptedTitle, encryptedBody, titleIv, bodyIv, visibility, publicTitle, publicBody, publishedAt, JSON.stringify(tags), await sha256(encryptedTitle), updatedAt, id, user.id).run()

  return { note: { id, encryptedTitle, encryptedBody, titleIv, bodyIv, visibility, tags, updatedAt } }
})
