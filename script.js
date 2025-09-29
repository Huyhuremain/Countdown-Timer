// script.js (merged + scroll to bottom on save)
const STORAGE_KEY = 'countdown_events_simple_v2'

// Elements
const eventsContainer = document.getElementById('events')
const inputName = document.getElementById('eventName')
const inputDate = document.getElementById('eventDate')
const inputNotify = document.getElementById('notifyBefore')
const inputSound = document.getElementById('sound')
const inputPriority = document.getElementById('priority')

const btnSave = document.getElementById('saveEvent')
const btnCancel = document.getElementById('cancelEdit')
const btnClearAll = document.getElementById('clearAll')
const btnRequestNotification = document.getElementById('requestNotification')

let events = []
let editingId = ''
let scheduled = {}
const ding = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=')
ding.preload = 'auto'

function uid() { return 'e' + Math.random().toString(36).slice(2, 9) }

function loadEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    events = raw ? JSON.parse(raw) : []
  } catch (e) {
    events = []
  }
}

function saveEvents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
}

function fmtNotifyLabel(val) {
  if (!val) return 'Khi đến hạn'
  const n = Number(val)
  if (n === 5) return 'Trước 5 phút'
  if (n === 15) return 'Trước 15 phút'
  if (n === 60) return 'Trước 1 giờ'
  if (n === 1440) return 'Trước 1 ngày'
  return `${val} phút`
}

function clearForm() {
  inputName.value = ''
  inputDate.value = ''
  inputNotify.value = ''
  inputSound.checked = false
  inputPriority.checked = false
  editingId = ''
  btnSave.textContent = 'Lưu sự kiện'
}

function renderEvents() {
  eventsContainer.innerHTML = ''
  if (events.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'empty-box'
    empty.textContent = 'Chưa có sự kiện.'
    eventsContainer.appendChild(empty)
    return
  }
  const sorted = [...events].sort((a, b) => {
    if (a.priority && !b.priority) return -1
    if (b.priority && !a.priority) return 1
    return new Date(a.time) - new Date(b.time)
  })

  for (const ev of sorted) {
    const card = document.createElement('div')
    card.className = 'event-card'

    const left = document.createElement('div')
    left.className = 'event-left'

    const title = document.createElement('div')
    title.className = 'event-title'
    title.textContent = ev.title

    const when = document.createElement('div')
    when.className = 'event-when'
    const d = new Date(ev.time)
    when.textContent = isNaN(d) ? ev.time : d.toLocaleString()

    const countdown = document.createElement('div')
    countdown.className = 'countdown'
    countdown.id = 'cd-' + ev.id
    countdown.textContent = '--:--:--'

    left.appendChild(title)
    left.appendChild(when)
    left.appendChild(countdown)

    const right = document.createElement('div')
    right.className = 'event-right'

    const info = document.createElement('div')
    info.className = 'event-info'
    info.innerHTML =
      `<div><strong>Thông báo:</strong> ${fmtNotifyLabel(ev.notifyBefore)}</div>` +
      `<div><strong>Âm thanh:</strong> ${ev.sound ? 'Có' : 'Không'}</div>` +
      `<div><strong>Ưu tiên:</strong> ${ev.priority ? 'Có' : 'Không'}</div>`

    const actions = document.createElement('div')
    actions.className = 'event-actions'

    const editBtn = document.createElement('button')
    editBtn.type = 'button'
    editBtn.className = 'btn-small'
    editBtn.textContent = 'Sửa'
    editBtn.addEventListener('click', () => startEdit(ev.id))

    const delBtn = document.createElement('button')
    delBtn.type = 'button'
    delBtn.className = 'btn-small'
    delBtn.textContent = 'Xóa'
    delBtn.addEventListener('click', () => {
      if (!confirm('Xóa sự kiện này?')) return
      events = events.filter(x => x.id !== ev.id)
      saveEvents()
      renderEvents()
      scheduleNotifications()
    })

    actions.appendChild(editBtn)
    actions.appendChild(delBtn)

    right.appendChild(info)
    right.appendChild(actions)

    card.appendChild(left)
    card.appendChild(right)
    eventsContainer.appendChild(card)
  }
}

