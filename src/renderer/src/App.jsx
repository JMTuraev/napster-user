// src/App.jsx
import React, { useEffect, useState } from 'react'
import socket from './socket'

import LockScreen from './pages/LockScreen'
import GamesPage from './pages/GamesPage'
import HotkeyPassword from './pages/HotkeyPassword'

export default function App() {
  const [locked, setLocked] = useState(true)
  const [mac, setMac] = useState(null)
  const [pcNumber, setPcNumber] = useState(null)
  const [fontSize, setFontSize] = useState(36) // default font

  // 🔐 1-USEEFFECT: MAC olish va status listenerlari
  useEffect(() => {
    let myMac = null

    // 💻 MAC addressni olish va statusni so‘rash
    window.api.getMac().then((addr) => {
      console.log('📟 MAC USER:', addr)
      setMac(addr)
      myMac = addr
      if (addr) socket.emit('get-status', addr)
    })

    // 🔒 Status yangilanishi
    const handleStatus = (data) => {
      if (data.mac === myMac) setLocked(data.locked)
    }
    const handleLock = (addr) => {
      if (addr === myMac) setLocked(true)
    }
    const handleUnlock = (addr) => {
      if (addr === myMac) setLocked(false)
    }

    // 🖼️ Fon rasmni yangilash
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
    console.log('📡 Listening on:', channel)

    const handlePcUi = (data) => {
      console.log('📥 PC raqam keldi:', data)
      if (data.mac === mac) {
        setPcNumber(data.number || null)
        setFontSize(36)
      }
    }

    socket.on(channel, handlePcUi)

    return () => {
      socket.off(channel, handlePcUi)
    }
  }, [mac])

  // 🧪 Test tugma: send-number-pc signal yuboradi
  const handleSendNumber = () => {
    socket.emit('send-number-pc')
    console.log('📤 [Test] send-number-pc yuborildi')
  }

  return (
    <>
      {/* 💻 Kompyuter raqami ko‘rinadi */}
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

      {/* 🔐 Lock yoki o‘yin sahifasi */}
      {locked ? <LockScreen /> : <GamesPage />}
      <HotkeyPassword />

      {/* 🧪 TEST BUTTON */}
      <button
        onClick={handleSendNumber}
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          backgroundColor: '#007bff',
          color: '#fff',
          fontWeight: 'bold',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 20px',
          cursor: 'pointer',
          zIndex: 999
        }}
      >
        Send Number to All PCs
      </button>
    </>
  )
}
