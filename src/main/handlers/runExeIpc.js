import fs from 'fs'
import { ipcMain, BrowserWindow } from 'electron'
import { spawn, execFile } from 'child_process'
import { state } from './state.js'
import {
  findAnyHwndByExePathAllDesktops,
  bringToFrontByHwnd,
  psAnyAliveByNames,
  psAnyDescendantAlive
} from './powershell.js'
import {
  temporaryPassthrough,
  setElectronMousePassthrough,
  setElectronAlwaysOnTop
} from './electronUtils.js'

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

    // Electronni vaqtincha passtrough qilib yuboramiz
    setElectronAlwaysOnTop(false)
    temporaryPassthrough(500).catch(() => {})

    // Avval mavjud oynani topishga urinamiz
    const hwnd = await findAnyHwndByExePathAllDesktops(exePath)
    if (hwnd) {
      const ok = await bringToFrontByHwnd(hwnd)
      if (ok) return { ok: true, activated: true }
      // bo'lmasa yangi ochamiz
    }

    // Yangi prokessni fullscreen flaglari bilan ishga tushirish
    if (forceFullscreen) {
      if (baseName === 'chrome.exe') args = ['--start-fullscreen', ...args]
      else if (baseName === 'msedge.exe') args = ['--start-fullscreen', ...args]
      else if (baseName === 'firefox.exe') args = ['-kiosk', ...args]
    }

    try {
      const child = spawn(exePath, args, { cwd, windowsHide: !!hide, stdio: 'ignore' })
      state.running.add(child.pid)
      state.activeRuns += 1

      // Oyna paydo bo'lgach, uni topib oldinga chiqaramiz
      setTimeout(async () => {
        const h = await findAnyHwndByExePathAllDesktops(exePath)
        if (h) await bringToFrontByHwnd(h)
      }, 700)

      // Watcher: bolalar protsesslari, nomlari va oynasi
      const tick = setInterval(async () => {
        const descendants = await psAnyDescendantAlive(child.pid)
        const anyByName = await psAnyAliveByNames(watchNames)
        const hasHwnd = !!(await findAnyHwndByExePathAllDesktops(exePath))

        if (!descendants && !anyByName && !hasHwnd) {
          clearInterval(tick)
          state.running.delete(child.pid)
          state.activeRuns = Math.max(0, state.activeRuns - 1)
          if (state.activeRuns === 0) {
            setElectronMousePassthrough(false)
            setElectronAlwaysOnTop(true)
          }
        }
      }, 1200)

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
  ipcMain.handle('kiosk:activate-exe', async (_e, exePath) => {
    const h = await findAnyHwndByExePathAllDesktops(String(exePath || '').trim())
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
