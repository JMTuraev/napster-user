// src/main/hotkeyHandler.js

import { ipcMain, BrowserWindow } from 'electron'

export function registerHotkeyHandlers() {
  ipcMain.handle('minimize-app', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) win.minimize()
  })
}
