import { getDb } from '../../../utils/db'
import { requireUser } from '../../../utils/auth'

type PublicNoteRow = {
  id: string
  account: string
  public_title: string
  tags: string | null
  published_at: string | null
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
  await requireUser(event)

  const rows = await getDb(event).prepare(`
    SELECT notes.id, COALESCE(users.account, users.username) AS account, notes.public_title, notes.tags, notes.published_at, notes.updated_at
    FROM notes
    JOIN users ON users.id = notes.user_id
    WHERE notes.visibility = 'public' AND notes.deleted_at IS NULL
    ORDER BY notes.updated_at DESC
    LIMIT 100
  `).all<PublicNoteRow>()

  return {
    notes: rows.results.map((note) => ({
      id: note.id,
      account: note.account,
      title: note.public_title,
      tags: parseTags(note.tags),
      publishedAt: note.published_at,
      updatedAt: note.updated_at,
    })),
  }
})
