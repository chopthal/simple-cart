import { normalizeName } from './normalize'
import {
  channelExists,
  sortedChannels,
  type AppState,
  type Channel,
} from './types'
import { remapLearningChannels } from './classify'

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `ch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function reindex(channels: Channel[]): Channel[] {
  return sortedChannels(channels).map((c, index) => ({ ...c, order: index }))
}

export function addChannel(state: AppState, rawName: string): AppState | null {
  const name = normalizeName(rawName)
  if (!name) return null

  const channel: Channel = {
    id: createId(),
    name,
    order: state.channels.length,
  }

  return {
    ...state,
    channels: reindex([...state.channels, channel]),
  }
}

export function renameChannel(
  state: AppState,
  id: string,
  rawName: string,
): AppState | null {
  const name = normalizeName(rawName)
  if (!name || !channelExists(state.channels, id)) return null

  return {
    ...state,
    channels: state.channels.map((c) => (c.id === id ? { ...c, name } : c)),
  }
}

export function setDefaultChannel(state: AppState, id: string): AppState | null {
  if (!channelExists(state.channels, id)) return null
  return { ...state, defaultChannelId: id }
}

export function moveChannel(
  state: AppState,
  id: string,
  direction: -1 | 1,
): AppState | null {
  const ordered = sortedChannels(state.channels)
  const index = ordered.findIndex((c) => c.id === id)
  if (index < 0) return null

  const swapWith = index + direction
  if (swapWith < 0 || swapWith >= ordered.length) return null

  const next = [...ordered]
  const tmp = next[index]!
  next[index] = next[swapWith]!
  next[swapWith] = tmp

  // 배열에서 스왑한 뒤 그 순서를 그대로 order에 기록한다.
  // sortedChannels(기존 order)로 다시 정렬하면 스왑이 취소된다.
  return {
    ...state,
    channels: next.map((channel, order) => ({ ...channel, order })),
  }
}

/**
 * 채널 삭제. 품목·학습은 새 기본 채널로 이동.
 * 마지막 1개면 null.
 */
export function deleteChannel(state: AppState, id: string): AppState | null {
  if (!channelExists(state.channels, id)) return null
  if (state.channels.length <= 1) return null

  const remaining = reindex(state.channels.filter((c) => c.id !== id))
  let defaultChannelId = state.defaultChannelId
  if (defaultChannelId === id) {
    defaultChannelId = remaining[0]!.id
  }

  const items = state.items.map((item) =>
    item.channel === id ? { ...item, channel: defaultChannelId } : item,
  )

  const learningMap = remapLearningChannels(
    state.learningMap,
    id,
    defaultChannelId,
  )

  const activeTab =
    state.activeTab === id ? ('all' as const) : state.activeTab

  return {
    ...state,
    channels: remaining,
    defaultChannelId,
    items,
    learningMap,
    activeTab,
  }
}
