// src/socket.js
import { io } from 'socket.io-client'

// SOCKET ulanish (admin yoki localhost IP/port)
const socket = io('http://192.168.1.10:3000', {
  transports: ['websocket'],
  reconnection: true
})

// --- MAC addressni olish va socket orqali yuborish ---
export function sendMacOnce() {
  if (!window.api || !window.api.getMac) {
    console.error('window.api.getMac topilmadi!')
    return
  }
  window.api.getMac().then((mac) => {
    if (!mac) {
      console.error('MAC topilmadi')
      return
    }
    socket.emit('new-user', { mac })
    console.log('📤 [DEV] MAC yuborildi:', mac)
  })
}

// default export — socket o‘zi
export default socket
