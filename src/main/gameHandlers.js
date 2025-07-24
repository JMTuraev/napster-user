import { ipcMain } from 'electron'
import fs from 'fs'
import { execFile } from 'child_process'
import { getIconBuffer } from '../utils/getIcon.js'
import { saveIcon } from '../utils/saveIcon.js'

let handlersRegistered = false

export function registerGameHandlers() {
  if (handlersRegistered) return
  handlersRegistered = true

  // 1️⃣ Fayl mavjudligini tekshirish (IPC)
  ipcMain.handle('check-path-exists', async (_event, filePath) => {
    try {
      return fs.existsSync(filePath)
    } catch (err) {
      console.error('[check-path-exists] xato:', err)
      return false
    }
  })

  // 2️⃣ O‘yinni ishga tushirish (IPC)
  ipcMain.handle('run-game', async (_event, filePath) => {
    return new Promise((resolve, reject) => {
      try {
        if (!fs.existsSync(filePath)) {
          reject('Fayl topilmadi')
          return
        }
        execFile(filePath, (err) => {
          if (err) reject(err.message)
          else resolve('OK')
        })
      } catch (err) {
        reject('Ishga tushirishda xatolik')
      }
    })
  })

  // 3️⃣ Exe fayldan icon ajratib, saqlab, path qaytarish (IPC)
  ipcMain.handle('extract-save-icon', async (_event, exePath) => {
    try {
      const iconBuf = getIconBuffer(exePath)
      if (iconBuf) {
        const iconPath = saveIcon(iconBuf, exePath) // Bu faqat bir marta yozadi
        return { success: true, icon: iconPath }
      } else {
        return { success: false, icon: '/icons/default-icon.png', error: 'Icon ajratib bo‘lmadi' }
      }
    } catch (err) {
      return { success: false, icon: '/icons/default-icon.png', error: err.message }
    }
  })
}
