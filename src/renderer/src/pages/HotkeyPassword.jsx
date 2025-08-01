// user/src/pages/HotkeyPassword.jsx
import React, { useEffect, useState } from 'react'
import OwnerPasswordModal from './OwnerPasswordModal'
import socket from '../socket'

export default function HotkeyPassword() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleKey = (e) => {
      if (e.ctrlKey && e.altKey && e.code === 'KeyP') {
        setVisible(true)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // socket orqali parolni tekshiradi

  const handleSubmit = (enteredPassword) => {
    return new Promise((resolve) => {
      socket.emit('check-owner-password', { password: enteredPassword }, async (response) => {
        if (response?.ok) {
          // Parol to‘g‘ri bo‘lsa, ilovani IPC orqali yopamiz:
          if (window.api?.closeApp) {
            await window.api.closeApp()
          }
        }
        resolve(response?.ok)
      })
    })
  }

  return (
    <OwnerPasswordModal
      visible={visible}
      onSubmit={handleSubmit}
      onClose={() => setVisible(false)}
    />
  )
}
