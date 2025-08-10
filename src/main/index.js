// src/main/index.js
import { app, shell, BrowserWindow, ipcMain, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerGameHandlers } from './gameHandlers.js'
import { registerHotkeyHandlers } from './hotkeyHandler.js'
import { getEthernetMac } from '../utils/network.js'
import './socketUpdateHandler.js'
import { spawn, execFile } from 'child_process'
import fs from 'fs'

// ------------------ KIOSK STATE ------------------
let kioskLocked = true // true = kuchli kiosk (bloklar ON)
let activeRuns = 0 // parallel .exe larni hisoblash

// ------------------ COVER WINDOW (yumshoq UX uchun) ------------------
let coverWin = null

function createCoverWindow(parent) {
  if (coverWin && !coverWin.isDestroyed()) return coverWin
  coverWin = new BrowserWindow({
    parent,
    modal: false,
    frame: false,
    fullscreen: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    transparent: false,
    backgroundColor: '#000000',
    alwaysOnTop: true, // faqat tranzit payti
    hasShadow: false,
    show: false,
    webPreferences: { sandbox: true }
  })
  // Bo'sh qora sahifa
  coverWin.loadURL(
    'data:text/html,<meta charset=utf-8><body style="margin:0;background:#000"></body>'
  )
  return coverWin
}
function showCover(parent) {
  const c = createCoverWindow(parent)
  if (!c.isVisible()) c.showInactive() // ko'rinadi, fokus olmaydi
  return c
}
function hideCover() {
  if (coverWin && !coverWin.isDestroyed()) {
    try {
      coverWin.hide()
    } catch {}
    try {
      coverWin.close()
    } catch {}
    coverWin = null
  }
}

// ------------------ KIOSK MODE BOSHQARISH ------------------
function setKioskMode(win, enabled, { soft = false } = {}) {
  kioskLocked = enabled
  try {
    if (enabled) {
      // QAYTA KIOSK: bloklar ON, full screen, tepada
      if (win.isMinimized()) win.restore()
      win.setAlwaysOnTop(true, 'normal')
      win.setKiosk(true)
      win.setFullScreen(true)
    } else {
      if (soft) {
        // SOFT RELAX: minimize yo‘q, fullscreen saqlanadi (UI sakramaydi)
        win.setAlwaysOnTop(false)
        win.setKiosk(false)
        win.setFullScreen(true)
      } else {
        // HARD RELAX: to‘liq bo‘shatish (fallback)
        win.setAlwaysOnTop(false)
        win.setKiosk(false)
        win.setFullScreen(false)
        win.minimize()
      }
    }
  } catch (e) {
    console.error('[KIOSK] setKioskMode error:', e)
  }
}

// ------------------ CSP PATCH ------------------
function patchCSP() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const cspDirectives = [
      "default-src 'self'",
      "img-src 'self' data: http://localhost:3000 http://192.168.1.10:5173",
      "connect-src 'self' ws://localhost:3000 http://localhost:3000 ws://192.168.1.10:3000 http://192.168.1.10:3000 ws://192.168.0.100:3000 http://192.168.0.100:3000",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'"
    ].join('; ')
    callback({
      responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [cspDirectives] }
    })
  })
}

// ------------------ MAC address ------------------
ipcMain.handle('get-mac', () => getEthernetMac())

// ------------------ Kiosk guardlar (faqat kioskLocked=true bo'lsa) ------------------
function wireKioskGuards(win) {
  // tashqi linklar brauzerda
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // klaviatura bloklari
  win.webContents.on('before-input-event', (event, input) => {
    if (!kioskLocked) return // bo'sh rejimda bloklamaymiz

    const key = (input.key || '').toUpperCase()
    const ctrl = !!input.control
    const shift = !!input.shift
    const alt = !!input.alt
    const isDown = input.type === 'keyDown'
    if (!isDown) return

    if (alt && key === 'F4') {
      event.preventDefault()
      return
    } // Alt+F4
    if (key === 'F11') {
      event.preventDefault()
      return
    } // F11
    if (ctrl && key === 'R') {
      event.preventDefault()
      return
    } // Ctrl+R
    if (!is.dev && ctrl && shift && (key === 'I' || key === 'C')) {
      // DevTools/Inspect (prod)
      event.preventDefault()
      return
    }
    if (ctrl && key === 'W') {
      event.preventDefault()
      return
    } // Ctrl+W
    if (key === 'ESCAPE') {
      event.preventDefault()
      return
    } // Esc
    if (alt && ['TAB', 'SPACE', 'ENTER'].includes(key)) {
      // Ba'zi Alt kombinatsiyalar
      event.preventDefault()
      return
    }
  })

  // yopishni bloklash
  win.on('close', (e) => {
    e.preventDefault()
  })

  // dastlab kuchli kiosk
  setKioskMode(win, true)
}

