// src/preload/index.js

import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { io } from 'socket.io-client'

// --- SOCKET ulanish (localhost yoki admin IP) ---
const socket = io('http://192.168.1.10:3000', {
  transports: ['websocket'],
  reconnection: true
})

// --- API obyekt: SOCKET + IPC funksiyalar ---
const api = {
  // --- SOCKET funksiyalari ---
  socket: {
    on: (...args) => socket.on(...args),
    off: (...args) => socket.off(...args),
    emit: (...args) => socket.emit(...args),
    connected: () => socket.connected,
    id: () => socket.id
  },

  // --- IPC funksiyalari ---
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),

  // --- getIcon: exe path uchun icon olish ---
  getIcon: async (exePath) => {
    try {
      const res = await ipcRenderer.invoke('extract-save-icon', exePath)
      return res.icon
    } catch {
      return '/icons/default-icon.png'
    }
  },

  // --- Fayl mavjudligini tekshirish ---
  checkPathExists: async (path) => {
    try {
      return await ipcRenderer.invoke('check-path-exists', path)
    } catch {
      return false
    }
  },

  // --- O‘yinni ishga tushirish ---
  runGame: async (exePath) => {
    try {
      return await ipcRenderer.invoke('run-game', exePath)
    } catch (err) {
      return Promise.reject(err)
    }
  },

  // --- MAC address olish ---
  getMac: async () => {
    try {
      return await ipcRenderer.invoke('get-mac')
    } catch {
      return null
    }
  }
}

// --- Expose faqat bitta marta va contextIsolation rejimida ---
try {
  if (process.contextIsolated) {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } else {
    // Fallback (dev/prod uchun)
    if (!window.api) window.api = api
    if (!window.electron) window.electron = electronAPI
  }
} catch (err) {
  console.error('❌ Preload expose error:', err)
}
