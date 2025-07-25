// src/App.jsx
import React, { useEffect, useState } from 'react'
import socket from './socket'

import LockScreen from './pages/LockScreen'
import GamesPage from './pages/GamesPage'
import HotkeyPassword from './pages/HotkeyPassword'

export default function App() {
  const [locked, setLocked] = useState(true)
  const [mac, setMac] = useState(null)

  useEffect(() => {
    let myMac = null

    // 💻 MAC addressni olish va status so‘rash
    window.api.getMac().then((addr) => {
      setMac(addr)
      myMac = addr
      if (addr) socket.emit('get-status', addr)
    })

    // 🔒 Qulflash / Qulfdan chiqarish
    const handleStatus = (data) => {
      if (data.mac === myMac) setLocked(data.locked)
    }
    const handleLock = (addr) => {
      if (addr === myMac) setLocked(true)
    }
    const handleUnlock = (addr) => {
      if (addr === myMac) setLocked(false)
    }

    socket.on('status', handleStatus)
    socket.on('lock', handleLock)
    socket.on('unlock', handleUnlock)

    // ✅ Yangi fon rasmni yangilash (admin tomonidan yuborilsa)
    const handleBackgroundUpdate = ({ url }) => {
      console.log('🖼️ Yangi fon:', url)
      if (url) {
        console.log('🖼️ Yangi fon:', url)
        document.body.style.backgroundImage = `url(${url})`
        document.body.style.backgroundSize = 'cover'
        document.body.style.backgroundPosition = 'center'
        document.body.style.backgroundRepeat = 'no-repeat'
      }
    }

    socket.on('bg-update', handleBackgroundUpdate) // 🟢 nomi to‘g‘ri

    // 🧹 Tozalash
    return () => {
      socket.off('status', handleStatus)
      socket.off('lock', handleLock)
      socket.off('unlock', handleUnlock)
      socket.off('bg-update', handleBackgroundUpdate) // 🟢 to‘g‘ri nom
    }
  }, [])

  return (
    <>
      {locked ? <LockScreen /> : <GamesPage />}
      <HotkeyPassword />
    </>
  )
}
