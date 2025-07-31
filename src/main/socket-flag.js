// src/main/socket-flag.js

import { io } from 'socket.io-client'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import os from 'os'
import { getEthernetMac } from './utils/network.js'
// 1. Asosiy path va fayllar
const baseDir = 'C:\\GameBooking'
const flagPath = path.join(baseDir, 'user_stop.flag')
const userExeName = 'user.exe'

// 2. MAC addressni aniqlash (birinchi IPv4 bo'yicha)

const localMac = getEthernetMac()

console.log('[SOCKET-FLAG] LOCAL MAC:', localMac)

// 3. Admin socket serverga ulanamiz (manzilini moslang!)
const ADMIN_SOCKET_URL = 'http://192.168.1.10:3000' // <-- Admin server IP/portini to'g'rilang!
const socket = io(ADMIN_SOCKET_URL, {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
})

socket.on('connect', () => {
  console.log('[SOCKET-FLAG] Admin serverga ULANDI:', ADMIN_SOCKET_URL)
})
socket.on('disconnect', () => {
  console.log('[SOCKET-FLAG] Admin serverdan UZILDI')
})

// 4. LOCK event — flag yaratish va user.exe ni kill qilish
socket.on('lock', (mac) => {
  console.log('[SOCKET-FLAG] LOCK event keldi, target MAC:', mac, '| LOCAL MAC:', localMac)
  if (!mac || mac.toLowerCase() !== localMac) {
    console.log('[SOCKET-FLAG] MAC mos emas, hech nima qilinmadi.')
    return
  }
  try {
    fs.writeFileSync(flagPath, 'stopped')
    exec(`taskkill /im ${userExeName} /f`)
    console.log('[SOCKET-FLAG] LOCK: flag yaratildi, user.exe kill qilindi')
  } catch (e) {
    console.error('[SOCKET-FLAG] LOCK xatolik:', e)
  }
})

// 5. UNLOCK event — flagni o'chirish
socket.on('unlock', (mac) => {
  console.log('[SOCKET-FLAG] UNLOCK event keldi, target MAC:', mac, '| LOCAL MAC:', localMac)
  if (!mac || mac.toLowerCase() !== localMac) {
    console.log('[SOCKET-FLAG] MAC mos emas, hech nima qilinmadi.')
    return
  }
  try {
    if (fs.existsSync(flagPath)) {
      fs.unlinkSync(flagPath)
      console.log('[SOCKET-FLAG] UNLOCK: flag o‘chirildi, user.exe avtomatik qayta ochiladi')
    } else {
      console.log('[SOCKET-FLAG] UNLOCK: flag mavjud emas, hech nima o‘chmadi')
    }
  } catch (e) {
    console.error('[SOCKET-FLAG] UNLOCK xatolik:', e)
  }
})

// 6. Tashqi test uchun global funksiya (masalan, IPC orqali)
export function testFlagFuncs() {
  return {
    localMac,
    flagPath,
    flagExists: fs.existsSync(flagPath)
  }
}
