import React, { useEffect, useState } from 'react'
import socket from './socket'

export default function App() {
  const [mac, setMac] = useState(null)
  const [locked, setLocked] = useState(true)

  useEffect(() => {
    window.api.getMac().then((mac) => setMac(mac))
  }, [])

  useEffect(() => {
    if (!mac) return

    // 👇 MUHIM: MAC-ni serverga bir marta yuboramiz
    socket.emit('new-user', { mac })
    console.log('📤 [USER] MAC serverga yuborildi:', mac)

    // Lock/unlock eventlar
    const onLock = (msgMac) => {
      if (msgMac === mac) setLocked(true)
    }
    const onUnlock = (msgMac) => {
      if (msgMac === mac) {
        setLocked(false)
        if (window.api?.appQuit) {
          window.api.appQuit()
        } else if (window?.close) {
          window.close()
        }
      }
    }
    socket.on('lock', onLock)
    socket.on('unlock', onUnlock)
    return () => {
      socket.off('lock', onLock)
      socket.off('unlock', onUnlock)
    }
  }, [mac])

  return (
    <div>
      <h2>MAC: {mac || '...'}</h2>
      <h2 style={{ color: locked ? 'red' : 'green' }}>{locked ? 'LOCKED' : 'UNLOCKED'}</h2>
      {/* Qolgan UI... shu yerda */}
    </div>
  )
}
