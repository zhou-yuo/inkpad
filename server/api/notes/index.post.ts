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
    visibility?: unknown
    publicTitle?: unknown
    publicBody?: unknown
    tags?: unknown
  }>(event)
  const encryptedTitle = requireString(body.encryptedTitle, 'Encrypted title', 1, 20000)
  const encryptedBody = requireString(body.encryptedBody, 'Encrypted body', 1, 1000000)
  const titleIv = requireString(body.titleIv, 'Title IV', 8, 200)
  const bodyIv = requireString(body.bodyIv, 'Body IV', 8, 200)
  const timestamp = nowIso()
  const visibility = body.visibility === 'public' ? 'public' : 'private'
  const publicTitle = visibility === 'public' ? requireString(body.publicTitle, 'Public title', 1, 20000).trim() : null
  const publicBody = visibility === 'public' ? requireString(body.publicBody, 'Public body', 0, 1000000) : null
  const publishedAt = visibility === 'public' ? timestamp : null
  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean))]
        .slice(0, 5)
    : []
  const id = randomId('note_')

  await getDb(event).prepare(`
    INSERT INTO notes (id, user_id, encrypted_title, encrypted_body, title_iv, body_iv, visibility, public_title, public_body, published_at, tags, preview_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, user.id, encryptedTitle, encryptedBody, titleIv, bodyIv, visibility, publicTitle, publicBody, publishedAt, JSON.stringify(tags), await sha256(encryptedTitle), timestamp, timestamp).run()

  return { note: { id, encryptedTitle, encryptedBody, titleIv, bodyIv, visibility, tags, createdAt: timestamp, updatedAt: timestamp } }
})