function startEdit(id) {
  const ev = events.find(x => x.id === id)
  if (!ev) return
  inputName.value = ev.title
  const dt = new Date(ev.time)
  if (!isNaN(dt)) {
    const tzOffset = dt.getTimezoneOffset() * 60000
    const localISO = new Date(dt.getTime() - tzOffset).toISOString().slice(0, 16)
    inputDate.value = localISO
  } else {
    inputDate.value = ''
  }
  inputNotify.value = ev.notifyBefore || ''
  inputSound.checked = !!ev.sound
  inputPriority.checked = !!ev.priority
  editingId = ev.id
  btnSave.textContent = 'Cập nhật'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function updateCountdowns() {
  const now = new Date()
  for (const ev of events) {
    const el = document.getElementById('cd-' + ev.id)
    if (!el) continue
    const target = new Date(ev.time)
    let diff = target - now
    if (diff <= 0) {
      el.textContent = 'Đã đến!'
      continue
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24)); diff -= days * (1000 * 60 * 60 * 24)
    const hours = Math.floor(diff / (1000 * 60 * 60)); diff -= hours * (1000 * 60 * 60)
    const minutes = Math.floor(diff / (1000 * 60)); diff -= minutes * (1000 * 60)
    const seconds = Math.floor(diff / 1000)
    const parts = []
    if (days > 0) parts.push(days + 'd')
    parts.push(String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0'))
    el.textContent = parts.join(' ')
  }
}

function scheduleNotifications() {
  for (const k in scheduled) { try { clearTimeout(scheduled[k]) } catch (e) {} }
  scheduled = {}
  const now = Date.now()
  for (const ev of events) {
    const t = new Date(ev.time).getTime()
    if (isNaN(t)) continue
    let offset = 0
    if (ev.notifyBefore) offset = (Number(ev.notifyBefore) || 0) * 60 * 1000
    const notifyAt = t - offset
    const id = ev.id
    if (notifyAt <= now) {
      if (t > now) triggerNotification(ev)
      continue
    }
    const ms = notifyAt - now
    if (ms > 2147483647) continue
    scheduled[id] = setTimeout(() => { triggerNotification(ev); delete scheduled[id] }, ms)
  }
}

function triggerNotification(ev) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(ev.title, { body: `${ev.title} — ${new Date(ev.time).toLocaleString()}` }) } catch (e) { console.warn(e) }
  }
  if (ev.sound && ding) { try { ding.currentTime = 0; ding.play().catch(() => {}) } catch (e) {} }
  const el = document.getElementById('cd-' + ev.id)
  if (el) {
    const parent = el.closest('.event-card') || el.closest('.evt')
    if (parent) {
      parent.style.borderColor = 'rgba(6,182,212,0.8)'
      parent.style.boxShadow = '0 6px 18px rgba(6,182,212,0.08)'
      setTimeout(() => { parent.style.borderColor = ''; parent.style.boxShadow = '' }, 8000)
    }
  }
}

// Button handlers
btnSave.addEventListener('click', (e) => {
  e.preventDefault()
  const title = inputName.value.trim()
  const dtVal = inputDate.value
  if (!title || !dtVal) { alert('Vui lòng nhập tên sự kiện và ngày giờ.'); return }
  const jsDate = new Date(dtVal)
  if (isNaN(jsDate)) { alert('Ngày/giờ không hợp lệ.'); return }

  const evObj = {
    id: editingId || uid(),
    title,
    time: jsDate.toISOString(),
    notifyBefore: inputNotify.value || '',
    sound: !!inputSound.checked,
    priority: !!inputPriority.checked
  }

  if (editingId) {
    const idx = events.findIndex(x => x.id === editingId)
    if (idx >= 0) events[idx] = evObj
  } else {
    events.push(evObj)
  }

  saveEvents()
  renderEvents()
  scheduleNotifications()
  clearForm()

  // cuộn xuống box hiển thị sự kiện để thấy ngay nội dung vừa lưu
  try { eventsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' }) } catch (e) {}
})

btnCancel.addEventListener('click', (e) => { e.preventDefault(); clearForm() })

btnClearAll.addEventListener('click', () => {
  if (!confirm('Xóa tất cả sự kiện?')) return
  events = []
  saveEvents()
  renderEvents()
  for (const k in scheduled) { try { clearTimeout(scheduled[k]) } catch (e) {} }
  scheduled = {}
})

btnRequestNotification.addEventListener('click', async () => {
  if (!('Notification' in window)) { alert('Trình duyệt không hỗ trợ Notification API.'); return }
  try { const p = await Notification.requestPermission(); alert('Quyền thông báo: ' + p) } catch (err) { alert('Không thể yêu cầu quyền: ' + err) }
})

setInterval(() => { scheduleNotifications() }, 60 * 1000)
setInterval(() => { updateCountdowns() }, 1000)

loadEvents()
renderEvents()
scheduleNotifications()
updateCountdowns()
window.addEventListener('focus', () => { scheduleNotifications() })
