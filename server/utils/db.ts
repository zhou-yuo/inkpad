import type { H3Event } from 'h3'
import { createError } from 'h3'

export type D1DatabaseLike = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => D1PreparedStatementLike
    first: <T = unknown>() => Promise<T | null>
    all: <T = unknown>() => Promise<{ results: T[] }>
    run: () => Promise<unknown>
  }
}

type D1PreparedStatementLike = {
  first: <T = unknown>() => Promise<T | null>
  all: <T = unknown>() => Promise<{ results: T[] }>
  run: () => Promise<unknown>
}

export function getDb(event: H3Event) {
  const cloudflare = event.context.cloudflare as { env?: { DB?: D1DatabaseLike } } | undefined
  const db = cloudflare?.env?.DB
  if (!db) {
    throw createError({
      statusCode: 500,
      statusMessage: 'D1 binding DB is not configured. Use wrangler pages dev or bind DB in Cloudflare Pages.',
    })
  }
  return db
}

export function nowIso() {
  return new Date().toISOString()
}
