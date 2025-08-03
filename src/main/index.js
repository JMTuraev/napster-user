// src/main/index.js
import { app, shell, BrowserWindow, ipcMain, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerGameHandlers } from './gameHandlers.js'
import { registerHotkeyHandlers } from './hotkeyHandler.js'
import { getEthernetMac } from '../utils/network.js'
import { exec } from 'child_process'
import fs from 'fs' // Kerakli bo‘lsa, bor yo‘qligini tekshiradi
import './socketUpdateHandler.js'

// --- CSP PATCH: SOCKET.IO va boshqa kerakli resurslar uchun ---
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
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspDirectives]
      }
    })
  })
}

// --- MAC address olish funksiyasi ---
ipcMain.handle('get-mac', () => getEthernetMac())

// --- APP-ni yopish IPC handler --- (EXPLORER SHELL + RESTART)
ipcMain.handle('close-app', () => {
  try {
    const restoreScriptPath = 'C:\\GameBooking\\restore-explorer.ps1'
    if (fs.existsSync(restoreScriptPath)) {
      exec(`powershell -ExecutionPolicy Bypass -File "${restoreScriptPath}"`, (err) => {
        if (err) console.error('[KIOSK] Explorer restore error:', err)
        // Ilova baribir restart bo‘ladi, bu faqat xavfsizlik uchun
        app.quit()
      })
      return { ok: true }
    } else {
      console.error('[KIOSK] restore-explorer.ps1 topilmadi')
      app.quit()
      return { ok: false, error: 'restore-explorer.ps1 topilmadi' }
    }
  } catch (err) {
    console.error('[KIOSK] close-app xatolik:', err)
    app.quit()
    return { ok: false, error: err.message }
  }
})

// --- Yangi Window yaratish ---
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    kiosk: false,
    alwaysOnTop: false,
    frame: true,
    fullscreen: false,
    closable: true,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false
    }
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape') {
      console.log('🔓 ESC bosildi – kiosk mode off')
      mainWindow.setKiosk(false)
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  patchCSP()
  electronApp.setAppUserModelId('com.electron')
  registerHotkeyHandlers()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  registerGameHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
