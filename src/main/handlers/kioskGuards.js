import { shell } from 'electron'
import { state } from './state.js'

export function wireKioskGuards(win, { isDev = false } = {}) {
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  win.webContents.on('before-input-event', (event, input) => {
    if (!state.kioskLocked) return
    const key = (input.key || '').toUpperCase()
    const ctrl = !!input.control
    const alt = !!input.alt
    const isDown = input.type === 'keyDown'
    if (!isDown) return

    if (alt && key === 'F4') {
      event.preventDefault()
      return
    }
    if (key === 'F11') {
      event.preventDefault()
      return
    }
    if (ctrl && key === 'R') {
      event.preventDefault()
      return
    }
    if (!isDev && ctrl && input.shift && (key === 'I' || key === 'C')) {
      event.preventDefault()
      return
    }
    if (ctrl && key === 'W') {
      event.preventDefault()
      return
    }
  })

  win.on('close', (e) => {
    if (state.kioskLocked) e.preventDefault()
  })

  try {
    win.setAlwaysOnTop(true, 'normal')
    win.setKiosk(true)
    win.setFullScreen(true)
  } catch {}
}
