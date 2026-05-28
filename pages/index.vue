<script setup lang="ts">
import { Globe2, KeyRound, LockKeyhole, LogOut, Plus, Save, ShieldCheck, Trash2, X } from '@lucide/vue'

const session = useSession()
const notesStore = useNotes()
const vault = useVaultCrypto()

const mode = ref<'login' | 'register'>('login')
const account = ref('')
const password = ref('')
const displayName = ref('')
const unlockPassword = ref('')
const authError = ref('')
const passwordError = ref('')
const passwordNotice = ref('')
const saveState = ref<'idle' | 'saving' | 'saved'>('idle')
const showList = ref(true)
const accountMenuOpen = ref(false)
const showChangePasswordModal = ref(false)
const showLogoutConfirm = ref(false)
const showPublicConfirm = ref(false)
const searchQuery = ref('')
const tagDraft = ref('')
const tagInputOpen = ref(false)
const tagInput = ref<HTMLInputElement | null>(null)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordSaving = ref(false)
const logoutSaving = ref(false)
const maxTags = 5
let lockTimer: ReturnType<typeof window.setInterval> | null = null

const isLocked = computed(() => Boolean(session.user.value && !session.vaultKey.value))
const selectedNote = notesStore.selectedNote
const filteredNotes = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return notesStore.notes.value
  return notesStore.notes.value.filter((note) => {
    const titleMatch = note.title.toLowerCase().includes(query)
    const tagMatch = note.tags.some((tag) => tag.toLowerCase().includes(query))
    return titleMatch || tagMatch
  })
})

function closeAccountMenuOnOutsideClick(event: PointerEvent) {
  if (!accountMenuOpen.value) return
  const target = event.target as HTMLElement | null
  if (target?.closest('.account-block')) return
  accountMenuOpen.value = false
}

onMounted(async () => {
  await session.refresh()
  const events = ['pointerdown', 'keydown', 'input', 'scroll', 'touchstart']
  events.forEach((eventName) => window.addEventListener(eventName, vault.touch, { passive: true }))
  window.addEventListener('pointerdown', closeAccountMenuOnOutsideClick)
  lockTimer = window.setInterval(() => {
    if (!vault.key.value) return
    if (Date.now() - vault.lastActivityAt.value > 10 * 60 * 1000) {
      vault.lock()
    }
  }, 15 * 1000)
})

onBeforeUnmount(() => {
  const events = ['pointerdown', 'keydown', 'input', 'scroll', 'touchstart']
  events.forEach((eventName) => window.removeEventListener(eventName, vault.touch))
  window.removeEventListener('pointerdown', closeAccountMenuOnOutsideClick)
  if (lockTimer) window.clearInterval(lockTimer)
})

async function loadNotesAndMigrateIfNeeded(password: string) {
  await notesStore.fetchNotes()
  if (session.vaultMode.value !== 'legacy' || !session.user.value) return
  await vault.generateVaultKey()
  await notesStore.reencryptAllNotes()
  await session.saveWrappedVaultKey(password)
}

async function submitAuth() {
  authError.value = ''
  try {
    if (mode.value === 'login') {
      await session.login(account.value, password.value)
      if (session.vaultKey.value) await loadNotesAndMigrateIfNeeded(password.value)
    } else {
      await session.register(account.value, password.value, displayName.value)
    }
    password.value = ''
  } catch (error: any) {
    authError.value = error?.statusMessage || error?.message || 'Authentication failed.'
  }
}

async function unlockVault() {
  authError.value = ''
  try {
    await session.unlock(unlockPassword.value)
    await loadNotesAndMigrateIfNeeded(unlockPassword.value)
    unlockPassword.value = ''
  } catch {
    authError.value = 'Password did not unlock this vault.'
  }
}

async function saveSelected() {
  if (!selectedNote.value) return
  vault.touch()
  saveState.value = 'saving'
  await notesStore.saveNote(selectedNote.value)
  saveState.value = 'saved'
  window.setTimeout(() => { saveState.value = 'idle' }, 1200)
}

