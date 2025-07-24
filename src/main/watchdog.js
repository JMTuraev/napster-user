// src/main/watchdog.js

import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'

// -- CONFIG --
const baseDir = 'C:\\GameBooking'
const userExeName = 'user.exe' // agar build nomi boshqacha bo‘lsa, shu joyini o‘zgartiring!
const userExePath = path.join(baseDir, userExeName)
const watchdogPath = path.join(baseDir, 'watchdog-user.bat')
const flagPath = path.join(baseDir, 'user_stop.flag')

// -- Watchdog skript matni --
const watchdogText = `
@echo off
:main
if exist "${flagPath}" (
    timeout /t 3 >nul
    goto main
)
tasklist | find /i "${userExeName}" >nul 2>&1
if errorlevel 1 (
    start "" "${userExePath}"
)
timeout /t 3 >nul
goto main
`

export function setupWatchdog() {
  // 1. Watchdog bat faylini har doim update qilamiz (builddan keyin EXE nomi o‘zgarishi mumkin!)
  fs.writeFileSync(watchdogPath, watchdogText)

  // 2. Task Scheduler'ga yozish (agar hali mavjud bo‘lmasa)
  exec(`schtasks /Query /TN "UserWatchdog"`, (err) => {
    if (err) {
      exec(
        `schtasks /Create /SC ONLOGON /TN "UserWatchdog" /TR "${watchdogPath}" /RL HIGHEST /F`,
        (err2, stdout, stderr) => {
          if (err2) {
            // console.log('[WATCHDOG] Task Scheduler create error:', err2, stderr)
          } else {
            // console.log('[WATCHDOG] UserWatchdog task CREATED')
          }
        }
      )
    } else {
      // console.log('[WATCHDOG] UserWatchdog task already exists')
    }
  })
}

// --- Flaglarni yaratish/o‘chirish ---
export function createFlag() {
  fs.writeFileSync(flagPath, 'stopped')
}
export function removeFlag() {
  if (fs.existsSync(flagPath)) fs.unlinkSync(flagPath)
}
