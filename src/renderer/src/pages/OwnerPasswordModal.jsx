// src/renderer/components/OwnerPasswordModal.jsx
import React, { useEffect, useRef, useState } from 'react'

export default function OwnerPasswordModal({
  visible,
  onSubmit, // async (password) => boolean
  onClose, // () => void
  loading = false,
  error = '' // tashqaridan keladigan xabar: 'Пароль неверный' va h.k.
}) {
  const [password, setPassword] = useState('')
  const inputRef = useRef(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (visible) {
      setPassword('')
      setSubmitting(false)
      // auto-focus
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [visible])

  if (!visible) return null

  const canSubmit = !submitting && !loading && password.length > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const ok = await onSubmit(password)
      if (ok) {
        setPassword('')
        onClose?.()
      } else {
        // xato matn tashqaridan `error` props orqali keladi
      }
    } finally {
      setSubmitting(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
    // ESC bilan yopishni istamasangiz, bu joyni o'chirmang.
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose?.()
    }
  }

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        style={{
          background: '#1a1b29',
          borderRadius: 12,
          padding: 24,
          minWidth: 360,
          maxWidth: '90vw',
          boxShadow: '0 0 20px rgba(0,0,0,0.4)',
          color: 'white',
          position: 'relative',
          outline: 'none'
        }}
      >
        {/* X tugmasi */}
        <button
          onClick={onClose}
          disabled={loading || submitting}
          aria-label="Yopish"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: 'none',
            border: 'none',
            color: '#ccc',
            fontSize: 22,
            cursor: 'pointer',
            opacity: loading || submitting ? 0.5 : 1
          }}
        >
          ×
        </button>

        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Введите пароль владельца</h2>

        <input
          ref={inputRef}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль"
          disabled={loading || submitting}
          style={{
            padding: 10,
            width: '100%',
            borderRadius: 6,
            border: `1px solid ${error ? '#f87171' : '#333'}`,
            background: '#111',
            color: '#fff'
          }}
        />

        {!!error && <div style={{ color: '#f87171', marginTop: 8, fontSize: 14 }}>{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            marginTop: 16,
            background: 'linear-gradient(to right, #3b82f6, #60a5fa)',
            padding: '10px 20px',
            borderRadius: 8,
            color: '#fff',
            width: '100%',
            fontWeight: 'bold',
            opacity: canSubmit ? 1 : 0.6,
            cursor: canSubmit ? 'pointer' : 'not-allowed'
          }}
        >
          {loading || submitting ? 'Проверка...' : 'Войти'}
        </button>
      </div>
    </div>
  )
}
