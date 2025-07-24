import React, { useState } from 'react'

export default function OwnerPasswordModal({ visible, onSubmit, onClose }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!visible) return null

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const ok = await onSubmit(password)
      if (!ok) {
        setError('❌ Неверный пароль')
      } else {
        setPassword('')
        setError('')
        onClose()
      }
    } catch (err) {
      setError('Xatolik yuz berdi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.7)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div
        style={{
          background: '#1a1b29',
          borderRadius: 12,
          padding: 32,
          minWidth: 360,
          boxShadow: '0 0 20px rgba(0,0,0,0.4)',
          color: 'white',
          position: 'relative'
        }}
      >
        {/* X tugmasi */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'none',
            border: 'none',
            color: '#ccc',
            fontSize: 22,
            cursor: 'pointer'
          }}
        >
          ×
        </button>

        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Введите пароль владельца</h2>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль"
          style={{
            padding: 10,
            width: '100%',
            borderRadius: 6,
            border: `1px solid ${error ? '#f87171' : '#333'}`,
            background: '#111',
            color: '#fff'
          }}
        />

        {error && <div style={{ color: '#f87171', marginTop: 8, fontSize: 14 }}>{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            marginTop: 16,
            background: 'linear-gradient(to right, #3b82f6, #60a5fa)',
            padding: '10px 20px',
            borderRadius: 8,
            color: '#fff',
            width: '100%',
            fontWeight: 'bold',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Проверка...' : 'Войти'}
        </button>
      </div>
    </div>
  )
}
