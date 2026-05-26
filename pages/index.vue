<script setup lang="ts">
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
const newNoteCategoryId = ref('')
const categoryDraft = ref('')
const editingCategoryId = ref<string | null>(null)
const editingCategoryName = ref('')
const categoryError = ref('')
const showCategoryDeleteConfirm = ref(false)
const categoryToDelete = ref<{ id: string, name: string } | null>(null)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordSaving = ref(false)
const logoutSaving = ref(false)
const categorySaving = ref(false)
let lockTimer: ReturnType<typeof window.setInterval> | null = null

const isLocked = computed(() => Boolean(session.user.value && !session.vaultKey.value))
const selectedNote = notesStore.selectedNote
const categoryById = computed(() => new Map(notesStore.categories.value.map((category) => [category.id, category])))

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
  await notesStore.fetchCategories()
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

function categoryName(categoryId?: string | null) {
  return categoryId ? categoryById.value.get(categoryId)?.name || '' : ''
}

async function createNoteWithCategory() {
  vault.touch()
  await notesStore.createNote(newNoteCategoryId.value || null)
  showList.value = false
}

async function addCategory() {
  categoryError.value = ''
  if (!categoryDraft.value.trim()) return
  categorySaving.value = true
  try {
    await notesStore.createCategory(categoryDraft.value)
    categoryDraft.value = ''
  } catch (error: any) {
    categoryError.value = error?.statusMessage || error?.message || 'Could not create category.'
  } finally {
    categorySaving.value = false
  }
}

function startEditCategory(category: { id: string, name: string }) {
  categoryError.value = ''
  editingCategoryId.value = category.id
  editingCategoryName.value = category.name
}

function cancelEditCategory() {
  editingCategoryId.value = null
  editingCategoryName.value = ''
}

async function saveCategoryEdit(categoryId: string) {
  categoryError.value = ''
  if (!editingCategoryName.value.trim()) return
  categorySaving.value = true
  try {
    await notesStore.updateCategory(categoryId, editingCategoryName.value)
    cancelEditCategory()
  } catch (error: any) {
    categoryError.value = error?.statusMessage || error?.message || 'Could not update category.'
  } finally {
    categorySaving.value = false
  }
}

function requestDeleteCategory(category: { id: string, name: string }) {
  categoryToDelete.value = category
  showCategoryDeleteConfirm.value = true
}

