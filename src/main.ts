import {
  addChannel,
  deleteChannel,
  moveChannel,
  renameChannel,
  setDefaultChannel,
} from './channels'
import { resolveChannel, upsertLearning } from './classify'
import { getRecentQuickSlotNames, touchNameHistoryMany } from './history'
import { splitInputNames } from './normalize'
import { visibleItems } from './sort'
import { loadState, saveState } from './storage'
import {
  getChannelName,
  sortedChannels,
  type AppState,
  type CartItem,
  type FilterTab,
} from './types'
import './style.css'

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

let state: AppState = loadState()
let pickItemId: string | null = null

function persist(): void {
  saveState(state)
}

function refresh(): void {
  persist()
  renderTabs()
  renderList()
  renderQuickSlots()
  updateClearButton()
  renderManageSheet()
  renderPickSheet()
}

function addNames(raw: string): void {
  const names = splitInputNames(raw)
  if (names.length === 0) return

  const now = Date.now()
  const created: CartItem[] = names.map((name, offset) => ({
    id: createId(),
    name,
    channel: resolveChannel(
      name,
      state.learningMap,
      state.channels,
      state.defaultChannelId,
    ),
    done: false,
    createdAt: now + offset,
  }))

  state = {
    ...state,
    items: [...created, ...state.items],
    nameHistory: touchNameHistoryMany(state.nameHistory, names, now),
  }
  refresh()
}

function toggleDone(id: string): void {
  state = {
    ...state,
    items: state.items.map((item) =>
      item.id === id ? { ...item, done: !item.done } : item,
    ),
  }
  refresh()
}

function deleteItem(id: string): void {
  state = {
    ...state,
    items: state.items.filter((item) => item.id !== id),
  }
  refresh()
}

function assignChannel(itemId: string, channelId: string): void {
  const target = state.items.find((item) => item.id === itemId)
  if (!target) return

  state = {
    ...state,
    learningMap: upsertLearning(state.learningMap, target.name, channelId),
    items: state.items.map((item) =>
      item.id === itemId ? { ...item, channel: channelId } : item,
    ),
  }
  pickItemId = null
  closeSheet('pick-sheet')
  refresh()
}

function clearDone(): void {
  state = {
    ...state,
    items: state.items.filter((item) => !item.done),
  }
  refresh()
}

function setTab(tab: FilterTab): void {
  state = { ...state, activeTab: tab }
  refresh()
}

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <div class="shell">
    <header class="header">
      <h1 class="brand">심플 카트</h1>
      <p class="tagline">적고, 채널별로 보고, 체크</p>
    </header>

    <div class="quick-slots" id="quick-slots" hidden>
      <p class="quick-slots-label">최근 다시 담기</p>
      <div class="quick-slots-row" id="quick-slots-row" role="list"></div>
    </div>

    <form class="capture" id="capture-form" autocomplete="off">
      <input
        id="item-input"
        class="capture-input"
        type="text"
        enterkeyhint="done"
        placeholder="품목 입력 후 추가"
        aria-label="품목 입력"
      />
      <button type="submit" class="capture-submit" aria-label="추가">추가</button>
    </form>

    <div class="tabs-row">
      <nav class="tabs" id="tabs" role="tablist" aria-label="구매처 필터"></nav>
      <button type="button" class="tabs-manage" id="open-manage" aria-label="채널 관리">···</button>
    </div>

    <ul class="list" id="item-list" aria-live="polite"></ul>

    <p class="empty" id="empty-msg" hidden>적을 품목이 있으면 위에 바로 추가하세요.</p>

    <footer class="footer">
      <button type="button" class="clear-done" id="clear-done" disabled>
        완료 비우기
      </button>
    </footer>
  </div>

  <div class="sheet" id="manage-sheet" hidden>
    <button type="button" class="sheet-backdrop" data-close="manage-sheet" aria-label="닫기"></button>
    <div class="sheet-panel" role="dialog" aria-labelledby="manage-title">
      <div class="sheet-head">
        <h2 id="manage-title">채널 관리</h2>
        <button type="button" class="sheet-close" data-close="manage-sheet">닫기</button>
      </div>
      <ul class="manage-list" id="manage-list"></ul>
      <form class="manage-add" id="manage-add-form" autocomplete="off">
        <input id="manage-add-input" type="text" placeholder="새 채널 이름" enterkeyhint="done" />
        <button type="submit">추가</button>
      </form>
      <p class="manage-hint">「전체」는 필터라서 여기 없습니다. 기본 채널은 미분류 품목에 쓰입니다.</p>
    </div>
  </div>

  <div class="sheet" id="pick-sheet" hidden>
    <button type="button" class="sheet-backdrop" data-close="pick-sheet" aria-label="닫기"></button>
    <div class="sheet-panel" role="dialog" aria-labelledby="pick-title">
      <div class="sheet-head">
        <h2 id="pick-title">구매처 선택</h2>
        <button type="button" class="sheet-close" data-close="pick-sheet">닫기</button>
      </div>
      <ul class="pick-list" id="pick-list"></ul>
    </div>
  </div>
