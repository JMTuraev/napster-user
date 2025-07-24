import React, { useEffect, useState } from 'react'
import socket from './socket'

import LockScreen from './pages/LockScreen'
import GamesPage from './pages/GamesPage'
// import User from './pages/User' // kerak bo'lsa

export default function App() {
  const [locked, setLocked] = useState(true)
  const [mac, setMac] = useState(null)

  useEffect(() => {
    let myMac = null

    // MAC-ni olamiz va status so‘raymiz
    window.api.getMac().then((addr) => {
      setMac(addr)
      myMac = addr
      if (addr) {
        socket.emit('get-status', addr)
      }
    })

    // STATUS event — faqat o'z MAC uchun
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

    return () => {
      socket.off('status', handleStatus)
      socket.off('lock', handleLock)
      socket.off('unlock', handleUnlock)
    }
  }, [])

  if (locked) return <LockScreen />
  return <GamesPage />
}
