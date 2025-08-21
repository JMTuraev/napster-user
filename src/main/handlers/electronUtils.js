import { BrowserWindow } from 'electron'

export function setElectronMousePassthrough(active) {
  const w = BrowserWindow.getAllWindows()[0]
  if (!w) return
  try {
    if (active) w.setIgnoreMouseEvents(true, { forward: true })
    else w.setIgnoreMouseEvents(false)
  } catch {}
}

export function setElectronAlwaysOnTop(active) {
  const w = BrowserWindow.getAllWindows()[0]
  if (!w) return
  try {
    w.setAlwaysOnTop(!!active, 'screen-saver')
    w.setVisibleOnAllWorkspaces(!!active, { visibleOnFullScreen: true })
    w.setFullScreenable(!active)
  } catch {}
}

// 🆕: Fokusni rostdan ham bo‘shatish (Windows’da juda muhim)
export async function temporaryFocusRelease(ms = 700) {
  const w = BrowserWindow.getAllWindows()[0]
  if (!w) return
  try {
    w.setAlwaysOnTop(false, 'screen-saver')
    w.setFocusable(false) // 👈 fokusga noloyiq
    w.blur()
    setElectronMousePassthrough(true) // sichqon hodisasi o‘tsin

    await new Promise((r) => setTimeout(r, ms))

    setElectronMousePassthrough(false)
    w.setFocusable(true)
    w.setAlwaysOnTop(true, 'screen-saver')
  } catch {}
}

// Eski util ham qolsin
export async function temporaryPassthrough(ms = 500) {
  setElectronMousePassthrough(true)
  await new Promise((r) => setTimeout(r, ms))
  setElectronMousePassthrough(false)
}

export function beginFocusRelease() {
  const w = BrowserWindow.getAllWindows()[0]
  if (!w) return
  try {
    w.setAlwaysOnTop(false, 'screen-saver')
    w.setFocusable(false)
    w.blur()
    w.setIgnoreMouseEvents(true, { forward: true })
  } catch {}
}

export function endFocusRelease() {
  const w = BrowserWindow.getAllWindows()[0]
  if (!w) return
  try {
    w.setIgnoreMouseEvents(false)
    w.setFocusable(true)
    w.setAlwaysOnTop(false, 'screen-saver')
  } catch {}
}
