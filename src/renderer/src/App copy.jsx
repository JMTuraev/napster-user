// src/App.js
import React, { useEffect, useState } from 'react'
import socket from './socket'

export default function App() {
  const [locked, setLocked] = useState(true) // Dastlab bloklangan

  useEffect(() => {
    // LOCK holati
    socket.on('lock', (mac) => {
      // Macni tekshirsa ham bo‘ladi, agar bir nechta user bo‘lsa
      setLocked(true)
      console.log('LOCK: ', mac)
    })
    // UNLOCK holati
    socket.on('unlock', (mac) => {
      setLocked(false)
      console.log('UNLOCK: ', mac)
    })
    // Tozalash
    return () => {
      socket.off('lock')
      socket.off('unlock')
    }
  }, [])

  return (
    <div>
      <h2>
        Holat:{' '}
        <span style={{ color: locked ? 'red' : 'green' }}>{locked ? 'LOCKED' : 'UNLOCKED'}</span>
      </h2>
      {/* Bu yerga o‘zing istagan UI ni kiritasan */}
    </div>
  )
}
