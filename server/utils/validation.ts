import type { H3Event } from 'h3'
import { createError, readBody } from 'h3'

export async function readJsonBody<T extends Record<string, unknown>>(event: H3Event) {
  const body = await readBody<T>(event)
  return body || {} as T
}

export function requireString(value: unknown, name: string, min = 1, max = 10000) {
  if (typeof value !== 'string') {
    throw createError({ statusCode: 400, statusMessage: `${name} is required.` })
  }
  const trimmed = value.trim()
  if (trimmed.length < min || trimmed.length > max) {
    throw createError({ statusCode: 400, statusMessage: `${name} must be ${min}-${max} characters.` })
  }
  return value
}
