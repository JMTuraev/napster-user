import React, { useEffect, useMemo, useState } from 'react'

export default function Taskbar() {
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
    const id = setInterval(load, 2500) // dinamik yangilash (2.5s)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [])

  // exePath bo‘yicha guruhlash (bitta app — bitta badge)
  const apps = useMemo(() => {
    const byKey = new Map()
    for (const w of wins) {
      const key = w.exePath || (w.exeName ? `${w.exeName}:${w.pid}` : `hwnd:${w.hwnd}`)
      const cur = byKey.get(key)
      if (cur) cur.windows.push(w)
      else byKey.set(key, { ...w, windows: [w], __key: key })
    }
    return Array.from(byKey.values())
  }, [wins])

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-t bg-black/30">
      {!apps.length && <div className="text-xs opacity-60">App topilmadi…</div>}
      {apps.map((app) => (
        <div
          key={app.exePath}
          className="px-3 py-1.5 rounded-xl border shadow-sm text-left"
          title={`${app.exePath}\nPID: ${app.pid}\nHWND: ${app.hwnd}`}
        >
          <div className="text-[11px] opacity-70">{app.exeName || 'unknown.exe'}</div>
          <div className="text-sm font-medium max-w-[220px] truncate">{app.title}</div>
        </div>
      ))}
    </div>
  )
}
