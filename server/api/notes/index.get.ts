import { getDb } from '../../utils/db'
import { requireUser } from '../../utils/auth'

type NoteRow = {
  id: string
  encrypted_title: string
  encrypted_body: string
  title_iv: string
  body_iv: string
  tags: string | null
  created_at: string
  updated_at: string
}

function parseTags(value: string | null) {
  if (!value) return []
  try {
    const tags = JSON.parse(value)
    return Array.isArray(tags) ? tags.filter((tag) => typeof tag === 'string') : []
  } catch {
    return []
  }
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const rows = await getDb(event).prepare(`
    SELECT id, encrypted_title, encrypted_body, title_iv, body_iv, tags, created_at, updated_at
    FROM notes
    WHERE user_id = ? AND deleted_at IS NULL
    ORDER BY updated_at DESC
  `).bind(user.id).all<NoteRow>()
  return {
    notes: rows.results.map((note) => ({
      id: note.id,
      encryptedTitle: note.encrypted_title,
      encryptedBody: note.encrypted_body,
      titleIv: note.title_iv,
      bodyIv: note.body_iv,
      tags: parseTags(note.tags),
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    })),
  }
})