async function changePassword() {
  passwordError.value = ''
  passwordNotice.value = ''
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'New passwords do not match.'
    return
  }
  if (newPassword.value.length < 8) {
    passwordError.value = 'New password must be at least 8 characters.'
    return
  }
  passwordSaving.value = true
  try {
    await session.verifyCurrentPassword(currentPassword.value)
    if (session.vaultMode.value === 'legacy') {
      await vault.generateVaultKey()
      await notesStore.reencryptAllNotes()
      await session.saveWrappedVaultKey(currentPassword.value)
    }
    await session.updatePassword(currentPassword.value, newPassword.value)
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    passwordNotice.value = 'Password updated. Vault key was re-wrapped.'
  } catch (error: any) {
    passwordError.value = error?.statusMessage || error?.message || 'Could not update password.'
  } finally {
    passwordSaving.value = false
  }
}

function openChangePassword() {
  accountMenuOpen.value = false
  passwordError.value = ''
  passwordNotice.value = ''
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  showChangePasswordModal.value = true
}

function requestLogout() {
  accountMenuOpen.value = false
  showLogoutConfirm.value = true
}

async function confirmLogout() {
  logoutSaving.value = true
  try {
    await session.logout()
    showLogoutConfirm.value = false
  } finally {
    logoutSaving.value = false
  }
}

function markDirty() {
  vault.touch()
  if (selectedNote.value) selectedNote.value.isDirty = true
}

function setVisibility(visibility: 'private' | 'public') {
  if (!selectedNote.value || selectedNote.value.visibility === visibility) return
  if (visibility === 'public') {
    showPublicConfirm.value = true
    return
  }
  selectedNote.value.visibility = 'private'
  markDirty()
}

function confirmPublicVisibility() {
  if (!selectedNote.value) return
  selectedNote.value.visibility = 'public'
  showPublicConfirm.value = false
  markDirty()
}

async function createNote() {
  vault.touch()
  await notesStore.createNote()
  showList.value = false
}

function openTagInput() {
  if (!selectedNote.value || selectedNote.value.tags.length >= maxTags) return
  tagInputOpen.value = true
  nextTick(() => tagInput.value?.focus())
}

function addTag() {
  if (!selectedNote.value) return
  const value = tagDraft.value.trim()
  if (!value || selectedNote.value.tags.length >= maxTags) return
  if (!selectedNote.value.tags.some((tag) => tag.toLowerCase() === value.toLowerCase())) {
    selectedNote.value.tags = [...selectedNote.value.tags, value]
    markDirty()
  }
  tagDraft.value = ''
  tagInputOpen.value = selectedNote.value.tags.length < maxTags
}

function closeTagInput() {
  tagDraft.value = ''
  tagInputOpen.value = false
}

