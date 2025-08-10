// src/main/hotkeyHandler.js
import { ipcMain, BrowserWindow } from 'electron'
import { execFile, exec } from 'child_process'
import fs from 'fs'
import path from 'path'

// --- Skriptlar katalogi (prod: C:\GameBooking\scripts; xohlasangiz ENV bilan o'zgartiring) ---
const SCRIPTS_DIR = process.env.GB_SCRIPTS_DIR || 'C:\\GameBooking\\scripts'

// --- Har doim 64-bit PowerShell yo'lini tanlaymiz (WOW64 redirection muammosiga yechim) ---
function getPowerShellPath() {
  const win = process.env.SystemRoot || process.env.windir || 'C:\\Windows'
  const psSysnative = path.join(win, 'Sysnative', 'WindowsPowerShell', 'v1.0', 'powershell.exe') // 64-bit
  const psSystem32 = path.join(win, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') // 64-bit (agar 64-bit jarayon bo'lsa)
  if (fs.existsSync(psSysnative)) return psSysnative
  if (fs.existsSync(psSystem32)) return psSystem32
  return 'powershell.exe' // oxirgi chora
}

// --- PS1 ni yashirincha ishga tushirish ---
function runPs1Hidden(ps1Path) {
  const exists = fs.existsSync(ps1Path)
  console.log('[KIOSK] runPs1Hidden:', { ps1Path, exists })
  if (!exists) return false

  const pwsh = getPowerShellPath()
  console.log('[KIOSK] Using PowerShell:', pwsh)

  try {
    execFile(
      pwsh,
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1Path],
      { windowsHide: true },
      (err) => {
        if (err) console.error('[KIOSK] PowerShell exec error:', err)
      }
    )
    return true
  } catch (e) {
    console.error('[KIOSK] execFile threw:', e)
    return false
  }
}

// --- PS1 ishlamasa: Welcome (Sign-in) ga o'tkazuvchi fallback ---
function gotoWelcomeFallback() {
  const win = process.env.SystemRoot || process.env.windir || 'C:\\Windows'
  // avval Sysnative\tsdiscon'ni urinamiz (har doim 64-bit)
  const tsSysnative = path.join(win, 'Sysnative', 'tsdiscon.exe')
  const tsSystem32 = path.join(win, 'System32', 'tsdiscon.exe')

  const tryExec = (exePath, next) => {
    if (!fs.existsSync(exePath)) return next?.()
    execFile(exePath, [], { windowsHide: true }, (err) => {
      if (err) next?.()
    })
  }

  // ketma-ket urinishlar: Sysnative → System32 → LockWorkStation
  tryExec(tsSysnative, () => {
    tryExec(tsSystem32, () => {
      console.warn('[KIOSK] tsdiscon topilmadi/yurmadi, LockWorkStation fallback...')
      exec('rundll32 user32.dll,LockWorkStation', { windowsHide: true }, (e2) => {
        if (e2) console.error('[KIOSK] LockWorkStation error:', e2)
      })
    })
  })
}

// --- IPC handlerlar: renderer invoke qiladi ---
export function registerHotkeyHandlers() {
  // (ixtiyoriy) Sizdagi minimize handlerini saqlab qo'yamiz
  ipcMain.handle('minimize-app', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) win.minimize()
  })

  // Gamer → Admin (Welcome/Sign-in), ilova YOPILMAYDI
  ipcMain.handle('kiosk:switch-to-admin', async () => {
    const ps1 = path.join(SCRIPTS_DIR, 'switch-to-admin.ps1')
    const ok = runPs1Hidden(ps1)
    if (!ok) gotoWelcomeFallback()
    return { ok: true, via: ok ? 'ps1' : 'fallback' }
  })

  // Admin → Gamer (xohlasangiz admin UI’dan tugma bilan), mantiq bir xil
  ipcMain.handle('kiosk:switch-to-gamer', async () => {
    const ps1 = path.join(SCRIPTS_DIR, 'switch-to-gamer.ps1')
    const ok = runPs1Hidden(ps1)
    if (!ok) gotoWelcomeFallback()
    return { ok: true, via: ok ? 'ps1' : 'fallback' }
  })
}
