type RemoteNote = {
  id: string
  encryptedTitle: string
  encryptedBody: string
  titleIv: string
  bodyIv: string
  tags?: string[]
  createdAt: string
  updatedAt: string
}

export type Note = {
  id: string
  title: string
  body: string
  tags: string[]
  createdAt: string
  updatedAt: string
  isDirty?: boolean
}

export function useNotes() {
  const notes = useState<Note[]>('notes', () => [])
  const selectedId = useState<string | null>('selected-note-id', () => null)
  const loading = useState('notes-loading', () => false)
  const cryptoBox = useVaultCrypto()

  const selectedNote = computed(() => notes.value.find((note) => note.id === selectedId.value) || null)

  async function decryptNote(note: RemoteNote): Promise<Note> {
    return {
      id: note.id,
      title: await cryptoBox.decryptText(note.encryptedTitle, note.titleIv),
      body: await cryptoBox.decryptText(note.encryptedBody, note.bodyIv),
      tags: Array.isArray(note.tags) ? note.tags : [],
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    }
  }

  async function fetchNotes() {
    if (!cryptoBox.key.value) return
    loading.value = true
    try {
      const response = await $fetch<{ notes: RemoteNote[] }>('/api/notes')
      notes.value = await Promise.all(response.notes.map(decryptNote))
      if (!selectedId.value && notes.value[0]) selectedId.value = notes.value[0].id
    } finally {
      loading.value = false
    }
  }

  async function encryptPayload(note: Pick<Note, 'title' | 'body'>) {
    const title = await cryptoBox.encryptText(note.title.trim() || 'Untitled')
    const body = await cryptoBox.encryptText(note.body)
    return {
      encryptedTitle: title.cipherText,
      titleIv: title.iv,
      encryptedBody: body.cipherText,
      bodyIv: body.iv,
    }
  }

  async function createNote() {
    const payload = await encryptPayload({ title: 'New Note', body: '' })
    const response = await $fetch<{ note: RemoteNote }>('/api/notes', { method: 'POST', body: { ...payload, tags: [] } })
    const note = await decryptNote(response.note)
    notes.value = [note, ...notes.value]
    selectedId.value = note.id
  }

  async function saveNote(note: Note) {
    const payload = await encryptPayload(note)
    const response = await $fetch<{ note: RemoteNote }>(`/api/notes/${note.id}`, { method: 'PUT', body: { ...payload, tags: note.tags } })
    note.updatedAt = response.note.updatedAt
    note.tags = Array.isArray(response.note.tags) ? response.note.tags : []
    note.title = note.title.trim() || 'Untitled'
    note.isDirty = false
    notes.value = [...notes.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async function saveAllNotes() {
    for (const note of notes.value) {
      await saveNote(note)
    }
  }

  async function reencryptAllNotes() {
    const payloads = []
    for (const note of notes.value) {
      payloads.push({ id: note.id, ...await encryptPayload(note) })
    }
    await $fetch('/api/notes/reencrypt', {
      method: 'PUT',
      body: { notes: payloads },
    })
  }

  async function migrateLegacyNotesToVaultKey() {
    await reencryptAllNotes()
  }

  async function deleteNote(noteId: string) {
    await $fetch(`/api/notes/${noteId}`, { method: 'DELETE' })
    notes.value = notes.value.filter((note) => note.id !== noteId)
    selectedId.value = notes.value[0]?.id || null
  }

  return {
    notes,
    selectedId,
    selectedNote,
    loading,
    fetchNotes,
    createNote,
    saveNote,
    saveAllNotes,
    reencryptAllNotes,
    migrateLegacyNotesToVaultKey,
    deleteNote,
  }
}
