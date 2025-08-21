import fs from 'fs'
import { execFile } from 'child_process'

export function getPwsh64() {
  const win = process.env.SystemRoot || 'C:\\Windows'
  const sysnative = `${win}\\Sysnative\\WindowsPowerShell\\v1.0\\powershell.exe`
  const system32 = `${win}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
  try {
    if (fs.existsSync(sysnative)) return sysnative
  } catch {}
  try {
    if (fs.existsSync(system32)) return system32
  } catch {}
  return 'powershell.exe'
}

export async function findAnyHwndByExePathAllDesktops(exePath) {
  return new Promise((resolve) => {
    const pwsh = getPwsh64()
    const script = `
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;

public class Desk {
  public delegate bool EnumDesktopsProc(string lpszDesktop, IntPtr lParam);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [DllImport("user32.dll")] public static extern IntPtr GetProcessWindowStation();
  [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern bool EnumDesktops(IntPtr hwinsta, EnumDesktopsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);
  [DllImport("user32.dll")] public static extern bool CloseDesktop(IntPtr hDesktop);
  [DllImport("user32.dll")] public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc lpfn, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}
"@

$target = '${exePath.replace(/'/g, "''")}'
$found = [IntPtr]::Zero

$hWinsta = [Desk]::GetProcessWindowStation()
if ($hWinsta -eq [IntPtr]::Zero) { "" | Out-Host; exit 0 }

$ACCESS = 0x0002 -bor 0x0100 -bor 0x0200 -bor 0x0001
$enumDesktops = [Desk+EnumDesktopsProc]{
  param($name, $l)
  try {
    $hDesk = [Desk]::OpenDesktop($name, 0, $false, $ACCESS)
    if ($hDesk -eq [IntPtr]::Zero) { return $true }
    $enumWins = [Desk+EnumWindowsProc]{
      param($h, $lp)
      if (-not [Desk]::IsWindowVisible($h)) { return $true }
      $pid = 0; [void][Desk]::GetWindowThreadProcessId($h, [ref]$pid)
      if ($pid -eq 0) { return $true }
      try {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $pid"
        if ($proc -and $proc.ExecutablePath -eq $target) {
          $script:found = $h
          return $false
        }
      } catch {}
      return $true
    }
    [void][Desk]::EnumDesktopWindows($hDesk, $enumWins, [IntPtr]::Zero)
  } finally {
    if ($hDesk -ne [IntPtr]::Zero) { [Desk]::CloseDesktop($hDesk) | Out-Null }
  }
  return ($script:found -eq [IntPtr]::Zero)
}

[void][Desk]::EnumDesktops($hWinsta, $enumDesktops, [IntPtr]::Zero)
if ($found -eq [IntPtr]::Zero) { "" } else { $found }
`.trim()

    const child = execFile(pwsh, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true
    })
    let out = ''
    child.stdout.on('data', (d) => (out += String(d)))
    child.on('exit', () => resolve(out.trim()))
    child.on('error', () => resolve(''))
  })
}

export async function bringToFrontByHwnd(hwndStr) {
  if (!hwndStr) return false
  return new Promise((resolve) => {
    const pwsh = getPwsh64()
    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class W {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@
$hwnd = [IntPtr]::Parse('${hwndStr}')
if ($hwnd -eq [IntPtr]::Zero) { exit 1 }
$TOPMOST=[IntPtr](-1); $SWP_NOMOVE=0x0002; $SWP_NOSIZE=0x0001
[W]::SetWindowPos($hwnd,$TOPMOST,0,0,0,0,$SWP_NOMOVE -bor $SWP_NOSIZE) | Out-Null
if ([W]::IsIconic($hwnd)) { [W]::ShowWindowAsync($hwnd,9) | Out-Null }
[W]::SetForegroundWindow($hwnd) | Out-Null
exit 0
`.trim()
    const child = execFile(pwsh, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true
    })
    child.on('exit', (code) => resolve(code === 0))
    child.on('error', () => resolve(false))
  })
}

export function psAnyAliveByNames(names = []) {
  return new Promise((resolve) => {
    if (!names.length) return resolve(false)
    const pwsh = getPwsh64()
    const filter = names.map((n) => `'${String(n).toLowerCase().replace(/'/g, "''")}'`).join(',')
    const script = `$names=@(${filter});$alive=Get-Process|Where-Object{ $names -contains ($_.Name + '.exe').ToLower() -or $names -contains $_.Name.ToLower() };if($alive){exit 0}else{exit 1}`
    const child = execFile(pwsh, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true
    })
    child.on('exit', (c) => resolve(c === 0))
    child.on('error', () => resolve(false))
  })
}

export function psAnyDescendantAlive(rootPid) {
  return new Promise((resolve) => {
    const pwsh = getPwsh64()
    const script = `$root=${Number(rootPid)};$kids=Get-CimInstance Win32_Process|Where-Object{$_.ParentProcessId -eq $root};if($kids){exit 0}else{exit 1}`
    const child = execFile(pwsh, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true
    })
    child.on('exit', (c) => resolve(c === 0))
    child.on('error', () => resolve(false))
  })
}

// === ALT+TAB-LIKE (P/Invoke-siz, faqat Get-Process): visible main window'lar ===
export async function enumAltTabWindows() {
  return new Promise((resolve) => {
    const pwsh = getPwsh64()
    const script = `
$procs = Get-Process |
  Where-Object {
    $_.MainWindowHandle -ne 0 -and
    -not [string]::IsNullOrWhiteSpace($_.MainWindowTitle)
  } |
  Sort-Object ProcessName, Id

$items = foreach ($p in $procs) {
  [pscustomobject]@{
    hwnd    = ($p.MainWindowHandle.ToInt64().ToString())
    pid     = $p.Id
    title   = $p.MainWindowTitle
    exeName = ($p.ProcessName + '.exe')
    exePath = $p.Path   # bo'sh bo'lishi mumkin (ba'zi himoyalangan jarayonlar)
  }
}

$items | ConvertTo-Json -Depth 4 -Compress
`.trim()

    const child = execFile(pwsh, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true
    })
    let out = '',
      err = ''
    child.stdout.on('data', (d) => (out += String(d)))
    child.stderr?.on?.('data', (d) => (err += String(d)))
    child.on('exit', () => {
      try {
        const arr = JSON.parse(out.trim() || '[]')
        resolve(Array.isArray(arr) ? arr : [])
      } catch {
        console.error('[enumAltTabWindows] parse fail. stderr=', err)
        resolve([])
      }
    })
    child.on('error', (e) => {
      console.error('[enumAltTabWindows] exec error:', e?.message)
      resolve([])
    })
  })
}
