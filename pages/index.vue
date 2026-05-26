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
const activeNav = ref<'notes' | 'categories'>('notes')
const accountMenuOpen = ref(false)
const showChangePasswordModal = ref(false)
const showLogoutConfirm = ref(false)
const categoryFilter = ref<'all' | 'uncategorized' | string>('all')
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
const uncategorizedCount = computed(() => notesStore.notes.value.filter((note) => !note.categoryId).length)
const filteredNotes = computed(() => {
  if (categoryFilter.value === 'all') return notesStore.notes.value
  if (categoryFilter.value === 'uncategorized') return notesStore.notes.value.filter((note) => !note.categoryId)
  return notesStore.notes.value.filter((note) => note.categoryId === categoryFilter.value)
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

function categoryNoteCount(categoryId: string) {
  return notesStore.notes.value.filter((note) => note.categoryId === categoryId).length
}

function openCategoryNotes(filter: 'uncategorized' | string) {
  categoryFilter.value = filter
  activeNav.value = 'notes'
  showList.value = true
}

async function createNoteWithCategory() {
  vault.touch()
  await notesStore.createNote(categoryFilter.value === 'all' || categoryFilter.value === 'uncategorized' ? null : categoryFilter.value)
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

function selectNav(view: 'notes' | 'categories') {
  activeNav.value = view
  showList.value = true
}

async function confirmDeleteCategory() {
  if (!categoryToDelete.value) return
  categorySaving.value = true
  try {
    await notesStore.deleteCategory(categoryToDelete.value.id)
    if (categoryFilter.value === categoryToDelete.value.id) categoryFilter.value = 'all'
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
      <p>加密备忘录，简洁好用。</p>
    </div>

    <form class="auth-card glass" @submit.prevent="submitAuth">
      <div class="segmented">
        <button type="button" :class="{ active: mode === 'login' }" @click="mode = 'login'">登录</button>
        <button type="button" :class="{ active: mode === 'register' }" @click="mode = 'register'">注册</button>
      </div>
      <label v-if="mode === 'register'">
        昵称
        <input v-model="displayName" autocomplete="name" placeholder="Yu Zhou">
      </label>
      <label>
        账号
        <input v-model="account" autocomplete="username" placeholder="inkpad_account" minlength="3" maxlength="40" required>
      </label>
      <label>
        密码
        <input v-model="password" type="password" autocomplete="current-password" minlength="8" required>
      </label>
      <p v-if="authError" class="error">{{ authError }}</p>
      <button class="primary-button" type="submit">{{ mode === 'login' ? '登录' : '注册' }}</button>
    </form>
  </section>

  <section v-else-if="isLocked" class="auth-screen">
    <div class="brand-panel">
      <div class="app-icon">I</div>
      <h1>已锁定</h1>
      <p>刷新后需要重新解锁密钥。</p>
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
    <nav class="nav-rail glass" aria-label="Workspace">
      <div class="account-block rail-account">
        <button class="rail-avatar-button" type="button" :aria-expanded="accountMenuOpen" title="账号" @click="accountMenuOpen = !accountMenuOpen">
          <span class="avatar">{{ initials(session.user.value.displayName || session.user.value.account) }}</span>
        </button>
        <div v-if="accountMenuOpen" class="account-menu rail-menu" role="menu">
          <button type="button" role="menuitem" @click="openChangePassword">改密码</button>
          <NuxtLink v-if="session.user.value.role === 'admin'" to="/admin" role="menuitem" @click="accountMenuOpen = false">后台</NuxtLink>
          <button type="button" class="danger-item" role="menuitem" @click="requestLogout">退出</button>
        </div>
      </div>
      <div class="rail-menu-list">
        <button class="rail-item" :class="{ active: activeNav === 'notes' }" type="button" title="备忘录" @click="selectNav('notes')">
          <span aria-hidden="true">N</span>
          <small>备忘录</small>
        </button>
        <button class="rail-item" :class="{ active: activeNav === 'categories' }" type="button" title="分类" @click="selectNav('categories')">
          <span aria-hidden="true">C</span>
          <small>分类</small>
        </button>
      </div>
    </nav>

    <aside class="sidebar glass" :class="{ open: showList }">
      <header class="sidebar-head">
        <div>
          <strong>{{ activeNav === 'notes' ? '备忘录' : '分类' }}</strong>
          <span>{{ activeNav === 'notes' ? `${filteredNotes.length} / ${notesStore.notes.value.length} 条` : `${notesStore.categories.value.length} 个` }}</span>
        </div>
        <button v-if="activeNav === 'notes'" class="icon-button" title="新建" @click="createNoteWithCategory">+</button>
      </header>
      <section v-if="activeNav === 'notes'" class="new-note-panel">
        <div class="new-note-category">
          <span>筛选</span>
          <select v-model="categoryFilter">
            <option value="all">全部分类</option>
            <option value="uncategorized">未分类</option>
            <option v-for="category in notesStore.categories.value" :key="category.id" :value="category.id">{{ category.name }}</option>
          </select>
        </div>
      </section>
      <div v-if="activeNav === 'notes'" class="note-list">
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
            <span v-if="categoryName(note.categoryId)" class="category-pill">{{ categoryName(note.categoryId) }}</span>
          </span>
        </button>
        <p v-if="!filteredNotes.length" class="empty-hint">{{ notesStore.notes.value.length ? '当前分类暂无备忘录' : '暂无备忘录' }}</p>
      </div>
      <div v-else class="category-notes-list">
        <button class="category-summary-row" type="button" title="查看未分类备忘录" @click="openCategoryNotes('uncategorized')">
          <strong>未分类</strong>
          <span>{{ uncategorizedCount }}</span>
        </button>
        <button
          v-for="category in notesStore.categories.value"
          :key="category.id"
          class="category-summary-row"
          type="button"
          :title="`查看 ${category.name} 下的备忘录`"
          @click="openCategoryNotes(category.id)"
        >
          <strong>{{ category.name }}</strong>
          <span>{{ categoryNoteCount(category.id) }}</span>
        </button>
      </div>
    </aside>

    <article v-if="activeNav === 'notes'" class="editor glass">
      <header class="editor-toolbar">
        <button class="mobile-list" type="button" @click="showList = true">{{ activeNav === 'notes' ? '备忘录' : '分类' }}</button>
        <div class="toolbar-spacer" />
        <span class="save-indicator">{{ saveState === 'saving' ? '保存中...' : saveState === 'saved' ? '已保存' : selectedNote?.isDirty ? '未保存' : '' }}</span>
        <button v-if="selectedNote" class="ghost-button" type="button" @click="notesStore.deleteNote(selectedNote.id)">删除</button>
        <button v-if="selectedNote" class="primary-button small" type="button" @click="saveSelected">保存</button>
      </header>

      <div v-if="selectedNote" class="editor-body">
        <label class="category-select">
          分类
          <select v-model="selectedNote.categoryId" @change="markDirty">
            <option :value="null">无分类</option>
            <option v-for="category in notesStore.categories.value" :key="category.id" :value="category.id">{{ category.name }}</option>
          </select>
        </label>
        <input v-model="selectedNote.title" class="title-input" placeholder="无标题" @input="markDirty">
        <textarea v-model="selectedNote.body" class="body-input" placeholder="开始记录..." @input="markDirty" />
      </div>
      <div v-else class="empty-state">
        <h2>未选择备忘录</h2>
        <button class="primary-button" type="button" @click="createNoteWithCategory">新建</button>
      </div>
    </article>

    <article v-else class="editor category-workspace glass">
      <header class="editor-toolbar">
        <button class="mobile-list" type="button" @click="showList = true">分类</button>
        <div class="category-toolbar-title">
          <strong>分类管理</strong>
          <span>{{ notesStore.categories.value.length }} 个分类</span>
        </div>
      </header>

      <div class="category-admin">
        <form class="category-admin-form" @submit.prevent="addCategory">
          <input v-model="categoryDraft" maxlength="40" placeholder="新分类" :disabled="categorySaving">
          <button class="primary-button small" type="submit" :disabled="categorySaving || !categoryDraft.trim()">添加</button>
        </form>
        <p v-if="categoryError" class="error category-error">{{ categoryError }}</p>

        <div class="category-table" role="table" aria-label="分类管理">
          <div class="category-table-head" role="row">
            <span>分类</span>
            <span>备忘录</span>
            <span>操作</span>
          </div>
          <div class="category-admin-row readonly" role="row">
            <strong>未分类</strong>
            <span>{{ uncategorizedCount }}</span>
            <button class="ghost-button" type="button" @click="openCategoryNotes('uncategorized')">查看</button>
          </div>
          <div v-for="category in notesStore.categories.value" :key="category.id" class="category-admin-row" role="row">
            <form v-if="editingCategoryId === category.id" class="category-admin-edit" @submit.prevent="saveCategoryEdit(category.id)">
              <input v-model="editingCategoryName" maxlength="40" :disabled="categorySaving">
              <button class="ghost-button" type="submit" :disabled="categorySaving || !editingCategoryName.trim()">保存</button>
              <button class="ghost-button" type="button" :disabled="categorySaving" @click="cancelEditCategory">取消</button>
            </form>
            <template v-else>
              <strong>{{ category.name }}</strong>
              <span>{{ categoryNoteCount(category.id) }}</span>
              <div class="category-actions">
                <button class="ghost-button" type="button" @click="openCategoryNotes(category.id)">查看</button>
                <button class="mini-button" type="button" title="编辑分类" @click="startEditCategory(category)">改</button>
                <button class="mini-button danger-mini" type="button" title="删除分类" @click="requestDeleteCategory(category)">删</button>
              </div>
            </template>
          </div>
          <p v-if="!notesStore.categories.value.length" class="empty-hint">暂无分类，可以先添加一个。</p>
        </div>
      </div>
    </article>
  </section>

  <AppModal
    :open="showChangePasswordModal"
    title="改密码"
    description="更新登录密码，并重新保护密钥。"
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
    message="浏览器里的密钥会被清除，下次需要密码解锁。"
    confirm-text="退出"
    :danger="true"
    :loading="logoutSaving"
    @close="showLogoutConfirm = false"
    @confirm="confirmLogout"
  />

  <ConfirmDialog
    :open="showCategoryDeleteConfirm"
    title="删除分类？"
    :message="`${categoryToDelete?.name || '这个分类'} 下的备忘录会移到未分类。`"
    confirm-text="删除"
    :danger="true"
    :loading="categorySaving"
    @close="showCategoryDeleteConfirm = false"
    @confirm="confirmDeleteCategory"
  />
</template>
