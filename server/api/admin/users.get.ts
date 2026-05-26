import { requireAdmin } from '../../utils/auth'
import { getDb } from '../../utils/db'

type AdminUserRow = {
  id: string
  account: string
  display_name: string
  role: 'admin' | 'user'
  created_at: string
  note_count: number
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const rows = await getDb(event).prepare(`
    SELECT users.id, COALESCE(users.account, users.username) AS account, users.display_name, users.role, users.created_at, COUNT(notes.id) AS note_count
    FROM users
    LEFT JOIN notes ON notes.user_id = users.id AND notes.deleted_at IS NULL
    GROUP BY users.id
    ORDER BY users.created_at DESC
  `).all<AdminUserRow>()
  return {
    users: rows.results.map((user) => ({
      id: user.id,
      account: user.account,
      displayName: user.display_name,
      role: user.role,
      createdAt: user.created_at,
      noteCount: user.note_count,
    })),
  }
})
