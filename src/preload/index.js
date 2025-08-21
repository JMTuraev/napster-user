// src/preload/index.js
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { io } from 'socket.io-client'

// --- Socket.io ---
const socket = io('http://192.168.1.10:3000', {
  transports: ['websocket'],
  reconnection: true
})

const api = {
  // --- SWITCH USER (app yopilmaydi) ---
  kiosk: {
    switchToAdmin: () => ipcRenderer.invoke('kiosk:switch-to-admin'),
    switchToGamer: () => ipcRenderer.invoke('kiosk:switch-to-gamer'),
    // ixtiyoriy: qo'lda bo'shatish/tiklash
    relax: () => ipcRenderer.invoke('kiosk:relax-full'),
    restore: () => ipcRenderer.invoke('kiosk:restore-full')
  },

  // --- SOCKET ---
  socket: {
    on: (...args) => socket.on(...args),
    off: (...args) => socket.off(...args),
    emit: (...args) => socket.emit(...args),
    connected: () => socket.connected,
    id: () => socket.id
  },

  // --- Generic IPC ---
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),

  // --- Icons / fayl util ---
  getIcon: async (exePath) => {
    try {
      const res = await ipcRenderer.invoke('extract-save-icon', exePath)
      return res?.icon ?? '/icons/default-icon.png'
    } catch {
      return '/icons/default-icon.png'
    }
  },

  checkPathExists: async (path) => {
    try {
      return await ipcRenderer.invoke('check-path-exists', path)
    } catch {
      return false
    }
  },

  // --- Har qanday .exe ni kiosk-ruh bilan ishga tushirish ---
  runExe: (opts) => ipcRenderer.invoke('kiosk:run-exe', opts),

  // --- MUVOFIQLIK: eski runGame(exePath) ham 'run-exe'ga o‘raymiz ---
  runGame: (exePath) => ipcRenderer.invoke('kiosk:run-exe', { path: exePath }),

  getMac: async () => {
    try {
      return await ipcRenderer.invoke('get-mac')
    } catch {
      return null
    }
  },

  // --- Alt+Tab -> JSON (exePath bilan) ---
  altTab: {
    list: () => ipcRenderer.invoke('altTab:list'),
    activate: (hwnd) => ipcRenderer.invoke('altTab:activate', hwnd), // hwnd fallback
    activateByPid: (pid) => ipcRenderer.invoke('altTab:activateByPid', pid), // pid
    activateSmart: (payload) => ipcRenderer.invoke('altTab:activateSmart', payload), // {pid, hwnd, title}
    activateDiag: (payload) => ipcRenderer.invoke('altTab:activateDiag', payload) // diag
  }
}

try {
  if (process.contextIsolated) {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } else {
    // Fallback (agar contextIsolation=false bo‘lsa)
    if (!window.api) window.api = api
    if (!window.electron) window.electron = electronAPI
  }
} catch (err) {
  console.error('❌ Preload expose error:', err)
}
