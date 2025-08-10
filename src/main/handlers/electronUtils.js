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
    w.setAlwaysOnTop(!!active, 'normal')
  } catch {}
}

export async function temporaryPassthrough(ms = 500) {
  setElectronMousePassthrough(true)
  await new Promise((r) => setTimeout(r, ms))
  setElectronMousePassthrough(false)
}
