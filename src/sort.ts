import type { CartItem, FilterTab } from './types'

/** 미구매 상단, 완료 하단. 그룹 내 createdAt 최신순. */
export function sortItems(items: CartItem[]): CartItem[] {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) {
      return a.done ? 1 : -1
    }
    return b.createdAt - a.createdAt
  })
}

export function filterByTab(items: CartItem[], tab: FilterTab): CartItem[] {
  if (tab === 'all') return items
  return items.filter((item) => item.channel === tab)
}

export function visibleItems(items: CartItem[], tab: FilterTab): CartItem[] {
  return sortItems(filterByTab(items, tab))
}
