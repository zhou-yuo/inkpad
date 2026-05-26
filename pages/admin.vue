<script setup lang="ts">
const session = useSession()
const users = ref<any[]>([])
const notes = ref<any[]>([])
const error = ref('')
const resetPasswords = ref<Record<string, string>>({})
const resetState = ref<Record<string, string>>({})
const resetConfirmOpen = ref(false)
const pendingResetUser = ref<any | null>(null)
const resetSaving = ref(false)

onMounted(async () => {
  const user = await session.refresh()
  if (!user) return navigateTo('/')
  if (user.role !== 'admin') {
    error.value = 'Admin access required.'
    return
  }
  const [userResponse, noteResponse] = await Promise.all([
    $fetch<{ users: any[] }>('/api/admin/users'),
    $fetch<{ notes: any[] }>('/api/admin/notes'),
  ])
  users.value = userResponse.users
  notes.value = noteResponse.notes
})

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function initials(value?: string) {
  const source = (value || '').trim()
  if (!source) return 'I'
  return source.split(/[\s_-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

function requestResetPassword(user: any) {
  const newPassword = resetPasswords.value[user.id] || ''
  if (newPassword.length < 8) {
    resetState.value[user.id] = 'Use at least 8 characters.'
    return
  }
  pendingResetUser.value = user
  resetConfirmOpen.value = true
}

async function confirmResetPassword() {
  const user = pendingResetUser.value
  if (!user) return
  const newPassword = resetPasswords.value[user.id] || ''
  resetState.value[user.id] = 'Saving...'
  resetSaving.value = true
  try {
    await $fetch(`/api/admin/users/${user.id}/password`, {
      method: 'PUT',
      body: { newPassword },
    })
    resetPasswords.value[user.id] = ''
    resetState.value[user.id] = 'Password reset.'
    resetConfirmOpen.value = false
    pendingResetUser.value = null
  } catch (error: any) {
    resetState.value[user.id] = error?.statusMessage || error?.message || 'Reset failed.'
  } finally {
    resetSaving.value = false
  }
}
</script>

<template>
  <section class="admin-screen">
    <header class="admin-top">
      <div>
        <h1>Admin</h1>
        <p>User and encrypted note oversight.</p>
      </div>
      <NuxtLink class="ghost-button" to="/">Back to Notes</NuxtLink>
    </header>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-else class="admin-grid">
      <section class="admin-panel glass">
        <h2>Users</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Role</th>
                <th>Notes</th>
                <th>Joined</th>
                <th>Password</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in users" :key="user.id">
                <td>
                  <div class="user-cell">
                    <span class="avatar small-avatar">{{ initials(user.displayName || user.account) }}</span>
                    <span>
                      <strong>{{ user.displayName || user.account }}</strong>
                      <small>{{ user.account }}</small>
                    </span>
                  </div>
                </td>
                <td>{{ user.role }}</td>
                <td>{{ user.noteCount }}</td>
                <td>{{ formatDate(user.createdAt) }}</td>
                <td>
                  <form class="reset-form" @submit.prevent="requestResetPassword(user)">
                    <input v-model="resetPasswords[user.id]" type="password" autocomplete="new-password" minlength="8" placeholder="New password">
                    <button class="ghost-button" type="submit">Reset</button>
                    <small v-if="resetState[user.id]">{{ resetState[user.id] }}</small>
                  </form>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="admin-panel glass">
        <h2>Encrypted Notes</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Owner</th>
                <th>Bytes</th>
                <th>Updated</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="note in notes" :key="note.id">
                <td>{{ note.id.slice(0, 14) }}</td>
                <td>{{ note.account }}</td>
                <td>{{ note.encryptedSize }}</td>
                <td>{{ formatDate(note.updatedAt) }}</td>
                <td>{{ note.deletedAt ? 'Deleted' : 'Active' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <ConfirmDialog
      :open="resetConfirmOpen"
      title="Reset Password?"
      :message="`This changes ${pendingResetUser?.account || 'this user'}'s login password only. It cannot unlock or re-wrap their encrypted vault.`"
      confirm-text="Reset Password"
      :danger="true"
      :loading="resetSaving"
      @close="resetConfirmOpen = false"
      @confirm="confirmResetPassword"
    />
  </section>
</template>
