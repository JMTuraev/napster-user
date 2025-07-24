// src/renderer/pages/LockScreen.jsx

import React from 'react'

export default function LockScreen() {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'radial-gradient(ellipse at center, #1a1a1a 70%, #000 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        color: '#fff',
        fontSize: 38,
        fontWeight: 'bold',
        letterSpacing: 2
      }}
    >
      <div>
        🚫 <span style={{ color: '#f43' }}>LOCKED</span>
      </div>
      <div
        style={{
          marginTop: 32,
          fontSize: 20,
          fontWeight: 400,
          letterSpacing: 1,
          opacity: 0.7
        }}
      >
        Administrator tomonidan vaqt tugadi.
        <br />
        <span style={{ fontSize: 16 }}>Kutishingiz yoki Admin bilan bog‘lanishingiz kerak.</span>
      </div>
    </div>
  )
}
