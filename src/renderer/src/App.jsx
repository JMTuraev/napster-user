import React, { useEffect, useState } from 'react'
import socket from './socket'

import LockScreen from './pages/LockScreen'
import GamesPage from './pages/GamesPage'
import HotkeyPassword from './pages/HotkeyPassword'

export default function App() {
  const [locked, setLocked] = useState(true)
  const [mac, setMac] = useState(null)
  const [pcNumber, setPcNumber] = useState(null)
  const [fontSize, setFontSize] = useState(36)

  // 🔐 1-USEEFFECT: MAC olish va status listenerlari (O'ZGARTIRMAYMIZ)
  useEffect(() => {
    let myMac = null

    window.api.getMac().then((addr) => {
      setMac(addr)
      myMac = addr
      if (addr) socket.emit('get-status', addr)
    })

    const handleStatus = (data) => {
      if (data.mac === myMac) setLocked(data.locked)
    }
    const handleLock = (addr) => {
      if (addr === myMac) setLocked(true)
    }
    const handleUnlock = (addr) => {
      if (addr === myMac) setLocked(false)
    }

    const handleBackgroundUpdate = ({ url }) => {
      if (url) {
        document.body.style.backgroundImage = `url(${url})`
        document.body.style.backgroundSize = 'cover'
        document.body.style.backgroundPosition = 'center'
        document.body.style.backgroundRepeat = 'no-repeat'
      }
    }

    socket.on('status', handleStatus)
    socket.on('lock', handleLock)
    socket.on('unlock', handleUnlock)
    socket.on('bg-update', handleBackgroundUpdate)

    return () => {
      socket.off('status', handleStatus)
      socket.off('lock', handleLock)
      socket.off('unlock', handleUnlock)
      socket.off('bg-update', handleBackgroundUpdate)
    }
  }, [])

  // 🆕 2-USEEFFECT: PC raqamini olish
  useEffect(() => {
    if (!mac) return

    const channel = `receive-pc-ui-${mac}`
    const handlePcUiNumber = (data) => {
      if (data.mac === mac) {
        console.log('🖥️ Kompyuter raqami:', data)
        setPcNumber(data.number || null)
      }
    }

    socket.on(channel, handlePcUiNumber)
    return () => socket.off(channel, handlePcUiNumber)
  }, [mac])

  // 🆕 3-USEEFFECT: Shrift o‘lchamini alohida olish
  useEffect(() => {
    if (!mac) return

    const channel = `receive-pc-ui-${mac}`
    const handlePcUiFont = (data) => {
      if (data.mac === mac && typeof data.font_size === 'number') {
        console.log('🔠 Font o‘lchami:', data.font_size)
        setFontSize(data.font_size)
      }
    }

    socket.on(channel, handlePcUiFont)
    return () => socket.off(channel, handlePcUiFont)
  }, [mac])

  return (
    <>
      {/* 💻 Kompyuter raqami ko‘rsatish */}
      {pcNumber && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            color: '#fff',
            fontSize: `${fontSize}px`,
            fontWeight: 'bold',
            background: 'rgba(0,0,0,0.5)',
            padding: '4px 12px',
            borderRadius: '8px',
            zIndex: 999
          }}
        >
          № {pcNumber}
        </div>
      )}

      {locked ? <LockScreen /> : <GamesPage />}
      <HotkeyPassword />
    </>
  )
}
