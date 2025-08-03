import React, { useEffect, useState } from 'react'
import OwnerPasswordModal from './OwnerPasswordModal'
import socket from '../socket'

// --- fallback local parol uchun --- //
const LOCAL_PASS_KEY = 'ownerPassword'
const DEFAULT_PASS = '102030'
const getLocalPass = () => {
  const p = localStorage.getItem(LOCAL_PASS_KEY)
  return p ? p : DEFAULT_PASS
}
const setLocalPass = (pass) => localStorage.setItem(LOCAL_PASS_KEY, pass)

export default function HotkeyPassword() {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const handleKey = (e) => {
      if (e.ctrlKey && e.altKey && e.code === 'KeyP') {
        setVisible(true)
        setError(null)
      }
    }
    window.addEventListener('keydown', handleKey)

    socket.on('update-owner-password', ({ password }) => {
      setLocalPass(password)
      console.log('🟢 Admindan yangi parol qabul qilindi va saqlandi:', password)
    })

    return () => {
      window.removeEventListener('keydown', handleKey)
      socket.off('update-owner-password')
    }
  }, [])

  // --- Parolni avval localdan, so'ng admindan tekshirish ---
  const handleSubmit = (enteredPassword) => {
    setLoading(true)
    setError(null)

    return new Promise((resolve) => {
      // 1. Local pass bilan tekshir
      if (enteredPassword === getLocalPass()) {
        setLoading(false)
        if (window.api?.closeApp) window.api.closeApp()
        return resolve(true)
      }

      let settled = false
      // 2. Timeout: agar 3 sekund ichida javob kelmasa xatolik
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true
          setLoading(false)
          setError('Сервер недоступен. Повторите попытку.')
          resolve(false)
        }
      }, 1500)

      // 3. Admindan so‘rash (socket)
      socket.emit('check-owner-password', { password: enteredPassword }, async (response) => {
        if (!settled) {
          clearTimeout(timeout)
          settled = true
          setLoading(false)
          if (response?.ok) {
            setLocalPass(enteredPassword)
            if (window.api?.closeApp) await window.api.closeApp()
            resolve(true)
          } else {
            setError('Пароль неверный. Попробуйте снова.')
            resolve(false)
          }
        }
      })
    })
  }

  return (
    <OwnerPasswordModal
      visible={visible}
      onSubmit={handleSubmit}
      onClose={() => {
        setVisible(false)
        setError(null)
      }}
      loading={loading}
      error={error}
    />
  )
}
