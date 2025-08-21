// src/renderer/components/BottomTaskbar.jsx
import React, { useEffect, useMemo, useState } from 'react'

export default function BottomTaskbar() {
  const [wins, setWins] = useState([])

  useEffect(() => {
    let stop = false
    const load = async () => {
      try {
        const list = await window.api.altTab.list()
        if (!stop) setWins(Array.isArray(list) ? list : [])
      } catch {}
    }
    load()
    const id = setInterval(load, 2000) // har 2s yangilash
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [])

  // exePath || exeName:pid || hwnd bo‘yicha guruhlash (bitta app—bitta badge)
  const apps = useMemo(() => {
    const byKey = new Map()
    for (const w of wins) {
      const key = w.exePath || (w.exeName ? `${w.exeName}:${w.pid}` : `hwnd:${w.hwnd}`)
      const cur = byKey.get(key)
      if (cur) cur.windows.push(w)
      else byKey.set(key, { ...w, windows: [w], __key: key })
    }
    return Array.from(byKey.values()).sort((a, b) =>
      (a.exeName || '').localeCompare(b.exeName || '')
    )
  }, [wins])

  const onActivate = async (app) => {
    const w = app.windows?.[0]
    if (!w) return
    // universal chaqiriq:
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

      {apps.map((app) => (
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
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.06)',
            color: '#e9eefc',
            cursor: 'pointer',
            height: 44,
            maxWidth: 220,
            overflow: 'hidden'
          }}
        >
          {/* Icon */}
          <img
            src={app.exePath ? undefined : '/icons/default-icon.png'}
            alt=""
            onError={(e) => (e.currentTarget.src = '/icons/default-icon.png')}
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: 'rgba(0,0,0,0.35)'
            }}
            ref={async (img) => {
              // exePath'dan icon olish (sizdagi IPC)
              if (img && app.exePath) {
                try {
                  const iconUrl = await window.api.getIcon(app.exePath)
                  if (iconUrl) img.src = iconUrl
                } catch {}
              }
            }}
          />

          {/* Matnlar */}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ fontSize: 12, opacity: 0.8, lineHeight: '14px' }}>
              {app.exeName || 'unknown.exe'}
            </div>
            <div
              style={{
                fontSize: 12,
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                maxWidth: 140,
                lineHeight: '14px'
              }}
            >
              {app.title || ''}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
