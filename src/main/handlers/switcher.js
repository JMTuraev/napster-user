// src/main/handlers/switcher.js
import { ipcMain } from 'electron'
import {
  enumAltTabWindows,
  bringToFrontByPid, // COM: WScript.Shell.AppActivate
  bringToFrontByHwnd, // P/Invoke fallback
  activationDiagnostics, // JSON diagnostika
  activateWindowSmart, // (ixtiyoriy) ASFW + COM + P/Invoke kombo
  waitForegroundStable // (ixtiyoriy) foreground barqarorligini kutish
} from './powershell.js'
import {
  // Agar mavjud bo'lsa kuchli fokus-release util'lari; bo'lmasa fallback ishlatiladi
  beginFocusRelease,
  endFocusRelease,
  temporaryPassthrough,
  setElectronAlwaysOnTop
} from './electronUtils.js'

let wired = false

// --- FOKUSNI BO'SHATISH (AOT qaytarilmaydi) ---
async function releaseFocus(ms = 700) {
  if (typeof beginFocusRelease === 'function') {
    beginFocusRelease()
    await new Promise((r) => setTimeout(r, ms))
    return
  }
  // fallback: AOT off + passthrough
  setElectronAlwaysOnTop(false)
  await temporaryPassthrough(Math.max(250, ms))
}

// --- FOKUSNI YAKUNLASH (AOT'ni QAYTARMAYMIZ!) ---
function finishFocus() {
  if (typeof endFocusRelease === 'function') {
    // endFocusRelease ichida ham AOT ni YOQMANG!
    endFocusRelease()
  }
  // ❗故意 AOT qaytarmaymiz — shu “sakrab tepaga chiqish”ni to‘xtatadi.
}

// --- Aktivatsiya + barqarorlikni kutish (bo'lsa) ---
async function runActivationWithStability({ execFn, pid, hwnd }) {
  try {
    await releaseFocus(700)

    const okActivate = await execFn()

    let okStable = okActivate
    if (okActivate && typeof waitForegroundStable === 'function') {
      okStable = await waitForegroundStable({
        pid,
        hwnd,
        timeout: 3500,
        stableMs: 600,
        interval: 120
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

  // --- Diagnostika (to'liq JSON hisobot) ---
  ipcMain.handle('altTab:activateDiag', async (_e, payload = {}) => {
    try {
      return await activationDiagnostics(payload) // { pid?, hwnd? }
    } catch (e) {
      return { ok: false, error: String(e?.message || e) }
    }
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

  // --- SMART: {pid, hwnd, title} qabul qiladi; activateWindowSmart bo'lsa undan foydalanadi.
  ipcMain.handle('altTab:activateSmart', async (_e, payload = {}) => {
    const pid = Number(payload?.pid ?? 0)
    const hwnd = String(payload?.hwnd ?? '').trim()
    const title = String(payload?.title ?? '')

    return await runActivationWithStability({
      execFn: async () => {
        // 1) Agar activateWindowSmart mavjud bo'lsa — undan foydalanamiz
        if (typeof activateWindowSmart === 'function') {
          const okSmart = await activateWindowSmart({ pid, hwnd, title })
          if (okSmart) return true
        }
        // 2) Aks holda, avval PID, keyin HWND bilan urinamiz
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

  // --- Diagnostika: ro'yxat + sana/son ---
  ipcMain.handle('altTab:listDebug', async () => {
    try {
      const items = await enumAltTabWindows()
      return { ok: true, ts: new Date().toISOString(), count: items.length, items }
    } catch (e) {
      return { ok: false, error: String(e?.message || e) }
    }
  })
}