// ------------------ Fullscreen majburiy (flags + Alt+Enter) ------------------
function getPwsh64() {
  const win = process.env.SystemRoot || 'C:\\Windows'
  const sysnative = `${win}\\Sysnative\\WindowsPowerShell\\v1.0\\powershell.exe`
  const system32 = `${win}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
  try {
    if (fs.existsSync(sysnative)) return sysnative
  } catch {}
  try {
    if (fs.existsSync(system32)) return system32
  } catch {}
  return 'powershell.exe'
}

function addFullscreenArgs(exeName, args = []) {
  const name = (exeName || '').toLowerCase()
  const out = [...args]

  // Brauzerlar
  if (name === 'chrome.exe') out.unshift('--start-fullscreen')
  if (name === 'msedge.exe') out.unshift('--start-fullscreen')
  if (name === 'firefox.exe') out.unshift('-kiosk')

  // Unity
  if (name.endsWith('_data.exe') || name.includes('unity')) {
    out.unshift('-screen-fullscreen', '1')
  }

  // Umumiy PC o‘yin flagi
  if (!out.includes('-fullscreen') && !out.includes('--fullscreen')) {
    out.unshift('-fullscreen')
  }

  return out
}

function sendAltEnterPulse({ repeats = 5, delayMs = 800 }) {
  const pwsh = getPwsh64()
  const cmd =
    `$ws = New-Object -ComObject WScript.Shell;` +
    `for($i=0;$i -lt ${repeats};$i++){ Start-Sleep -Milliseconds ${delayMs}; $ws.SendKeys('%{ENTER}') }`
  spawn(pwsh, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], {
    windowsHide: true,
    stdio: 'ignore',
    detached: true
  }).unref()
}

// --- Process watcher helper’lari ---
function psAnyAliveByNames(names = []) {
  return new Promise((resolve) => {
    if (!names.length) return resolve(false)
    const pwsh = getPwsh64()
    const filter = names.map((n) => `'${String(n).toLowerCase().replace(/'/g, "''")}'`).join(',')
    const script =
      `$names=@(${filter});` +
      `$alive = Get-Process | Where-Object { $names -contains ($_.Name + '.exe').ToLower() -or $names -contains $_.Name.ToLower() };` +
      `if ($alive) { exit 0 } else { exit 1 }`
    const child = execFile(pwsh, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true
    })
    child.on('exit', (code) => resolve(code === 0))
    child.on('error', () => resolve(false))
  })
}
function psAnyDescendantAlive(rootPid) {
  return new Promise((resolve) => {
    const pwsh = getPwsh64()
    const script =
      `$root=${Number(rootPid)};` +
      `$procs = Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -eq $root -or $_.ParentProcessId -eq $root };` +
      `if ($procs) { exit 0 } else { exit 1 }`
    const child = execFile(pwsh, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true
    })
    child.on('exit', (code) => resolve(code === 0))
    child.on('error', () => resolve(false))
  })
}

