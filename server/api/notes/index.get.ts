import { getDb } from '../../utils/db'
import { requireUser } from '../../utils/auth'

type NoteRow = {
  id: string
  encrypted_title: string
  encrypted_body: string
  title_iv: string
  body_iv: string
  category_id: string | null
  created_at: string
  updated_at: string
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const rows = await getDb(event).prepare(`
    SELECT id, encrypted_title, encrypted_body, title_iv, body_iv, category_id, created_at, updated_at
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
      categoryId: note.category_id,
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    })),
  }
})
