import { io } from 'socket.io-client'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import os from 'os'

// DIAGNOSTIKA BOSHI
console.log('[UPDATE] socketUpdateHandler.js YUKLANDI')

// 1. Socketga ulanadi
const SOCKET_URL = 'http://192.168.1.10:3000'
const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  reconnection: true
})

socket.on('connect', () => {
  console.log(`[UPDATE] 🟢 SOCKET ULANDI: ${SOCKET_URL} | ID: ${socket.id}`)
})

socket.on('disconnect', () => {
  console.log('[UPDATE] 🔴 SOCKET UZILDI')
})

// 2. Update signalini kutadi
socket.on('receive-update', async ({ fileName, fileData }) => {
  console.log(`[UPDATE] ⚡ receive-update SIGNAL QABUL QILINDI:`, fileName)
  try {
    // DIAGNOSTIKA: PATH QAYERGA YOZILMOQDA?
    // 1. App papkasiga
    const updatesDir = path.resolve('updates')
    // 2. HOME folderga (ko‘proq permission uchun, istalgan joyga yozib test qiling)
    // const updatesDir = path.join(os.homedir(), 'napster-updates')

    console.log('[UPDATE] Papka yaratilyapti:', updatesDir)
    if (!fs.existsSync(updatesDir)) {
      fs.mkdirSync(updatesDir, { recursive: true })
      console.log('[UPDATE] Papka yaratildi:', updatesDir)
    } else {
      console.log('[UPDATE] Papka allaqachon mavjud:', updatesDir)
    }

    const installerPath = path.join(updatesDir, fileName)
    console.log('[UPDATE] Fayl Yoziladi:', installerPath)
    fs.writeFileSync(installerPath, Buffer.from(fileData, 'base64'))
    console.log('[UPDATE] ✅ Fayl yozildi:', installerPath)

    // Fayl o‘qiladimi?
    try {
      fs.accessSync(installerPath, fs.constants.R_OK)
      console.log('[UPDATE] Fayl o‘qilishi mumkin:', installerPath)
    } catch (e) {
      console.error('[UPDATE] Faylga ruxsat yo‘q:', e.message)
    }

    // 3️⃣ Installer’ni ishga tushiramiz
    exec(`"${installerPath}"`, (err) => {
      if (err) {
        console.error('[UPDATE] ❌ Installer ishga tushmadi:', err.message)
      } else {
        console.log('[UPDATE] 🚀 Installer ishga tushdi:', installerPath)
        // process.exit(0)
      }
    })
  } catch (err) {
    console.error('[UPDATE] Xatolik:', err.message)
  }
})
