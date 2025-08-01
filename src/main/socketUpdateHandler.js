// src/socket/socketUpdateHandler.js
import { io } from 'socket.io-client'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import http from 'http'
import { spawn } from 'child_process' // <-- exec emas, spawn kerak!
// ⚠️ Asosiy o‘zgarish: Electron main processdan app obyektini import qilish
import { app } from 'electron' // <-- faqat main process! Agar preload/renderer bo‘lsa, IPC bilan oling

// 📦 1️⃣ Socketga ulanamiz
const socket = io('http://192.168.1.10:3000', {
  transports: ['websocket'],
  reconnection: true
})

// 🔄 2️⃣ Ulanish holati
socket.on('connect', () => {
  console.log('[UPDATE] 🟢 SOCKET ULANDI | ID:', socket.id)
})
socket.on('disconnect', () => {
  console.log('[UPDATE] 🔴 SOCKET UZILDI')
})

// 🚀 3️⃣ Update faylni LINK orqali yuklab olish
socket.on('receive-update', async ({ fileName, url }) => {
  console.log('[UPDATE] ⚡ Update kelib tushdi:', fileName)

  try {
    // 🗂 ENDI: Faqat userData papkada (universal va yozishga ruxsatli)
    const updatesDir = path.join(app.getPath('userData'), 'updates')
    if (!fs.existsSync(updatesDir)) {
      fs.mkdirSync(updatesDir, { recursive: true })
      console.log('[UPDATE] 📁 Papka yaratildi:', updatesDir)
    } else {
      console.log('[UPDATE] 📁 Papka mavjud:', updatesDir)
    }

    const filePath = path.join(updatesDir, fileName)
    const file = fs.createWriteStream(filePath)

    console.log('[UPDATE] ⬇️ Yuklab olinmoqda:', url)

    http
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          console.error(`[UPDATE] ❌ HTTP xatolik: ${res.statusCode}`)
          return
        }

        res.pipe(file)

        file.on('finish', () => {
          file.close(() => {
            console.log('[UPDATE] ✅ Fayl yuklab olindi:', filePath)

            // 🖥 Installer'ni ishga tushirish (mustaqil child process sifatida)
            const child = spawn(filePath, [], { detached: true, stdio: 'ignore' })
            child.unref() // parent processdan mustaqil bo‘lishi uchun

            // 🛑 Ilovani avtomatik yopish (installer alert chiqmaydi!)
            app.quit()
          })
        })
      })
      .on('error', (err) => {
        console.error('[UPDATE] ❌ Yuklab olishda xatolik:', err.message)
      })
  } catch (err) {
    console.error('[UPDATE] ❌ Umumiy xatolik:', err.message)
  }
})
