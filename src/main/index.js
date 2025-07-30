import { app, shell, BrowserWindow, ipcMain, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import os from 'os'
import { registerGameHandlers } from './gameHandlers.js'
import { registerHotkeyHandlers } from './hotkeyHandler.js'

// --- CSP PATCH: SOCKET.IO va boshqa kerakli resurslar uchun ---
function patchCSP() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const cspDirectives = [
      "default-src 'self'",
      "img-src 'self' data: http://localhost:3000 http://192.168.1.10:5173",
      "connect-src 'self' ws://localhost:3000 http://localhost:3000 ws://192.168.1.10:3000 http://192.168.1.10:3000 ws://192.168.0.100:3000 http://192.168.0.100:3000",
      "script-src 'self' 'unsafe-inline'", // Faqat dev uchun
      "style-src 'self' 'unsafe-inline'" // Inline style qo‘llab-quvvatlansin
    ].join('; ')

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspDirectives]
      }
    })
  })
}

// === Faqat Ethernet MAC olish ===
function getStrictEthernetMac() {
  const nets = os.networkInterfaces()
  console.log('🌐 [DEBUG] Interfeyslar:', nets)

  for (const [interfaceName, addresses] of Object.entries(nets)) {
    if (!/^ethernet|eth\d*|enp\d*|lan|local area connection/i.test(interfaceName)) continue

    for (const net of addresses) {
      if (
        net.family === 'IPv4' &&
        !net.internal &&
        net.mac &&
        net.mac !== '00:00:00:00:00:00' &&
        net.address
      ) {
        console.log(`✅ Ethernet MAC topildi [${interfaceName}]:`, net.mac)
        return net.mac.toLowerCase()
      }
    }
  }

  console.warn('⚠️ Ethernet MAC topilmadi')
  return null
}

ipcMain.handle('get-mac', () => getStrictEthernetMac())

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

  // ESC tugmasi bilan kioskdan chiqish
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape') {
      console.log('🔓 ESC bosildi – kiosk mode off')
      mainWindow.setKiosk(false)
    }
  })

  // Tashqi havolalarni browserda ochish
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Dev yoki prod yuklash
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// --- App tayyor bo‘lsa ---
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

// --- Barcha oynalar yopilsa, ilovani to‘xtatish ---
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
