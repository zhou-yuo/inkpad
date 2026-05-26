import { createError } from 'h3'
import { getDb } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { sha256 } from '../../utils/crypto'
import { readJsonBody, requireString } from '../../utils/validation'

type ReencryptedNote = {
  id?: string
  encryptedTitle?: string
  encryptedBody?: string
  titleIv?: string
  bodyIv?: string
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readJsonBody<{ notes?: ReencryptedNote[] }>(event)
  if (!Array.isArray(body.notes)) {
    throw createError({ statusCode: 400, statusMessage: 'Notes are required.' })
  }

  const db = getDb(event)
  for (const note of body.notes) {
    const id = requireString(note.id, 'Note id', 1, 80)
    const encryptedTitle = requireString(note.encryptedTitle, 'Encrypted title', 1, 20000)
    const encryptedBody = requireString(note.encryptedBody, 'Encrypted body', 1, 1000000)
    const titleIv = requireString(note.titleIv, 'Title IV', 8, 200)
    const bodyIv = requireString(note.bodyIv, 'Body IV', 8, 200)
    await db.prepare(`
      UPDATE notes
      SET encrypted_title = ?, encrypted_body = ?, title_iv = ?, body_iv = ?, preview_hash = ?
      WHERE id = ? AND user_id = ? AND deleted_at IS NULL
    `).bind(encryptedTitle, encryptedBody, titleIv, bodyIv, await sha256(encryptedTitle), id, user.id).run()
  }

  return { ok: true }
})
