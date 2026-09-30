import { normalizeName } from './normalize'
import type { CartItem, LearningMap, NameHistory } from './types'

export const QUICK_SLOT_LIMIT = 8

export function touchNameHistory(
  history: NameHistory,
  rawName: string,
  at: number = Date.now(),
): NameHistory {
  const name = normalizeName(rawName)
  if (!name) return history
  return {
    ...history,
    [name]: { name, lastUsedAt: at },
  }
}

export function touchNameHistoryMany(
  history: NameHistory,
  names: string[],
  at: number = Date.now(),
): NameHistory {
  let next = history
  names.forEach((name, index) => {
    next = touchNameHistory(next, name, at + index)
  })
  return next
}

/** 미완료 목록에 없는 최근 품명 상위 N개 */
export function getRecentQuickSlotNames(
  history: NameHistory,
  items: CartItem[],
  limit: number = QUICK_SLOT_LIMIT,
): string[] {
  const openNames = new Set(
    items
      .filter((item) => !item.done)
      .map((item) => normalizeName(item.name))
      .filter(Boolean),
  )

  return Object.values(history)
    .filter((entry) => !openNames.has(entry.name))
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt || a.name.localeCompare(b.name, 'ko'))
    .slice(0, limit)
    .map((entry) => entry.name)
}

/** 히스토리 비어 있을 때 품목·학습 키로 시드 */
export function seedNameHistoryIfEmpty(
  history: NameHistory,
  items: CartItem[],
  learningMap: LearningMap,
): NameHistory {
  if (Object.keys(history).length > 0) return history

  let next: NameHistory = {}
  const now = Date.now()

  for (const item of items) {
    const name = normalizeName(item.name)
    if (!name) continue
    const prev = next[name]
    const at = item.createdAt || now
    if (!prev || at >= prev.lastUsedAt) {
      next[name] = { name, lastUsedAt: at }
    }
  }

  for (const key of Object.keys(learningMap)) {
    const name = normalizeName(key)
    if (!name || next[name]) continue
    next[name] = { name, lastUsedAt: now }
  }

  return next
}
