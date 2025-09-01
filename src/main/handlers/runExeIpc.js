import fs from 'fs'
import { ipcMain, BrowserWindow } from 'electron'
import { spawn, execFile } from 'child_process'
import { state } from './state.js'
import {
  enumAltTabWindows,
  bringToFrontByHwnd,
  psAnyAliveByNames,
  psAnyDescendantAlive
} from './powershell.js'
import {
  temporaryPassthrough,
  setElectronMousePassthrough,
  setElectronAlwaysOnTop
} from './electronUtils.js'

/* ------------------------------ Mini cache ---------------------------------- */
// Alt+Tab ro'yxatini 300 ms kesh: ketma-ket chaqiruvlar yengillashadi
let _enumCache = { at: 0, data: [] }
async function getAltTabFast(ms = 300) {
  const now = Date.now()
  if (now - _enumCache.at < ms) return _enumCache.data
  const data = await enumAltTabWindows()
  _enumCache = { at: now, data }
  return data
}

// exePath bo'yicha birinchi HWND
async function getHwndByExePath(exePath, { fresh = false } = {}) {
  const lower = String(exePath || '').toLowerCase()
  const list = fresh ? await enumAltTabWindows() : await getAltTabFast()
  const item = list.find((w) => String(w.exePath || '').toLowerCase() === lower)
  return item?.hwnd || ''
}

/* ------------------------------- IPC handlers ------------------------------- */
export function createRunExeIPC() {
  ipcMain.handle('kiosk:run-exe', async (_e, payload = {}) => {
    const exePath = String(payload.path || '').trim()
    if (!exePath) return { ok: false, error: 'exe path empty' }
    if (!fs.existsSync(exePath)) return { ok: false, error: 'exe not found' }

    const exeName = exePath.split('\\').pop() || ''
    const baseName = exeName.toLowerCase()
    const cwd = typeof payload.cwd === 'string' && payload.cwd ? payload.cwd : undefined
    const hide = payload.hide !== false
    const forceFullscreen = payload.forceFullscreen === true
    let args = Array.isArray(payload.args) ? payload.args : []

    const watchNames =
      Array.isArray(payload.watchNames) && payload.watchNames.length
        ? payload.watchNames.map((n) => String(n || '').toLowerCase())
        : [baseName]

    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return { ok: false, error: 'no window' }

    // Electronni vaqtincha passtrough + AOT off
    setElectronAlwaysOnTop(false)
    temporaryPassthrough(400).catch(() => {})

    // Avval mavjud oynani topamiz: kesh -> bo'lmasa fresh
    let hwnd = await getHwndByExePath(exePath)
    if (!hwnd) hwnd = await getHwndByExePath(exePath, { fresh: true })
    if (hwnd) {
      const ok = await bringToFrontByHwnd(hwnd)
      if (ok) return { ok: true, activated: true }
      // bo'lmasa yangi ochamiz
    }

    // Fullscreen flaglar
    if (forceFullscreen) {
      if (baseName === 'chrome.exe' || baseName === 'msedge.exe')
        args = ['--start-fullscreen', ...args]
      else if (baseName === 'firefox.exe') args = ['-kiosk', ...args]
    }

    try {
      const child = spawn(exePath, args, { cwd, windowsHide: !!hide, stdio: 'ignore' })
      state.running.add(child.pid)
      state.activeRuns += 1

      // Oyna chiqqach, ikki marta yengil aktivatsiya
      setTimeout(async () => {
        const h1 = await getHwndByExePath(exePath, { fresh: true })
        if (h1) await bringToFrontByHwnd(h1)
      }, 600)

      setTimeout(async () => {
        const h2 = await getHwndByExePath(exePath, { fresh: true })
        if (h2) await bringToFrontByHwnd(h2)
      }, 1200)

      // Watcher: 1s; avval kesh, keyin talab bo‘lsa fresh bilan tasdiq
      const tick = setInterval(async () => {
        const [descendants, anyByName, hCached] = await Promise.all([
          psAnyDescendantAlive(child.pid),
          psAnyAliveByNames(watchNames),
          getHwndByExePath(exePath)
        ])

        if (!descendants && !anyByName && !hCached) {
          const hFresh = await getHwndByExePath(exePath, { fresh: true })
          if (!hFresh) {
            clearInterval(tick)
            state.running.delete(child.pid)
            state.activeRuns = Math.max(0, state.activeRuns - 1)
            if (state.activeRuns === 0) {
              setElectronMousePassthrough(false)
              setElectronAlwaysOnTop(true)
            }
          }
        }
      }, 1000)

      child.on('exit', () => {})
      child.on('close', () => {})
      child.on('error', () => {})

      return { ok: true, pid: child.pid }
    } catch (e) {
      setElectronMousePassthrough(false)
      setElectronAlwaysOnTop(true)
      return { ok: false, error: String(e?.message || e) }
    }
  })

  // Faqat aktivatsiya (svernutdan qaytarish)
  ipcMain.handle('kiosk:activate-exe', async (_e, exePathRaw) => {
    const exePath = String(exePathRaw || '').trim()
    if (!exePath) return { ok: false, error: 'bad-path' }
    const h =
      (await getHwndByExePath(exePath)) || (await getHwndByExePath(exePath, { fresh: true }))
    if (!h) return { ok: false, error: 'not-running' }
    const ok = await bringToFrontByHwnd(h)
    return { ok }
  })

  // Texnik xizmat: explorer ochish/yopish
  ipcMain.handle('kiosk:maintenance:on', async () => {
    setElectronAlwaysOnTop(false)
    setElectronMousePassthrough(false)
    execFile('cmd.exe', ['/c', 'start', 'explorer.exe'], { windowsHide: true }, () => {})
    return { ok: true }
  })

  ipcMain.handle('kiosk:maintenance:off', async () => {
    setElectronAlwaysOnTop(true)
    return { ok: true }
  })
}