async function confirmDeleteCategory() {
  if (!categoryToDelete.value) return
  categorySaving.value = true
  try {
    await notesStore.deleteCategory(categoryToDelete.value.id)
    if (newNoteCategoryId.value === categoryToDelete.value.id) newNoteCategoryId.value = ''
    showCategoryDeleteConfirm.value = false
    categoryToDelete.value = null
  } catch (error: any) {
    categoryError.value = error?.statusMessage || error?.message || 'Could not delete category.'
  } finally {
    categorySaving.value = false
  }
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
      <p>Private notes with client-side encryption and a clean Apple Notes-style workspace.</p>
    </div>

    <form class="auth-card glass" @submit.prevent="submitAuth">
      <div class="segmented">
        <button type="button" :class="{ active: mode === 'login' }" @click="mode = 'login'">Login</button>
        <button type="button" :class="{ active: mode === 'register' }" @click="mode = 'register'">Register</button>
      </div>
      <label v-if="mode === 'register'">
        Name
        <input v-model="displayName" autocomplete="name" placeholder="Yu Zhou">
      </label>
      <label>
        Account
        <input v-model="account" autocomplete="username" placeholder="inkpad_account" minlength="3" maxlength="40" required>
      </label>
      <label>
        Password
        <input v-model="password" type="password" autocomplete="current-password" minlength="8" required>
      </label>
      <p v-if="authError" class="error">{{ authError }}</p>
      <button class="primary-button" type="submit">{{ mode === 'login' ? 'Login' : 'Create Account' }}</button>
    </form>
  </section>

  <section v-else-if="isLocked" class="auth-screen">
    <div class="brand-panel">
      <div class="app-icon">I</div>
      <h1>Vault Locked</h1>
      <p>Your session is active, but the browser encryption key is not kept after refresh.</p>
    </div>
    <form class="auth-card glass" @submit.prevent="unlockVault">
      <label>
        Password
        <input v-model="unlockPassword" type="password" autocomplete="current-password" required>
      </label>
      <p v-if="authError" class="error">{{ authError }}</p>
      <button class="primary-button" type="submit">Unlock Notes</button>
      <button class="ghost-button" type="button" @click="requestLogout">Logout</button>
    </form>
  </section>

  <section v-else class="notes-app">
    <aside class="sidebar glass" :class="{ open: showList }">
      <header class="sidebar-head">
        <div>
          <strong>Inkpad</strong>
          <span>{{ notesStore.notes.value.length }} notes</span>
        </div>
        <button class="icon-button" title="New note" @click="createNoteWithCategory">+</button>
      </header>
      <section class="category-manager">
        <div class="new-note-category">
          <span>New note</span>
          <select v-model="newNoteCategoryId">
            <option value="">No category</option>
            <option v-for="category in notesStore.categories.value" :key="category.id" :value="category.id">{{ category.name }}</option>
          </select>
        </div>
        <form class="category-form" @submit.prevent="addCategory">
          <input v-model="categoryDraft" maxlength="40" placeholder="New category" :disabled="categorySaving">
          <button class="ghost-button" type="submit" :disabled="categorySaving || !categoryDraft.trim()">Add</button>
        </form>
        <p v-if="categoryError" class="error category-error">{{ categoryError }}</p>
        <div v-if="notesStore.categories.value.length" class="category-list">
          <div v-for="category in notesStore.categories.value" :key="category.id" class="category-row">
            <form v-if="editingCategoryId === category.id" class="category-edit" @submit.prevent="saveCategoryEdit(category.id)">
              <input v-model="editingCategoryName" maxlength="40" :disabled="categorySaving">
              <button class="ghost-button" type="submit" :disabled="categorySaving || !editingCategoryName.trim()">Save</button>
              <button class="ghost-button" type="button" :disabled="categorySaving" @click="cancelEditCategory">Cancel</button>
            </form>
            <template v-else>
              <span class="category-pill">{{ category.name }}</span>
              <button class="mini-button" type="button" title="Edit category" @click="startEditCategory(category)">Edit</button>
              <button class="mini-button danger-mini" type="button" title="Delete category" @click="requestDeleteCategory(category)">Delete</button>
            </template>
          </div>
        </div>
      </section>
      <div class="note-list">
        <button
          v-for="note in notesStore.notes.value"
          :key="note.id"
          class="note-row"
          :class="{ active: note.id === notesStore.selectedId.value }"
          @click="notesStore.selectedId.value = note.id; showList = false"
        >
          <strong>{{ note.title || 'Untitled' }}</strong>
          <span class="note-meta">
            <span>{{ formatDate(note.updatedAt) }}</span>
            <span v-if="categoryName(note.categoryId)" class="category-pill">{{ categoryName(note.categoryId) }}</span>
          </span>
        </button>
      </div>
      <footer class="sidebar-foot">
        <div class="account-block">
          <button class="account-chip" type="button" :aria-expanded="accountMenuOpen" @click="accountMenuOpen = !accountMenuOpen">
            <span class="avatar">{{ initials(session.user.value.displayName || session.user.value.account) }}</span>
            <span>
              <strong>{{ session.user.value.displayName || session.user.value.account }}</strong>
              <small>{{ session.user.value.account }}</small>
            </span>
          </button>
          <div v-if="accountMenuOpen" class="account-menu" role="menu">
            <button type="button" role="menuitem" @click="openChangePassword">Change Password</button>
            <NuxtLink v-if="session.user.value.role === 'admin'" to="/admin" role="menuitem" @click="accountMenuOpen = false">Admin</NuxtLink>
            <button type="button" class="danger-item" role="menuitem" @click="requestLogout">Logout</button>
          </div>
        </div>
      </footer>
    </aside>

    <article class="editor glass">
      <header class="editor-toolbar">
        <button class="mobile-list" type="button" @click="showList = true">Notes</button>
        <div class="toolbar-spacer" />
        <span class="save-indicator">{{ saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : selectedNote?.isDirty ? 'Unsaved' : '' }}</span>
        <button v-if="selectedNote" class="ghost-button" type="button" @click="notesStore.deleteNote(selectedNote.id)">Delete</button>
        <button v-if="selectedNote" class="primary-button small" type="button" @click="saveSelected">Save</button>
      </header>

      <div v-if="selectedNote" class="editor-body">
        <label class="category-select">
          Category
          <select v-model="selectedNote.categoryId" @change="markDirty">
            <option :value="null">No category</option>
            <option v-for="category in notesStore.categories.value" :key="category.id" :value="category.id">{{ category.name }}</option>
          </select>
        </label>
        <input v-model="selectedNote.title" class="title-input" placeholder="Untitled" @input="markDirty">
        <textarea v-model="selectedNote.body" class="body-input" placeholder="Start typing..." @input="markDirty" />
      </div>
      <div v-else class="empty-state">
        <h2>No Note Selected</h2>
        <button class="primary-button" type="button" @click="createNoteWithCategory">Create Note</button>
      </div>
    </article>
  </section>

  <AppModal
    :open="showChangePasswordModal"
    title="Change Password"
    description="Update your login password and re-wrap the in-memory vault key for future unlocks."
    @close="showChangePasswordModal = false"
  >
    <form class="modal-form" @submit.prevent="changePassword">
      <label>
        Current
        <input v-model="currentPassword" type="password" autocomplete="current-password" required>
      </label>
      <label>
        New
        <input v-model="newPassword" type="password" autocomplete="new-password" minlength="8" required>
      </label>
      <label>
        Confirm
        <input v-model="confirmPassword" type="password" autocomplete="new-password" minlength="8" required>
      </label>
      <p v-if="passwordError" class="error">{{ passwordError }}</p>
      <p v-if="passwordNotice" class="notice">{{ passwordNotice }}</p>
      <div class="modal-actions">
        <button class="ghost-button" type="button" :disabled="passwordSaving" @click="showChangePasswordModal = false">Cancel</button>
        <button class="primary-button" type="submit" :disabled="passwordSaving">{{ passwordSaving ? 'Saving...' : 'Change Password' }}</button>
      </div>
    </form>
  </AppModal>

  <ConfirmDialog
    :open="showLogoutConfirm"
    title="Logout?"
    message="Your vault key will be cleared from this browser and you will need your password to unlock notes again."
    confirm-text="Logout"
    :danger="true"
    :loading="logoutSaving"
    @close="showLogoutConfirm = false"
    @confirm="confirmLogout"
  />

  <ConfirmDialog
    :open="showCategoryDeleteConfirm"
    title="Delete Category?"
    :message="`Notes in ${categoryToDelete?.name || 'this category'} will become uncategorized.`"
    confirm-text="Delete"
    :danger="true"
    :loading="categorySaving"
    @close="showCategoryDeleteConfirm = false"
    @confirm="confirmDeleteCategory"
  />
</template>
