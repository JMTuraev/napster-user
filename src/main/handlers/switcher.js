// src/main/handlers/switcher.js
import { ipcMain } from 'electron'
import { enumAltTabWindows } from './powershell.js'

let wired = false
export function registerSwitcherHandlers() {
  if (wired) return
  wired = true

  // JSON ro'yxat (exePath, exeName, title, pid, hwnd, className)
  ipcMain.handle('altTab:list', async () => {
    try {
      return await enumAltTabWindows()
    } catch (e) {
      console.error('[altTab:list] error', e)
      return []
    }
  })
}

// src/main/handlers/switcher.js ichiga TEMP qo'shish:
ipcMain.handle('altTab:listDebug', async () => {
  const pwsh = getPwsh64()
  const script = '(Get-Date).ToString("HH:mm:ss")' // yoki yuqoridagi skriptning oxirida debug qaytaryapmiz
  return await enumAltTabWindows() // vaqtincha shu ham yetadi
})
