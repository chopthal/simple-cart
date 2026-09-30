import { seedNameHistoryIfEmpty } from './history'
import { normalizeName } from './normalize'
import {
  DEFAULT_CHANNELS,
  INITIAL_DEFAULT_CHANNEL_ID,
  channelExists,
  sortedChannels,
  type AppState,
  type CartItem,
  type Channel,
  type FilterTab,
  type LearningMap,
  type NameHistory,
} from './types'

const STORAGE_KEY = 'smart-cart:v2'
const LEGACY_STORAGE_KEY = 'smart-cart:v1'

interface PersistedPayload {
  items: CartItem[]
  learningMap: LearningMap
  nameHistory: NameHistory
  channels: Channel[]
  defaultChannelId: string
  activeTab: FilterTab
}

function createDefaultState(): AppState {
  return {
    items: [],
    learningMap: {},
    nameHistory: {},
    channels: DEFAULT_CHANNELS.map((c) => ({ ...c })),
    defaultChannelId: INITIAL_DEFAULT_CHANNEL_ID,
    activeTab: 'all',
  }
}

function sanitizeChannel(raw: unknown): Channel | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || !o.id) return null
  if (typeof o.name !== 'string') return null
  if (typeof o.order !== 'number' || Number.isNaN(o.order)) return null
  return { id: o.id, name: o.name, order: o.order }
}

function sanitizeItem(raw: unknown, validIds: Set<string>, fallback: string): CartItem | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string') return null
  if (typeof o.name !== 'string') return null
  if (typeof o.channel !== 'string') return null
  if (typeof o.done !== 'boolean') return null
  if (typeof o.createdAt !== 'number') return null
  return {
    id: o.id,
    name: o.name,
    channel: validIds.has(o.channel) ? o.channel : fallback,
    done: o.done,
    createdAt: o.createdAt,
  }
}

function sanitizeNameHistory(raw: unknown): NameHistory {
  if (!raw || typeof raw !== 'object') return {}
  const next: NameHistory = {}
  for (const value of Object.values(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue
    const o = value as Record<string, unknown>
    if (typeof o.name !== 'string' || typeof o.lastUsedAt !== 'number') continue
    const name = normalizeName(o.name)
    if (!name) continue
    const prev = next[name]
    if (!prev || o.lastUsedAt >= prev.lastUsedAt) {
      next[name] = { name, lastUsedAt: o.lastUsedAt }
    }
  }
  return next
}

function normalizeLoadedState(partial: Partial<PersistedPayload>): AppState {
  const base = createDefaultState()
  let channels = Array.isArray(partial.channels)
    ? partial.channels.map(sanitizeChannel).filter((c): c is Channel => c !== null)
    : []

  if (channels.length === 0) {
    channels = base.channels
  }

  channels = sortedChannels(channels).map((c, index) => ({
    ...c,
    order: index,
  }))

  let defaultChannelId =
    typeof partial.defaultChannelId === 'string' &&
    channelExists(channels, partial.defaultChannelId)
      ? partial.defaultChannelId
      : channels.find((c) => c.id === INITIAL_DEFAULT_CHANNEL_ID)?.id ??
        channels[0]!.id

  const validIds = new Set(channels.map((c) => c.id))
  const items = Array.isArray(partial.items)
    ? partial.items
        .map((item) => sanitizeItem(item, validIds, defaultChannelId))
        .filter((x): x is CartItem => x !== null)
    : []

  const learningMap: LearningMap = {}
  if (partial.learningMap && typeof partial.learningMap === 'object') {
    for (const [key, value] of Object.entries(partial.learningMap)) {
      if (typeof value === 'string') {
        learningMap[key] = validIds.has(value) ? value : defaultChannelId
      }
    }
  }

  let activeTab: FilterTab = 'all'
  if (
    partial.activeTab === 'all' ||
    (typeof partial.activeTab === 'string' && validIds.has(partial.activeTab))
  ) {
    activeTab = partial.activeTab
  }

  const nameHistory = seedNameHistoryIfEmpty(
    sanitizeNameHistory(partial.nameHistory),
    items,
    learningMap,
  )

  return { items, learningMap, nameHistory, channels, defaultChannelId, activeTab }
}

function loadLegacyV1(): Partial<PersistedPayload> | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      items?: CartItem[]
      learningMap?: LearningMap
      activeTab?: FilterTab
    }
    return {
      items: parsed.items,
      learningMap: parsed.learningMap,
      activeTab: parsed.activeTab,
      channels: DEFAULT_CHANNELS.map((c) => ({ ...c })),
      defaultChannelId: INITIAL_DEFAULT_CHANNEL_ID,
      nameHistory: {},
    }
  } catch {
    return null
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedPayload>
      return normalizeLoadedState(parsed)
    }

    const legacy = loadLegacyV1()
    if (legacy) {
      const migrated = normalizeLoadedState(legacy)
      saveState(migrated)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      return migrated
    }

    return createDefaultState()
  } catch {
    return createDefaultState()
  }
}

export function saveState(state: AppState): void {
  const payload: PersistedPayload = {
    items: state.items,
    learningMap: state.learningMap,
    nameHistory: state.nameHistory,
    channels: state.channels,
    defaultChannelId: state.defaultChannelId,
    activeTab: state.activeTab,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}
