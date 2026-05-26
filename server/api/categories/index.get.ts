import { getDb } from '../../utils/db'
import { requireUser } from '../../utils/auth'

type CategoryRow = {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const rows = await getDb(event).prepare(`
    SELECT id, name, created_at, updated_at
    FROM categories
    WHERE user_id = ?
    ORDER BY name COLLATE NOCASE ASC
  `).bind(user.id).all<CategoryRow>()

  return {
    categories: rows.results.map((category) => ({
      id: category.id,
      name: category.name,
      createdAt: category.created_at,
      updatedAt: category.updated_at,
    })),
  }
})
