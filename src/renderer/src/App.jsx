// src/App.js
import React, { useEffect, useState } from 'react'
import socket from './socket'

// Sahifalarni import qilamiz
import LockScreen from './pages/LockScreen'
import GamesPage from './pages/GamesPage'
import User from './pages/User'

export default function App() {
  const [locked, setLocked] = useState(true) // Dastlab bloklangan

  useEffect(() => {
    socket.on('lock', (mac) => {
      setLocked(true)
      console.log('LOCK: ', mac)
    })
    socket.on('unlock', (mac) => {
      setLocked(false)
      console.log('UNLOCK: ', mac)
    })
    return () => {
      socket.off('lock')
      socket.off('unlock')
    }
  }, [])

  if (locked) {
    // Faqat LockScreen sahifasini ko‘rsatadi
    return <LockScreen />
  }

  // Bu yerda unlocked bo‘lsa asosiy UI chiqadi
  return (
    <div>
      {/* Masalan, asosiy sahifalar */}
      <GamesPage />
      {/* User paneli yoki boshqa komponentlar ham bo‘lishi mumkin */}
      {/* <User /> */}
    </div>
  )
}