// ------------------ .EXE RUN + AUTO RELAX/RESTORE (soft + cover) ------------------
function createRunExeIPC() {
  /**
   * Renderer’dan:
   * await window.api.invoke('kiosk:run-exe', {
   *   path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
   *   args: ['--new-window', 'https://example.com'], // ixtiyoriy
   *   cwd:  'C:\\Program Files\\Google\\Chrome\\Application', // ixtiyoriy
   *   hide: true,        // ixtiyoriy (default true)
   *   lingerMs: 3000,    // ixtiyoriy, launcherlar uchun kutish (default 3s)
   *   forceFullscreen: true, // default true
   *   watchNames: ['game.exe'] // ixtiyoriy: real o‘yin jarayoni nomi
   * })
   */
  ipcMain.handle('kiosk:run-exe', async (_e, payload = {}) => {
    const exePath = String(payload.path || '').trim()
    if (!exePath) return { ok: false, error: 'exe path empty' }
    if (!fs.existsSync(exePath)) return { ok: false, error: 'exe not found' }

    const exeName = exePath.split('\\').pop()
    const baseName = (exeName || '').toLowerCase()
    const cwd = payload.cwd && typeof payload.cwd === 'string' ? payload.cwd : undefined
    const hide = payload.hide !== false
    const lingerMs = Number.isFinite(payload.lingerMs) ? payload.lingerMs : 3000
    const forceFullscreen = payload.forceFullscreen !== false // default: true
    let args = Array.isArray(payload.args) ? payload.args : []

    const watchNames =
      Array.isArray(payload.watchNames) && payload.watchNames.length
        ? payload.watchNames.map((n) => String(n || '').toLowerCase())
        : [baseName]

    if (forceFullscreen) args = addFullscreenArgs(exeName, args)

    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return { ok: false, error: 'no window' }

    // 1) SOFT RELAX + COVER (UX silliq)
    const cover = showCover(win)
    setKioskMode(win, false, { soft: true })

    activeRuns += 1
    const started = Date.now()

    try {
      const child = spawn(exePath, args, { cwd, windowsHide: !!hide, stdio: 'ignore' })

      // O'yin fokus olishi uchun coverni 300–700ms da olib tashlash yetarli
      setTimeout(() => {
        hideCover()
      }, 500)

      if (forceFullscreen) sendAltEnterPulse({ repeats: 5, delayMs: 800 })

      // 2) watcher: child PID va nomlar bo‘yicha tekshir
      let stopped = false
      const stop = () => {
        if (!stopped) {
          stopped = true
          clearInterval(tick)
        }
      }

      const tick = setInterval(async () => {
        const descendants = await psAnyDescendantAlive(child.pid)
        const anyByName = await psAnyAliveByNames(watchNames)
        if (!descendants && !anyByName) {
          stop()
          activeRuns = Math.max(0, activeRuns - 1)
          if (activeRuns === 0) {
            const elapsed = Date.now() - started
            const wait = Math.max(0, lingerMs - elapsed)
            setTimeout(() => {
              hideCover()
              const w = BrowserWindow.getAllWindows()[0]
              if (w) setKioskMode(w, true) // qayta KIOSK
            }, wait)
          }
        }
      }, 1200)

      child.on('error', () => stop())
      child.on('exit', () => {
        /* watcher hal qiladi */
      })
      child.on('close', () => {
        /* watcher hal qiladi */
      })

      return { ok: true, pid: child.pid }
    } catch (e) {
      console.error('[RUN-EXE] error:', e)
      try {
        hideCover()
        setKioskMode(BrowserWindow.getAllWindows()[0], true)
      } catch {}
      return { ok: false, error: String(e?.message || e) }
    }
  })

  // qo‘lda boshqarish (ixtiyoriy)
  ipcMain.handle('kiosk:relax-full', () => {
    const w = BrowserWindow.getAllWindows()[0]
    if (w) {
      showCover(w)
      setKioskMode(w, false, { soft: true })
      setTimeout(() => hideCover(), 500)
    }
    return { ok: true }
  })
  ipcMain.handle('kiosk:restore-full', () => {
    hideCover()
    const w = BrowserWindow.getAllWindows()[0]
    if (w) setKioskMode(w, true)
    return { ok: true }
  })
}

// ------------------ OYNA ------------------
function createWindow() {
  const mainWindow = new BrowserWindow({
    kiosk: true,
    fullscreen: true,
    frame: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    closable: true,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    width: 1280,
    height: 800,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      devTools: is.dev
    }
  })

  wireKioskGuards(mainWindow)
  return mainWindow
}

// ------------------ APP LIFECYCLE ------------------
app.whenReady().then(() => {
  patchCSP()
  electronApp.setAppUserModelId('com.electron')

  registerHotkeyHandlers()
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  registerGameHandlers()
  const win = createWindow()
  createRunExeIPC() // IPC’larni ro‘yxatdan o‘tkazamiz

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const w = createWindow()
      if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        w.loadURL(process.env['ELECTRON_RENDERER_URL'])
        w.webContents.openDevTools({ mode: 'detach' })
      } else {
        w.loadFile(join(__dirname, '../renderer/index.html'))
      }
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // kioskni qo'lda yopasiz
  }
})
