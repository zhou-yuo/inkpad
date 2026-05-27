<script setup lang="ts">
import { ArrowLeft, Clock, Globe2 } from '@lucide/vue'

type PublicNoteSummary = {
  id: string
  account: string
  title: string
  tags: string[]
  publishedAt: string | null
  updatedAt: string
}

type PublicNote = PublicNoteSummary & {
  body: string
  createdAt: string
}

const notes = ref<PublicNoteSummary[]>([])
const selectedId = ref<string | null>(null)
const selectedNote = ref<PublicNote | null>(null)
const loading = ref(true)
const detailLoading = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    const response = await $fetch<{ notes: PublicNoteSummary[] }>('/api/public/notes')
    notes.value = response.notes
    selectedId.value = response.notes[0]?.id || null
    if (selectedId.value) await loadNote(selectedId.value)
  } catch (err: any) {
    error.value = err?.statusMessage || err?.message || 'Could not load public notes.'
  } finally {
    loading.value = false
  }
})

async function loadNote(id: string) {
  selectedId.value = id
  detailLoading.value = true
  error.value = ''
  try {
    const response = await $fetch<{ note: PublicNote }>(`/api/public/notes/${id}`)
    selectedNote.value = response.note
  } catch (err: any) {
    error.value = err?.statusMessage || err?.message || 'Could not load this public note.'
  } finally {
    detailLoading.value = false
  }
}

function formatDate(value: string | null) {
  if (!value) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
</script>

<template>
  <section class="public-screen">
    <header class="public-top">
      <NuxtLink class="ghost-button" to="/">
        <ArrowLeft aria-hidden="true" />
        <span>Back</span>
      </NuxtLink>
      <div>
        <span class="public-kicker">
          <Globe2 aria-hidden="true" />
          Public Notes
        </span>
        <h1>公开备忘录</h1>
      </div>
    </header>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="public-layout glass">
      <aside class="public-list">
        <p v-if="loading" class="empty-hint">Loading...</p>
        <button
          v-for="note in notes"
          :key="note.id"
          class="public-row"
          :class="{ active: note.id === selectedId }"
          type="button"
          @click="loadNote(note.id)"
        >
          <strong>{{ note.title || 'Untitled' }}</strong>
          <span>{{ note.account }} · {{ formatDate(note.updatedAt) }}</span>
        </button>
        <p v-if="!loading && !notes.length" class="empty-hint">暂无公开备忘录</p>
      </aside>

      <article class="public-note">
        <div v-if="detailLoading" class="empty-state">Loading...</div>
        <template v-else-if="selectedNote">
          <div class="public-note-head">
            <h2>{{ selectedNote.title || 'Untitled' }}</h2>
            <span>
              <Clock aria-hidden="true" />
              {{ formatDate(selectedNote.updatedAt) }}
            </span>
            <small>{{ selectedNote.account }}</small>
          </div>
          <div v-if="selectedNote.tags.length" class="public-tags">
            <span v-for="tag in selectedNote.tags" :key="tag" class="tag-pill">{{ tag }}</span>
          </div>
          <p class="public-body">{{ selectedNote.body }}</p>
        </template>
        <div v-else class="empty-state">选择一条公开备忘录</div>
      </article>
    </div>
  </section>
</template>
