// src/renderer/components/HotkeyPassword.jsx
import React, { useEffect, useRef, useState } from 'react'
import OwnerPasswordModal from './OwnerPasswordModal'
import socket from '../socket'

// --- fallback local parol uchun --- //
const LOCAL_PASS_KEY = 'ownerPassword'
const DEFAULT_PASS = '102030'
const getLocalPass = () => localStorage.getItem(LOCAL_PASS_KEY) || DEFAULT_PASS
const setLocalPass = (pass) => localStorage.setItem(LOCAL_PASS_KEY, pass)

export default function HotkeyPassword() {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const openedRef = useRef(false) // modalni ko‘p marta ochilishidan saqlaydi

  useEffect(() => {
    const handleKey = (e) => {
      // Ctrl+Alt+P va takroriy bosishlardan himoya
      if (e.ctrlKey && e.altKey && e.code === 'KeyP') {
        e.preventDefault()
        if (openedRef.current) return
        openedRef.current = true
        setVisible(true)
        setError(null)
      }
    }

    window.addEventListener('keydown', handleKey)

    // Admindan parol yangilansa — localga yozamiz
    socket.on('update-owner-password', ({ password }) => {
      setLocalPass(password)
      console.log('🟢 Admin paroli yangilandi (localga saqlandi)')
    })

    return () => {
      window.removeEventListener('keydown', handleKey)
      socket.off('update-owner-password')
    }
  }, [])

  const closeModal = () => {
    setVisible(false)
    setError(null)
    openedRef.current = false
  }

  // --- Parolni avval localdan, keyin admindan tekshirish ---
  const handleSubmit = async (enteredPassword) => {
    setLoading(true)
    setError(null)

    try {
      // 1) Local tekshiruv
      if (enteredPassword === getLocalPass()) {
        await switchToAdminWelcome()
        return true
      }

      // 2) Server orqali tekshiruv (socket) — 1.5s timeout
      const ok = await new Promise((resolve) => {
        let settled = false
        const to = setTimeout(() => {
          if (!settled) {
            settled = true
            setError('Сервер недоступен. Повторите попытку.')
            resolve(false)
          }
        }, 1500)

        socket.emit('check-owner-password', { password: enteredPassword }, async (response) => {
          if (settled) return
          clearTimeout(to)
          settled = true

          if (response?.ok) {
            // Kelajakda offline ishlashi uchun localga saqlaymiz
            setLocalPass(enteredPassword)
            resolve(true)
          } else {
            setError('Пароль неверный. Попробуйте снова.')
            resolve(false)
          }
        })
      })

      if (ok) {
        await switchToAdminWelcome()
        return true
      }
      return false
    } finally {
      setLoading(false)
    }
  }

  async function switchToAdminWelcome() {
    try {
      if (window.api?.kiosk?.switchToAdmin) {
        // 🔑 ASOSIY: app-ni YOPMASDAN Welcome/Sign-in ekranga o'tish
        await window.api.kiosk.switchToAdmin()
        // Amalda sessiya disconnect bo'ladi; baribir modal yopamiz
        closeModal()
      } else {
        setError('API mavjud emas: window.api.kiosk.switchToAdmin')
      }
    } catch (e) {
      console.error('switchToAdmin xato:', e)
      setError('Xatolik yuz berdi. Qaytadan urinib ko‘ring.')
    }
  }

  return (
    <OwnerPasswordModal
      visible={visible}
      onSubmit={handleSubmit}
      onClose={closeModal}
      loading={loading}
      error={error}
    />
  )
}
