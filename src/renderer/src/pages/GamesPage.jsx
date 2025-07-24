import React, { useEffect, useState, useRef } from 'react'

export default function GamesPage() {
  const [allGames, setAllGames] = useState([])
  const [tabs, setTabs] = useState([])
  const [activeTabId, setActiveTabId] = useState(1)

  // O‘yinlar va tabs’ni faqat bir marta socketdan olib kelamiz
  useEffect(() => {
    window.api.socket.emit('get-tabs')
    window.api.socket.emit('get-games')

    // Faqat bir marta handler
    const handleGames = async (gamesList) => {
      // Har bir o‘yin uchun icon PNG faqat bir marta yaratiladi
      const gamesWithIcons = []
      for (const game of gamesList) {
        try {
          const exists = await window.api.checkPathExists(game.path)
          if (exists) {
            const iconName = game.exe.replace(/\.exe$/i, '') + '.png'
            const iconPath = `/icons/${iconName}`
            await window.api.getIcon(game.path) // faqat bir marta PNG yaratadi
            gamesWithIcons.push({ ...game, iconPath })
          }
        } catch {
          // ignore
        }
      }
      setAllGames(gamesWithIcons)
    }

    window.api.socket.on('games', handleGames)
    window.api.socket.on('tabs', setTabs)

    return () => {
      window.api.socket.off('games', handleGames)
      window.api.socket.off('tabs', setTabs)
    }
  }, [])

  // Har doim activeTabId bo‘yicha filter — renderda filter
  const games = allGames.filter((game) => game.tabId === activeTabId)

  // O‘yinni ishga tushirish
  const handleDoubleClick = (path) => {
    window.api.runGame(path).catch((err) => {
      window.alert?.('❌ O‘yin ishga tushmadi:\n' + err)
    })
  }

  return (
    <div style={{ padding: '24px 0 0 0', color: 'white', maxWidth: 1000, margin: '0 auto' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            style={{
              background: activeTabId === tab.id ? '#4a90e2' : '#222345',
              color: activeTabId === tab.id ? '#fff' : '#cdd2e3',
              border: 'none',
              borderRadius: 12,
              fontWeight: 600,
              padding: '8px 22px',
              fontSize: 16,
              boxShadow: activeTabId === tab.id ? '0 2px 12px #1a73e899' : 'none',
              cursor: 'pointer',
              transition: 'all 0.16s'
            }}
          >
            {tab.name}
          </button>
        ))}
      </div>
      {/* Games grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 28,
          width: '100%',
          justifyItems: 'center',
          alignItems: 'start',
          padding: 12,
          background: 'rgba(30,32,60,0.94)',
          borderRadius: 24,
          minHeight: 180,
          boxShadow: '0 4px 24px #1617253a'
        }}
      >
        {games.map((game) => (
          <div
            key={game.id}
            onDoubleClick={() => handleDoubleClick(game.path)}
            style={{
              backgroundColor: '#23243e',
              borderRadius: 16,
              padding: '20px 8px 14px 8px',
              cursor: 'pointer',
              textAlign: 'center',
              width: 110,
              boxShadow: '0 1px 8px rgba(40,40,70,0.14)',
              userSelect: 'none',
              transition: 'box-shadow .12s, transform .12s',
              border: '2px solid transparent'
            }}
            title="2x bos: Ishga tushur"
          >
            <img
              src={game.iconPath}
              alt={game.name}
              style={{
                width: '48px',
                height: '48px',
                objectFit: 'contain',
                marginBottom: '12px',
                borderRadius: 12,
                background: '#181b1f',
                boxShadow: '0 2px 8px #191e3a40'
              }}
              onError={(e) => {
                if (!e.target.src.endsWith('/icons/default-icon.png')) {
                  e.target.src = '/icons/default-icon.png'
                }
              }}
            />
            <div
              style={{
                fontSize: 14,
                color: '#ff8383',
                fontWeight: 200,
                letterSpacing: 1,
                wordBreak: 'break-word'
              }}
            >
              {game.exe}
            </div>
          </div>
        ))}
        {!games.length && (
          <div
            style={{
              color: '#b0b9d5',
              fontSize: 20,
              textAlign: 'center',
              gridColumn: '1/-1',
              padding: '40px 0'
            }}
          >
            Hech qanday o‘yin topilmadi
          </div>
        )}
      </div>
    </div>
  )
}
