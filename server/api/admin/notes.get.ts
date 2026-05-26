import { requireAdmin } from '../../utils/auth'
import { getDb } from '../../utils/db'

type AdminNoteRow = {
  id: string
  account: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  encrypted_size: number
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const rows = await getDb(event).prepare(`
    SELECT notes.id, COALESCE(users.account, users.username) AS account, notes.created_at, notes.updated_at, notes.deleted_at,
      LENGTH(notes.encrypted_title) + LENGTH(notes.encrypted_body) AS encrypted_size
    FROM notes
    JOIN users ON users.id = notes.user_id
    ORDER BY notes.updated_at DESC
    LIMIT 500
  `).all<AdminNoteRow>()
  return {
    notes: rows.results.map((note) => ({
      id: note.id,
      account: note.account,
      createdAt: note.created_at,
      updatedAt: note.updated_at,
      deletedAt: note.deleted_at,
      encryptedSize: note.encrypted_size,
    })),
  }
})
