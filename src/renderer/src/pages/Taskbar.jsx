import React, { useEffect, useMemo, useRef, useState } from 'react'

const POLL_MS = 800

export default function BottomTaskbar() {
  const [wins, setWins] = useState([])
  const stopRef = useRef(false)

  useEffect(() => {
    stopRef.current = false
    const load = async () => {
      try {
        const list = await window.api.altTab.list()
        if (!stopRef.current) setWins(Array.isArray(list) ? list : [])
      } catch (e) {
        console.warn('[BottomTaskbar] altTab.list failed', e)
      }
    }
    load()
    const id = setInterval(load, POLL_MS)
    const onVis = () => {
      if (!document.hidden) load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      stopRef.current = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const { apps, activeKey } = useMemo(() => {
    const byKey = new Map()
    let firstKey = null
    for (let i = 0; i < wins.length; i++) {
      const w = wins[i]
      const exe = String(w.exeName || 'unknown.exe').toLowerCase()
      const key = w.exePath || exe
      if (i === 0) firstKey = key
      const cur = byKey.get(key)
      if (cur) cur.windows.push(w)
      else byKey.set(key, { ...w, windows: [w], __key: key })
    }
    const orderedKeys = []
    for (const w of wins) {
      const k = w.exePath || String(w.exeName || 'unknown.exe').toLowerCase()
      if (!orderedKeys.includes(k)) orderedKeys.push(k)
    }
    const ordered = orderedKeys.map((k) => byKey.get(k)).filter(Boolean)
    return { apps: ordered, activeKey: firstKey }
  }, [wins])

  const onActivate = async (app) => {
    const w = app.windows?.[0]
    if (!w) return
    const res = await window.api.altTab.activateSmart({ pid: w.pid, hwnd: w.hwnd, title: w.title })
    if (!res?.ok) console.warn('activate failed:', res)
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: 68,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        background: 'rgba(15,18,30,0.75)',
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        zIndex: 9999
      }}
    >
      {apps.length === 0 && (
        <div style={{ color: '#b9c2de', fontSize: 13, opacity: 0.75 }}>App topilmadi…</div>
      )}

      {apps.map((app) => {
        const isActive = app.__key === activeKey
        return (
          <button
            key={app.__key}
            onClick={() => onActivate(app)}
            title={`${app.exeName || 'unknown.exe'}\n${app.exePath || ''}\n${app.title || ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 10px',
              borderRadius: 12,
              border: isActive
                ? '1px solid rgba(124, 197, 255, 0.9)'
                : '1px solid rgba(255,255,255,0.08)',
              background: isActive ? 'rgba(124,197,255,0.18)' : 'rgba(255,255,255,0.06)',
              color: '#e9eefc',
              cursor: 'pointer',
              height: 44,
              maxWidth: 240,
              overflow: 'hidden'
            }}
          >
            <img
              src={app.exePath ? undefined : '/icons/default-icon.png'}
              alt=""
              onError={(e) => (e.currentTarget.src = '/icons/default-icon.png')}
              style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(0,0,0,0.35)' }}
              ref={async (img) => {
                if (img && app.exePath) {
                  try {
                    const iconUrl = await window.api.getIcon(app.exePath)
                    if (iconUrl) img.src = iconUrl
                  } catch {}
                }
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ fontSize: 12, opacity: 0.85, lineHeight: '14px' }}>
                {app.exeName || 'unknown.exe'}
                {app.windows?.length > 1 && (
                  <span style={{ marginLeft: 6, opacity: 0.7 }}>({app.windows.length})</span>
                )}
              </div>
              <div
                style={{
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  maxWidth: 160,
                  lineHeight: '14px',
                  opacity: app.title ? 0.85 : 0.5
                }}
              >
                {app.title || '…'}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
