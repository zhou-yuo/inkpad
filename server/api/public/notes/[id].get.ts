import { createError, getRouterParam } from 'h3'
import { getDb } from '../../../utils/db'

type PublicNoteRow = {
  id: string
  account: string
  public_title: string
  public_body: string
  tags: string | null
  created_at: string
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
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Note id is required.' })

  const note = await getDb(event).prepare(`
    SELECT notes.id, COALESCE(users.account, users.username) AS account, notes.public_title, notes.public_body,
      notes.tags, notes.created_at, notes.published_at, notes.updated_at
    FROM notes
    JOIN users ON users.id = notes.user_id
    WHERE notes.id = ? AND notes.visibility = 'public' AND notes.deleted_at IS NULL
  `).bind(id).first<PublicNoteRow>()

  if (!note) throw createError({ statusCode: 404, statusMessage: 'Public note not found.' })

  return {
    note: {
      id: note.id,
      account: note.account,
      title: note.public_title,
      body: note.public_body,
      tags: parseTags(note.tags),
      createdAt: note.created_at,
      publishedAt: note.published_at,
      updatedAt: note.updated_at,
    },
  }
})
