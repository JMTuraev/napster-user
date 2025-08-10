import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// ❗️MAVJUD IMPORTLARNI QOLDIRDIK
import { registerGameHandlers } from './gameHandlers.js'
import { registerHotkeyHandlers } from './hotkeyHandler.js'
import { getEthernetMac } from '../utils/network.js'
import './socketUpdateHandler.js'

// ✅ YANGI HANDLERS AGGREGATOR
import { patchCSP, createWindow, createRunExeIPC } from './handlers/index.js'

// MAC address IPC
ipcMain.handle('get-mac', () => getEthernetMac())

app.whenReady().then(() => {
  patchCSP()
  electronApp.setAppUserModelId('com.electron')

  registerHotkeyHandlers()
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  registerGameHandlers()

  // Oynani yaratish
  const win = createWindow({ icon, isDev: is.dev })
  createRunExeIPC()

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const w = createWindow({ icon, isDev: is.dev })
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
    // kiosk rejim: qo'lda boshqariladi
  }
})