function removeTag(tagToRemove: string) {
  if (!selectedNote.value) return
  selectedNote.value.tags = selectedNote.value.tags.filter((tag) => tag !== tagToRemove)
  markDirty()
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function initials(value?: string) {
  const source = (value || '').trim()
  if (!source) return 'I'
  return source.split(/[\s_-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}
</script>

<template>
  <section v-if="!session.user.value" class="auth-screen">
    <div class="brand-panel">
      <div class="app-icon">I</div>
      <h1>Inkpad</h1>
      <p>加密备忘录，简洁好用。</p>
    </div>

    <form class="auth-card glass" @submit.prevent="submitAuth">
      <div class="segmented">
        <button type="button" :class="{ active: mode === 'login' }" @click="mode = 'login'">登录</button>
        <button type="button" :class="{ active: mode === 'register' }" @click="mode = 'register'">注册</button>
      </div>
      <label v-if="mode === 'register'">
        昵称
        <input v-model="displayName" autocomplete="name" placeholder="请输入昵称">
      </label>
      <label>
        账号
        <input v-model="account" autocomplete="username" placeholder="请输入账号" minlength="3" maxlength="40" required>
      </label>
      <label>
        密码
        <input v-model="password" type="password" autocomplete="current-password" placeholder="请输入密码" minlength="8" required>
      </label>
      <p v-if="authError" class="error">{{ authError }}</p>
      <button class="primary-button" type="submit">{{ mode === 'login' ? '登录' : '注册' }}</button>
    </form>
  </section>

  <section v-else-if="isLocked" class="auth-screen">
    <div class="brand-panel">
      <div class="app-icon">I</div>
      <h1>已锁定</h1>
      <p>当前备忘录已锁定。</p>
    </div>
    <form class="auth-card glass" @submit.prevent="unlockVault">
      <label>
        密码
        <input v-model="unlockPassword" type="password" autocomplete="current-password" required>
      </label>
      <p v-if="authError" class="error">{{ authError }}</p>
      <button class="primary-button" type="submit">解锁</button>
      <button class="ghost-button" type="button" @click="requestLogout">退出</button>
    </form>
  </section>

  <section v-else class="notes-app">
    <aside class="sidebar glass" :class="{ open: showList }">
      <header class="sidebar-head">
        <div>
          <strong>备忘录</strong>
          <span>{{ filteredNotes.length }} / {{ notesStore.notes.value.length }} 条</span>
        </div>
        <button class="icon-button" title="新建" @click="createNote">
          <Plus aria-hidden="true" />
        </button>
      </header>
      <section class="new-note-panel">
        <label class="note-search">
          <span>筛选</span>
          <input v-model="searchQuery" placeholder="搜索标题或关键字">
        </label>
        <NuxtLink class="public-link" to="/public">
          <Globe2 aria-hidden="true" />
          <span>公开备忘录</span>
        </NuxtLink>
      </section>
      <div class="note-list">
        <button
          v-for="note in filteredNotes"
          :key="note.id"
          class="note-row"
          :class="{ active: note.id === notesStore.selectedId.value }"
          @click="notesStore.selectedId.value = note.id; showList = false"
        >
          <strong>{{ note.title || '无标题' }}</strong>
          <span class="note-meta">
            <span>{{ formatDate(note.updatedAt) }}</span>
            <span v-if="note.visibility === 'public'" class="visibility-pill">Public</span>
            <span v-for="tag in note.tags.slice(0, 2)" :key="tag" class="tag-pill">{{ tag }}</span>
            <span v-if="note.tags.length > 2" class="tag-pill muted">+{{ note.tags.length - 2 }}</span>
          </span>
        </button>
        <p v-if="!filteredNotes.length" class="empty-hint">{{ notesStore.notes.value.length ? '没有匹配的备忘录' : '暂无备忘录' }}</p>
      </div>
      <footer class="sidebar-footer">
        <div class="account-block sidebar-account">
          <button class="sidebar-account-button" type="button" :aria-expanded="accountMenuOpen" title="账号" @click="accountMenuOpen = !accountMenuOpen">
            <span class="avatar">{{ initials(session.user.value.displayName || session.user.value.account) }}</span>
            <span class="account-name">{{ session.user.value.displayName || session.user.value.account }}</span>
          </button>
          <div v-if="accountMenuOpen" class="account-menu" role="menu">
            <button type="button" role="menuitem" @click="openChangePassword">
              <KeyRound aria-hidden="true" />
              <span>修改密码</span>
            </button>
            <NuxtLink v-if="session.user.value.role === 'admin'" to="/admin" role="menuitem" @click="accountMenuOpen = false">
              <ShieldCheck aria-hidden="true" />
              <span>管理后台</span>
            </NuxtLink>
            <button type="button" class="danger-item" role="menuitem" @click="requestLogout">
              <LogOut aria-hidden="true" />
              <span>退出登录</span>
            </button>
          </div>
        </div>
      </footer>
    </aside>

    <article class="editor glass">
      <header class="editor-toolbar">
        <button class="mobile-list" type="button" @click="showList = true">备忘录</button>
        <div class="toolbar-spacer" />
        <span class="save-indicator">{{ saveState === 'saving' ? '保存中...' : saveState === 'saved' ? '已保存' : selectedNote?.isDirty ? '未保存' : '' }}</span>
        <button v-if="selectedNote" class="ghost-button" type="button" @click="notesStore.deleteNote(selectedNote.id)">
          <Trash2 aria-hidden="true" />
          <span>删除</span>
        </button>
        <button v-if="selectedNote" class="primary-button small" type="button" @click="saveSelected">
          <Save aria-hidden="true" />
          <span>保存</span>
        </button>
      </header>

      <div v-if="selectedNote" class="editor-body">
        <section class="visibility-editor" aria-label="Choose visibility">
          <div>
            <strong>Choose visibility</strong>
            <span>{{ selectedNote.visibility === 'public' ? 'Everyone can read this note.' : 'Only you can read this note.' }}</span>
          </div>
          <div class="visibility-options" role="group" aria-label="Note visibility">
            <button type="button" :class="{ active: selectedNote.visibility === 'private' }" @click="setVisibility('private')">
              <LockKeyhole aria-hidden="true" />
              <span>Private</span>
            </button>
            <button type="button" :class="{ active: selectedNote.visibility === 'public' }" @click="setVisibility('public')">
              <Globe2 aria-hidden="true" />
              <span>Public</span>
            </button>
          </div>
        </section>
        <div class="tag-editor" aria-label="关键字标签">
          <span v-for="tag in selectedNote.tags" :key="tag" class="editable-tag">
            {{ tag }}
            <button type="button" :title="`删除 ${tag}`" @click="removeTag(tag)">
              <X aria-hidden="true" />
            </button>
          </span>
          <input
            v-if="tagInputOpen"
            ref="tagInput"
            v-model="tagDraft"
            class="tag-input"
            maxlength="20"
            placeholder="关键字"
            @keydown.enter.prevent="addTag"
            @keydown.esc.prevent="closeTagInput"
            @blur="tagDraft.trim() ? addTag() : closeTagInput()"
          >
          <button v-else-if="selectedNote.tags.length < maxTags" class="new-tag-button" type="button" @click="openTagInput">+ New Tag</button>
        </div>
        <input v-model="selectedNote.title" class="title-input" placeholder="无标题" @input="markDirty">
        <textarea v-model="selectedNote.body" class="body-input" placeholder="开始记录..." @input="markDirty" />
      </div>
      <div v-else class="empty-state">
        <h2>未选择备忘录</h2>
        <button class="primary-button" type="button" @click="createNote">新建</button>
      </div>
    </article>
  </section>

  <AppModal
    :open="showChangePasswordModal"
    title="修改密码"
    description="更新用于解锁备忘录的登录密码。"
    @close="showChangePasswordModal = false"
  >
    <form class="modal-form" @submit.prevent="changePassword">
      <label>
        当前密码
        <input v-model="currentPassword" type="password" autocomplete="current-password" required>
      </label>
      <label>
        新密码
        <input v-model="newPassword" type="password" autocomplete="new-password" minlength="8" required>
      </label>
      <label>
        确认密码
        <input v-model="confirmPassword" type="password" autocomplete="new-password" minlength="8" required>
      </label>
      <p v-if="passwordError" class="error">{{ passwordError }}</p>
      <p v-if="passwordNotice" class="notice">{{ passwordNotice }}</p>
      <div class="modal-actions">
        <button class="ghost-button" type="button" :disabled="passwordSaving" @click="showChangePasswordModal = false">取消</button>
        <button class="primary-button" type="submit" :disabled="passwordSaving">{{ passwordSaving ? '保存中...' : '保存' }}</button>
      </div>
    </form>
  </AppModal>

  <ConfirmDialog
    :open="showLogoutConfirm"
    title="退出？"
    message="是否确认退出"
    confirm-text="退出"
    :danger="true"
    :loading="logoutSaving"
    @close="showLogoutConfirm = false"
    @confirm="confirmLogout"
  />

  <ConfirmDialog
    :open="showPublicConfirm"
    title="公开这条备忘录？"
    message="公开后，所有人都可以读取这条备忘录的标题和正文。切回私有会停止公开访问，但不能撤回别人已经看到或复制的内容。"
    confirm-text="公开"
    @close="showPublicConfirm = false"
    @confirm="confirmPublicVisibility"
  />

</template>
