import type { H3Event } from 'h3'
import { createError, deleteCookie, getCookie, setCookie } from 'h3'
import { getDb, nowIso } from './db'
import { hashPassword, randomId, randomBase64, constantTimeEqual } from './crypto'

export type UserRow = {
  id: string
  email: string
  username: string
  account: string | null
  display_name: string
  password_salt: string
  password_hash: string
  encryption_salt: string
  encrypted_vault_key: string | null
  vault_key_iv: string | null
  role: 'admin' | 'user'
  created_at: string
  updated_at: string
}

export type PublicUser = {
  id: string
  account: string
  encryptionIdentity: string
  displayName: string
  role: 'admin' | 'user'
  encryptionSalt: string
  encryptedVaultKey: string | null
  vaultKeyIv: string | null
}

const sessionCookie = 'inkpad_session'
const thirtyDays = 60 * 60 * 24 * 30

function userAccount(user: UserRow) {
  return user.account || user.username
}

export function publicUser(user: UserRow): PublicUser {
  const account = userAccount(user)
  return {
    id: user.id,
    account,
    encryptionIdentity: user.email.endsWith('@inkpad.local') ? account : user.email,
    displayName: user.display_name,
    role: user.role,
    encryptionSalt: user.encryption_salt,
    encryptedVaultKey: user.encrypted_vault_key,
    vaultKeyIv: user.vault_key_iv,
  }
}

export async function createSession(event: H3Event, userId: string) {
  const db = getDb(event)
  const createdAt = nowIso()
  const expiresAt = new Date(Date.now() + thirtyDays * 1000).toISOString()
  const id = randomId('sess_')
  await db.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, userId, expiresAt, createdAt)
    .run()
  setCookie(event, sessionCookie, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: thirtyDays,
  })
}

export async function destroySession(event: H3Event) {
  const sessionId = getCookie(event, sessionCookie)
  if (sessionId) {
    await getDb(event).prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run()
  }
  deleteCookie(event, sessionCookie, { path: '/' })
}

export async function getCurrentUser(event: H3Event) {
  const sessionId = getCookie(event, sessionCookie)
  if (!sessionId) return null
  const db = getDb(event)
  const user = await db.prepare(`
    SELECT users.*
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = ? AND sessions.expires_at > ?
  `).bind(sessionId, nowIso()).first<UserRow>()
  return user
}

export async function requireUser(event: H3Event) {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Please sign in.' })
  }
  return user
}

export async function requireAdmin(event: H3Event) {
  const user = await requireUser(event)
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin access required.' })
  }
  return user
}

function normalizeAccount(account: string) {
  return account.trim().toLowerCase()
}

export async function createUser(event: H3Event, account: string, password: string, displayName: string) {
  const db = getDb(event)
  const normalizedAccount = normalizeAccount(account)
  if (!/^[a-z0-9_]{3,40}$/.test(normalizedAccount)) {
    throw createError({ statusCode: 400, statusMessage: 'Account can only contain letters, numbers, and underscores.' })
  }
  const existing = await db.prepare('SELECT id FROM users WHERE account = ? OR username = ?').bind(normalizedAccount, normalizedAccount).first<{ id: string }>()
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'This account is already registered.' })
  }

  const total = await db.prepare('SELECT COUNT(*) AS count FROM users').first<{ count: number }>()
  const passwordSalt = randomBase64()
  const createdAt = nowIso()
  const user: UserRow = {
    id: randomId('usr_'),
    email: `${normalizedAccount}@inkpad.local`,
    username: normalizedAccount,
    account: normalizedAccount,
    display_name: displayName.trim() || normalizedAccount || 'Inkpad User',
    password_salt: passwordSalt,
    password_hash: await hashPassword(password, passwordSalt),
    encryption_salt: randomBase64(),
    encrypted_vault_key: null,
    vault_key_iv: null,
    role: total?.count ? 'user' : 'admin',
    created_at: createdAt,
    updated_at: createdAt,
  }

  await db.prepare(`
    INSERT INTO users (id, email, username, account, display_name, password_salt, password_hash, encryption_salt, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(user.id, user.email, user.username, user.account, user.display_name, user.password_salt, user.password_hash, user.encryption_salt, user.role, user.created_at, user.updated_at).run()

  return user
}

export async function verifyUser(event: H3Event, account: string, password: string) {
  const db = getDb(event)
  const normalizedAccount = normalizeAccount(account)
  const user = await db.prepare('SELECT * FROM users WHERE account = ? OR username = ?').bind(normalizedAccount, normalizedAccount).first<UserRow>()
  if (!user) return null
  const hash = await hashPassword(password, user.password_salt)
  return constantTimeEqual(hash, user.password_hash) ? user : null
}

export async function verifyPassword(user: UserRow, password: string) {
  const hash = await hashPassword(password, user.password_salt)
  return constantTimeEqual(hash, user.password_hash)
}

export async function updateUserPassword(event: H3Event, userId: string, password: string) {
  const passwordSalt = randomBase64()
  await getDb(event).prepare('UPDATE users SET password_salt = ?, password_hash = ?, updated_at = ? WHERE id = ?')
    .bind(passwordSalt, await hashPassword(password, passwordSalt), nowIso(), userId)
    .run()
}

export async function updateUserPasswordAndVaultKey(
  event: H3Event,
  userId: string,
  password: string,
  encryptedVaultKey: string,
  vaultKeyIv: string,
) {
  const passwordSalt = randomBase64()
  await getDb(event).prepare(`
    UPDATE users
    SET password_salt = ?, password_hash = ?, encrypted_vault_key = ?, vault_key_iv = ?, updated_at = ?
    WHERE id = ?
  `).bind(passwordSalt, await hashPassword(password, passwordSalt), encryptedVaultKey, vaultKeyIv, nowIso(), userId).run()
}