`

const form = document.querySelector<HTMLFormElement>('#capture-form')!
const input = document.querySelector<HTMLInputElement>('#item-input')!
const quickSlotsEl = document.querySelector<HTMLElement>('#quick-slots')!
const quickSlotsRow = document.querySelector<HTMLElement>('#quick-slots-row')!
const tabsEl = document.querySelector<HTMLElement>('#tabs')!
const listEl = document.querySelector<HTMLUListElement>('#item-list')!
const emptyEl = document.querySelector<HTMLParagraphElement>('#empty-msg')!
const clearBtn = document.querySelector<HTMLButtonElement>('#clear-done')!
const openManageBtn = document.querySelector<HTMLButtonElement>('#open-manage')!
const manageList = document.querySelector<HTMLUListElement>('#manage-list')!
const manageAddForm = document.querySelector<HTMLFormElement>('#manage-add-form')!
const manageAddInput = document.querySelector<HTMLInputElement>('#manage-add-input')!
const pickList = document.querySelector<HTMLUListElement>('#pick-list')!

function openSheet(id: 'manage-sheet' | 'pick-sheet'): void {
  document.getElementById(id)?.removeAttribute('hidden')
}

function closeSheet(id: 'manage-sheet' | 'pick-sheet'): void {
  document.getElementById(id)?.setAttribute('hidden', '')
  if (id === 'pick-sheet') pickItemId = null
}

function renderTabs(): void {
  const channels = sortedChannels(state.channels)
  const tabButtons = [
    `<button type="button" class="tab${state.activeTab === 'all' ? ' is-active' : ''}" role="tab" aria-selected="${state.activeTab === 'all'}" data-tab="all">전체</button>`,
    ...channels.map(
      (ch) => `
      <button
        type="button"
        class="tab${state.activeTab === ch.id ? ' is-active' : ''}"
        role="tab"
        aria-selected="${state.activeTab === ch.id}"
        data-tab="${ch.id}"
      >${escapeHtml(ch.name)}</button>`,
    ),
  ]
  tabsEl.innerHTML = tabButtons.join('')
}

function renderQuickSlots(): void {
  const inputEmpty = input.value.trim().length === 0
  const names = inputEmpty
    ? getRecentQuickSlotNames(state.nameHistory, state.items)
    : []

  if (names.length === 0) {
    quickSlotsEl.hidden = true
    quickSlotsRow.innerHTML = ''
    return
  }

  quickSlotsEl.hidden = false
  quickSlotsRow.innerHTML = names
    .map(
      (name) => `
      <button type="button" class="quick-chip" role="listitem" data-quick-name="${escapeAttr(name)}">
        ${escapeHtml(name)}
      </button>`,
    )
    .join('')
}

function renderList(): void {
  const items = visibleItems(state.items, state.activeTab)
  if (state.items.length === 0) {
    emptyEl.hidden = false
    emptyEl.textContent = '적을 품목이 있으면 위에 바로 추가하세요.'
  } else if (items.length === 0) {
    emptyEl.hidden = false
    emptyEl.textContent = '이 채널에 품목이 없습니다.'
  } else {
    emptyEl.hidden = true
  }

  listEl.innerHTML = items
    .map(
      (item) => `
      <li class="item${item.done ? ' is-done' : ''}" data-id="${item.id}">
        <button type="button" class="item-check" data-action="toggle" aria-label="${item.done ? '미완료로' : '완료로'}">
          <span class="check-mark" aria-hidden="true"></span>
        </button>
        <div class="item-body">
          <span class="item-name">${escapeHtml(item.name)}</span>
          <button type="button" class="item-channel" data-action="channel" aria-label="구매처 변경">
            ${escapeHtml(getChannelName(state.channels, item.channel))}
          </button>
        </div>
        <button type="button" class="item-delete" data-action="delete" aria-label="삭제">삭제</button>
      </li>
    `,
    )
    .join('')
}

function renderManageSheet(): void {
  const channels = sortedChannels(state.channels)
  manageList.replaceChildren()

  for (const [index, ch] of channels.entries()) {
    const li = document.createElement('li')
    li.className = 'manage-item'
    li.dataset.channelId = ch.id

    const nameInput = document.createElement('input')
    nameInput.className = 'manage-name'
    nameInput.type = 'text'
    nameInput.value = ch.name
    nameInput.setAttribute('aria-label', '채널 이름')

    const actions = document.createElement('div')
    actions.className = 'manage-actions'

    const addAction = (
      action: string,
      label: string,
      options?: { disabled?: boolean; className?: string },
    ) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.manage = action
      button.textContent = label
      if (options?.className) button.className = options.className
      button.disabled = Boolean(options?.disabled)
      actions.append(button)
    }

    addAction('save', '저장')
    addAction('up', '위로', { disabled: index === 0 })
    addAction('down', '아래로', { disabled: index === channels.length - 1 })
    addAction('default', ch.id === state.defaultChannelId ? '기본' : '기본으로', {
      className: ch.id === state.defaultChannelId ? 'is-default' : undefined,
    })
    addAction('delete', '삭제', {
      className: 'is-danger',
      disabled: channels.length <= 1,
    })

    li.append(nameInput, actions)
    manageList.append(li)
  }
}

function renderPickSheet(): void {
  if (!pickItemId) {
    pickList.innerHTML = ''
    return
  }
  const item = state.items.find((i) => i.id === pickItemId)
  const channels = sortedChannels(state.channels)
  pickList.innerHTML = channels
    .map(
      (ch) => `
      <li>
        <button
          type="button"
          class="pick-option${item?.channel === ch.id ? ' is-current' : ''}"
          data-pick-channel="${ch.id}"
        >${escapeHtml(ch.name)}</button>
      </li>
    `,
    )
    .join('')
}

function updateClearButton(): void {
  clearBtn.disabled = !state.items.some((item) => item.done)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(text: string): string {
  return escapeHtml(text)
}

function eventElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target
  if (target instanceof Text) return target.parentElement
  return null
}

form.addEventListener('submit', (event) => {
  event.preventDefault()
  const value = input.value
  if (!value.trim()) return
  addNames(value)
  input.value = ''
  renderQuickSlots()
})

input.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return
  if (event.isComposing || event.keyCode === 229) {
    event.preventDefault()
  }
})

input.addEventListener('input', () => {
  renderQuickSlots()
})

quickSlotsRow.addEventListener('click', (event) => {
  const target = eventElement(event.target)
  if (!target) return
  const chip = target.closest<HTMLElement>('[data-quick-name]')
  if (!chip?.dataset.quickName) return
  addNames(chip.dataset.quickName)
})

tabsEl.addEventListener('click', (event) => {
  const target = eventElement(event.target)
  if (!target) return
  const button = target.closest<HTMLElement>('[data-tab]')
  if (!button?.dataset.tab) return
  setTab(button.dataset.tab)
})

openManageBtn.addEventListener('click', () => {
  renderManageSheet()
  openSheet('manage-sheet')
})

listEl.addEventListener('click', (event) => {
  const target = eventElement(event.target)
  if (!target) return
  const actionEl = target.closest<HTMLElement>('[data-action]')
  const row = target.closest<HTMLElement>('[data-id]')
  if (!actionEl || !row?.dataset.id) return

  const id = row.dataset.id
  const action = actionEl.dataset.action
  if (action === 'toggle') toggleDone(id)
  else if (action === 'delete') deleteItem(id)
  else if (action === 'channel') {
    pickItemId = id
    renderPickSheet()
    openSheet('pick-sheet')
  }
})

clearBtn.addEventListener('click', () => clearDone())

document.querySelectorAll('[data-close]').forEach((el) => {
  el.addEventListener('click', () => {
    const id = (el as HTMLElement).dataset.close
    if (id === 'manage-sheet' || id === 'pick-sheet') closeSheet(id)
  })
})

manageAddForm.addEventListener('submit', (event) => {
  event.preventDefault()
  const next = addChannel(state, manageAddInput.value)
  if (!next) return
  state = next
  manageAddInput.value = ''
  refresh()
})

manageList.addEventListener('click', (event) => {
  const target = eventElement(event.target)
  if (!target) return
  const actionBtn = target.closest<HTMLElement>('[data-manage]')
  const row = target.closest<HTMLElement>('[data-channel-id]')
  if (!actionBtn || !row?.dataset.channelId) return

  // disabled 버튼은 클릭 무시
  if (actionBtn.hasAttribute('disabled') || actionBtn.getAttribute('aria-disabled') === 'true') {
    return
  }

  const id = row.dataset.channelId
  const action = actionBtn.dataset.manage
  const nameInput = row.querySelector<HTMLInputElement>('.manage-name')

  let next: AppState | null = null
  if (action === 'save' && nameInput) {
    next = renameChannel(state, id, nameInput.value)
  } else if (action === 'up') {
    next = moveChannel(state, id, -1)
  } else if (action === 'down') {
    next = moveChannel(state, id, 1)
  } else if (action === 'default') {
    next = setDefaultChannel(state, id)
  } else if (action === 'delete') {
    const count = state.items.filter((i) => i.channel === id).length
    const label = getChannelName(state.channels, id)
    const message =
      count > 0
        ? `"${label}"을(를) 삭제할까요? 품목 ${count}개는 기본 채널로 옮겨집니다.`
        : `"${label}"을(를) 삭제할까요?`
    if (!confirm(message)) return
    next = deleteChannel(state, id)
  }

  if (!next) return
  state = next
  refresh()
})

pickList.addEventListener('click', (event) => {
  const target = eventElement(event.target)
  if (!target) return
  const button = target.closest<HTMLElement>('[data-pick-channel]')
  if (!button?.dataset.pickChannel || !pickItemId) return
  assignChannel(pickItemId, button.dataset.pickChannel)
})

refresh()

requestAnimationFrame(() => {
  input.focus()
})
