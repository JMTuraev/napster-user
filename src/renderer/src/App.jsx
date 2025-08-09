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
  const [bgUrl, setBgUrl] = useState(null)

  // 🧠 MAC address olish va status so‘rash.
  useEffect(() => {
    let myMac = null
    const onConnect = () => {
      if (myMac) socket.emit('new-user', { mac: myMac.toLowerCase() })
    }
    socket.on('connect', onConnect)

    window.api.getMac().then((addr) => {
      setMac(addr)
      myMac = addr
      if (addr) {
        socket.emit('new-user', { mac: addr.toLowerCase() }) // <<< RO‘YXATGA OLISH
        socket.emit('get-status', addr)
        socket.emit('client-connected', addr)
      }
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

    socket.on('status', handleStatus)
    socket.on('lock', handleLock)
    socket.on('unlock', handleUnlock)

    return () => {
      socket.off('connect', onConnect)
      socket.off('status', handleStatus)
      socket.off('lock', handleLock)
      socket.off('unlock', handleUnlock)
    }
  }, [])

  // 🖥️ Kompyuter raqami va font o‘lchamini olish (mac tayyor bo‘lgach)
  useEffect(() => {
    if (!mac) return

    const channel = `receive-pc-ui-${mac}`

    const handlePcUi = (data) => {
      if (data.mac !== mac) return

      console.log('📥 PC UI keldi:', data)
      if (typeof data.font_size === 'number') setFontSize(data.font_size)
      setPcNumber(data.show_number ? data.number || null : null)
    }

    socket.on(channel, handlePcUi)
    socket.emit('client-connected', mac)

    return () => {
      socket.off(channel, handlePcUi)
    }
  }, [mac])
  // 🎨 Fon rasmi olish: 1) dastlabki yuklanishda 2) socket orqali kelganda
  useEffect(() => {
    // Dastlabki fon holatini so‘rash
    socket.emit('get-selected-bg')

    // Admin’dan kelgan signal asosida fon yangilash
    const handleSelectedBg = (bg) => {
      console.log('✅ Tanlangan fon keldi:', bg)
      setBgUrl(bg?.url || null)
    }

    const handleBgUpdate = (data) => {
      console.log('🆕 bg-update signal:', data)
      setBgUrl(data?.url || null)
    }

    socket.on('selected-bg-data', handleSelectedBg)
    socket.on('bg-update', handleBgUpdate)

    return () => {
      socket.off('selected-bg-data', handleSelectedBg)
      socket.off('bg-update', handleBgUpdate)
    }
  }, [])

  // 🖼️ UI chiqishi
  return (
    <div
      style={{
        backgroundImage: bgUrl ? `url(${bgUrl})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden'
      }}
    >
      {/* 💻 Kompyuter raqami UI */}
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

      {/* 🔐 Lock yoki Games sahifa */}
      {locked ? <LockScreen /> : <GamesPage />}
      <HotkeyPassword />
    </div>
  )
}
