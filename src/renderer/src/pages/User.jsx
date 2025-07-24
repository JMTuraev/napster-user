import React, { useEffect, useState } from 'react'

function UserPage() {
  const [status, setStatus] = useState('bloklangan')

  useEffect(() => {
    // Socket orqali statusni olish
    window.api.socket.on('status-update', (newStatus) => {
      setStatus(newStatus)
    })

    return () => {
      window.api.socket.off('status-update')
    }
  }, [])

  return (
    <div>
      <h1>STATUS: 
        <span style={{ color: status === 'ruxsat' ? 'green' : 'red', marginLeft: 10 }}>
          {status === 'ruxsat' ? '✅ Ruxsat berilgan' : '🔴 Bloklangan'}
        </span>
      </h1>
    </div>
  )
}

export default UserPage
