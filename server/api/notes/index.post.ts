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
    tags?: unknown
  }>(event)
  const encryptedTitle = requireString(body.encryptedTitle, 'Encrypted title', 1, 20000)
  const encryptedBody = requireString(body.encryptedBody, 'Encrypted body', 1, 1000000)
  const titleIv = requireString(body.titleIv, 'Title IV', 8, 200)
  const bodyIv = requireString(body.bodyIv, 'Body IV', 8, 200)
  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean))]
        .slice(0, 5)
    : []
  const timestamp = nowIso()
  const id = randomId('note_')

  await getDb(event).prepare(`
    INSERT INTO notes (id, user_id, encrypted_title, encrypted_body, title_iv, body_iv, tags, preview_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, user.id, encryptedTitle, encryptedBody, titleIv, bodyIv, JSON.stringify(tags), await sha256(encryptedTitle), timestamp, timestamp).run()

  return { note: { id, encryptedTitle, encryptedBody, titleIv, bodyIv, tags, createdAt: timestamp, updatedAt: timestamp } }
})
