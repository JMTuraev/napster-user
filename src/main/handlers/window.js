import { BrowserWindow } from 'electron'
import { join } from 'path' // ⬅️ qo'shildi
import { wireKioskGuards } from './kioskGuards.js'

export function createWindow({ icon, isDev }) {
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
      devTools: isDev
    }
  })

  wireKioskGuards(mainWindow, { isDev })
  return mainWindow
}
