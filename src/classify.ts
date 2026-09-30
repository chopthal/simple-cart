import { matchKeywordChannel } from './dictionary'
import { normalizeName } from './normalize'
import { channelExists, type Channel, type LearningMap } from './types'

const MIN_PARTIAL_KEY_LENGTH = 2

export function lookupLearningChannel(
  normalizedName: string,
  learningMap: LearningMap,
): string | null {
  if (Object.prototype.hasOwnProperty.call(learningMap, normalizedName)) {
    return learningMap[normalizedName]!
  }

  const candidates = Object.keys(learningMap).filter(
    (key) =>
      key.length >= MIN_PARTIAL_KEY_LENGTH && normalizedName.includes(key),
  )

  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length
    return a.localeCompare(b, 'ko')
  })

  return learningMap[candidates[0]!]!
}

/** 학습 → 사전 → defaultChannelId (존재하는 채널만) */
export function resolveChannel(
  rawName: string,
  learningMap: LearningMap,
  channels: Channel[],
  defaultChannelId: string,
): string {
  const normalized = normalizeName(rawName)
  const fallback = channelExists(channels, defaultChannelId)
    ? defaultChannelId
    : channels[0]?.id ?? defaultChannelId

  if (!normalized) return fallback

  const learned = lookupLearningChannel(normalized, learningMap)
  if (learned && channelExists(channels, learned)) return learned

  const fromDict = matchKeywordChannel(normalized)
  if (fromDict && channelExists(channels, fromDict)) return fromDict

  return fallback
}

export function upsertLearning(
  learningMap: LearningMap,
  rawName: string,
  channelId: string,
): LearningMap {
  const key = normalizeName(rawName)
  if (!key) return learningMap
  return { ...learningMap, [key]: channelId }
}

export function remapLearningChannels(
  learningMap: LearningMap,
  fromId: string,
  toId: string,
): LearningMap {
  const next: LearningMap = {}
  for (const [key, value] of Object.entries(learningMap)) {
    next[key] = value === fromId ? toId : value
  }
  return next
}
