// src/main/handlers/switcher.js
import { ipcMain } from 'electron'
import {
  enumAltTabWindows // Foreground barqarorligini kutish (ixtiyoriy)
} from './powershell.js'
import {
  beginFocusRelease,
  endFocusRelease,
  temporaryPassthrough,
  setElectronAlwaysOnTop
} from './electronUtils.js'

let wired = false

// --- FOKUSNI BO'SHATISH (AOT qaytarilmaydi) ---
async function releaseFocus(ms = 700) {
  if (typeof beginFocusRelease === 'function') {
    try {
      beginFocusRelease()
    } catch {}
    await new Promise((r) => setTimeout(r, ms))
    return
  }
  // fallback: AOT off + passthrough
  try {
    setElectronAlwaysOnTop(false)
  } catch {}
  await temporaryPassthrough(Math.max(250, ms)).catch(() => {})
}

// --- FOKUSNI YAKUNLASH (AOT'ni QAYTARMAYMIZ!) ---
function finishFocus() {
  if (typeof endFocusRelease === 'function') {
    try {
      endFocusRelease()
    } catch {}
  }
  // atayin AOT ni qaytarmaymiz – “sakrash” bo‘lmasin
}

// --- Aktivatsiya + barqarorlikni kutish (bo'lsa) ---
async function runActivationWithStability({ execFn, pid, hwnd }) {
  try {
    await releaseFocus(650)

    const okActivate = await execFn()

    let okStable = okActivate
    if (okActivate && typeof waitForegroundStable === 'function') {
      okStable = await waitForegroundStable({
        pid,
        hwnd,
        timeout: 3000,
        stableMs: 500,
        interval: 100
      })
    }

    finishFocus()
    return { ok: !!okStable }
  } catch (e) {
    finishFocus()
    return { ok: false, error: String(e?.message || e) }
  }
}

export function registerSwitcherHandlers() {
  if (wired) return
  wired = true

  // --- Alt+Tab ro'yxati (exePath, exeName, title, pid, hwnd) ---
  ipcMain.handle('altTab:list', async () => {
    try {
      return await enumAltTabWindows()
    } catch (e) {
      console.error('[altTab:list] error:', e)
      return []
    }
  })

  // --- Diagnostika (eski og‘ir funksiyasiz; moslik uchun qoldirilgan) ---
  ipcMain.handle('altTab:activateDiag', async () => {
    // Hamma joyga proba logika tiqib, tizimni sekinlatish o‘rniga
    // API mosligi uchun minimal javob qaytaramiz.
    return { ok: false, unsupported: true, reason: 'activationDiagnostics removed for performance' }
  })

  // --- PID orqali aktivlashtirish (afzal usul) ---
  ipcMain.handle('altTab:activateByPid', async (_e, pidInput) => {
    const pid = Number(pidInput)
    if (!Number.isFinite(pid) || pid <= 0) return { ok: false, error: 'bad-pid' }

    return await runActivationWithStability({
      execFn: () => bringToFrontByPid(pid),
      pid,
      hwnd: undefined
    })
  })

  // --- HWND orqali aktivlashtirish (fallback) ---
  ipcMain.handle('altTab:activate', async (_e, hwndInput) => {
    const hwndStr = String(hwndInput ?? '').trim()
    if (!/^-?\d+$/.test(hwndStr) || hwndStr === '0') return { ok: false, error: 'bad-hwnd' }

    return await runActivationWithStability({
      execFn: () => bringToFrontByHwnd(hwndStr),
      pid: undefined,
      hwnd: hwndStr
    })
  })

  // --- SMART (soddalashtirilgan): avval PID, keyin HWND ---
  ipcMain.handle('altTab:activateSmart', async (_e, payload = {}) => {
    const pid = Number(payload?.pid ?? 0)
    const hwnd = String(payload?.hwnd ?? '').trim()

    return await runActivationWithStability({
      execFn: async () => {
        if (Number.isFinite(pid) && pid > 0) {
          const okPid = await bringToFrontByPid(pid)
          if (okPid) return true
        }
        if (/^-?\d+$/.test(hwnd) && hwnd !== '0') {
          const okHwnd = await bringToFrontByHwnd(hwnd)
          if (okHwnd) return true
        }
        return false
      },
      pid,
      hwnd
    })
  })

  ipcMain.handle('altTab:listRaw', async () => {
    try {
      const arr = await enumAltTabWindows()
      return { ok: true, count: arr.length, items: arr }
    } catch (e) {
      return { ok: false, error: String(e?.message || e) }
    }
  })

  // --- Debug: ro'yxat + sanasi ---
  ipcMain.handle('altTab:listDebug', async () => {
    try {
      const items = await enumAltTabWindows()
      return { ok: true, ts: new Date().toISOString(), count: items.length, items }
    } catch (e) {
      return { ok: false, error: String(e?.message || e) }
    }
  })
}
