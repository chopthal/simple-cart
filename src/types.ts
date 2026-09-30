export interface Channel {
  id: string
  name: string
  order: number
}

/** 필터 탭. 'all'은 채널이 아님. */
export type FilterTab = 'all' | string

export interface CartItem {
  id: string
  name: string
  channel: string
  done: boolean
  createdAt: number
}

export type LearningMap = Record<string, string>

export interface NameHistoryEntry {
  name: string
  lastUsedAt: number
}

/** 정규화 품명 → 히스토리 엔트리 */
export type NameHistory = Record<string, NameHistoryEntry>

export interface AppState {
  items: CartItem[]
  learningMap: LearningMap
  nameHistory: NameHistory
  channels: Channel[]
  defaultChannelId: string
  activeTab: FilterTab
}

export const DEFAULT_CHANNELS: Channel[] = [
  { id: 'daiso', name: '다이소', order: 0 },
  { id: 'mart', name: '마트', order: 1 },
  { id: 'coupang', name: '쿠팡', order: 2 },
]

export const INITIAL_DEFAULT_CHANNEL_ID = 'mart'

export function sortedChannels(channels: Channel[]): Channel[] {
  return [...channels].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ko'))
}

export function channelExists(channels: Channel[], id: string): boolean {
  return channels.some((c) => c.id === id)
}

export function getChannelName(channels: Channel[], id: string): string {
  return channels.find((c) => c.id === id)?.name ?? id
}
