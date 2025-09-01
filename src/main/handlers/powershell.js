import fs from 'fs'
import { execFile } from 'child_process'

/* ----------------------------- PowerShell helper ---------------------------- */

let _pwshCached = null
export function getPwsh64() {
  if (_pwshCached) return _pwshCached
  const win = process.env.SystemRoot || 'C:\\Windows'
  const sysnative = `${win}\\Sysnative\\WindowsPowerShell\\v1.0\\powershell.exe`
  const system32 = `${win}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
  try {
    if (fs.existsSync(sysnative)) return (_pwshCached = sysnative)
  } catch {}
  try {
    if (fs.existsSync(system32)) return (_pwshCached = system32)
  } catch {}
  _pwshCached = 'powershell.exe'
  return _pwshCached
}

const PS_PREFIX =
  `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
$ErrorActionPreference   = 'SilentlyContinue';
$ProgressPreference      = 'SilentlyContinue';
$InformationPreference   = 'SilentlyContinue';
$WarningPreference       = 'SilentlyContinue';
`.trim() + '\n'

function runPwsh(script) {
  return new Promise((resolve) => {
    const pwsh = getPwsh64()
    const args = [
      '-NoLogo',
      '-NonInteractive',
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      PS_PREFIX + script
    ]
    const child = execFile(pwsh, args, { windowsHide: true })
    let out = '',
      err = ''
    child.stdout.on('data', (d) => (out += String(d)))
    child.stderr?.on?.('data', (d) => (err += String(d)))
    child.on('exit', () => resolve({ out, err }))
    child.on('error', () => resolve({ out: '', err: 'exec-error' }))
  })
}

/* ------------------------- Window enumerate / activate ---------------------- */
// src/main/handlers/powershell.js ichida ALMASHTIR:
export async function enumAltTabWindows() {
  const script = `
$ErrorActionPreference='SilentlyContinue'

# --- 1) Urinish: P/Invoke yo'li (EnumWindows). ---
$nativeOK = $true
try {
  Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class Win {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int  GetWindowTextLength(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int  GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMax);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
  [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@
} catch { $nativeOK = $false }

$items = New-Object System.Collections.Generic.List[object]

if ($nativeOK) {
  function AddItem_Native([IntPtr]$h) {
    try {
      if (-not [Win]::IsWindowVisible($h)) { return }
      $rc = New-Object Win+RECT
      if (-not [Win]::GetWindowRect($h, [ref]$rc)) { return }
      if (($rc.Right - $rc.Left) -le 0 -or ($rc.Bottom - $rc.Top) -le 0) { return }
    } catch { return }

    $title = $null
    try {
      $len = [Win]::GetWindowTextLength($h)
      if ($len -gt 0) {
        $sb = New-Object System.Text.StringBuilder ($len+1)
        [void][Win]::GetWindowText($h, $sb, $sb.Capacity)
        $title = $sb.ToString()
      }
    } catch {}

    $cls = $null
    try {
      $sb2 = New-Object System.Text.StringBuilder 256
      [void][Win]::GetClassName($h, $sb2, $sb2.Capacity)
      $cls = $sb2.ToString()
      if ($cls -in @('WorkerW','Progman','Shell_TrayWnd','Button')) { return }
    } catch {}

    $pid = 0; [void][Win]::GetWindowThreadProcessId($h, [ref]$pid)

    $exeName = $null; $exePath = $null
    try {
      $p = Get-Process -Id $pid -ErrorAction Stop
      $exeName = ($p.ProcessName + '.exe')
      $exePath = $p.Path
    } catch {}

    $items.Add([pscustomobject]@{
      hwnd    = ($h.ToInt64().ToString())
      pid     = [int]$pid
      title   = $title
      exeName = $exeName
      exePath = $exePath
      cls     = $cls
    }) | Out-Null
  }

  try {
    $cb = [Win+EnumWindowsProc]{ param($h,$l) (AddItem_Native $h); return $true }
    [void][Win]::EnumWindows($cb, [IntPtr]::Zero)
  } catch {}
}

# --- 2) Agar native yo'l bo'sh chiqsa yoki Add-Type yiqilgan bo'lsa: PURE Get-Process fallback ---
if (-not $nativeOK -or $items.Count -eq 0) {
  try {
    $procs = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 } | Sort-Object Id
    foreach ($p in $procs) {
      $h = $p.MainWindowHandle
      $title = $null
      try { $title = $p.MainWindowTitle } catch {}

      $items.Add([pscustomobject]@{
        hwnd    = ([Int64]$h).ToString()
        pid     = [int]$p.Id
        title   = $title
        exeName = ($p.ProcessName + '.exe')
        exePath = $p.Path
        cls     = $null
      }) | Out-Null
    }
  } catch {}
}

$items | ConvertTo-Json -Compress -Depth 4
`.trim()

  const { out, err } = await runPwsh(script)
  try {
    const arr = JSON.parse((out || '').trim() || '[]')
    return Array.isArray(arr) ? arr : []
  } catch {
    console.error('[enumAltTabWindows] parse fail. stdout(len)=', out?.length ?? 0, 'stderr=', err)
    return []
  }
}

/** Kuchli aktivlashtirish: Restore + AttachThreadInput + ALT tap + SetForeground */
export async function bringToFrontByHwnd(hwndStr) {
  if (!hwndStr) return false
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class W {
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, int dwFlags, int dwExtraInfo);
  public const int SW_RESTORE = 9;
  public const byte VK_MENU = 0x12;
  public const int KEYEVENTF_KEYUP = 0x2;
}
"@

try { $h = [IntPtr]::Parse('${String(hwndStr)}') } catch { "FAIL"; exit 2 }
if ([W]::IsIconic($h)) { [W]::ShowWindowAsync($h, [W]::SW_RESTORE) | Out-Null }

$fg = [W]::GetForegroundWindow()
$curTid = [W]::GetCurrentThreadId()
$fgTid = 0; if ($fg -ne [IntPtr]::Zero) { [void][W]::GetWindowThreadProcessId($fg, [ref]$fgTid) }
$tgTid = 0; [void][W]::GetWindowThreadProcessId($h, [ref]$tgTid)

if ($fgTid -ne 0) { [W]::AttachThreadInput($curTid, $fgTid, $true) | Out-Null }
if ($tgTid -ne 0) { [W]::AttachThreadInput($curTid, $tgTid, $true) | Out-Null }

[W]::BringWindowToTop($h) | Out-Null
[W]::keybd_event([W]::VK_MENU, 0, 0, 0)
$ok = [W]::SetForegroundWindow($h)
[W]::keybd_event([W]::VK_MENU, 0, [W]::KEYEVENTF_KEYUP, 0)

if ($tgTid -ne 0) { [W]::AttachThreadInput($curTid, $tgTid, $false) | Out-Null }
if ($fgTid -ne 0) { [W]::AttachThreadInput($curTid, $fgTid, $false) | Out-Null }

if ($ok) { "OK" } else { "FAIL" }
`.trim()

  const { out } = await runPwsh(script)
  return String(out || '').includes('OK')
}

/* ------------------------------ Proc helpers -------------------------------- */

export function psAnyAliveByNames(names = []) {
  return new Promise((resolve) => {
    if (!names?.length) return resolve(false)
    const pwsh = getPwsh64()
    const filter = names
      .map(
        (n) =>
          `'${String(n || '')
            .toLowerCase()
            .replace(/'/g, "''")}'`
      )
      .join(',')
    const script = `$n=@(${filter});$alive=Get-Process|Where-Object{ $n -contains ($_.Name + '.exe').ToLower() -or $n -contains $_.Name.ToLower() };if($alive){exit 0}else{exit 1}`
    const child = execFile(
      pwsh,
      [
        '-NoLogo',
        '-NonInteractive',
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        script
      ],
      { windowsHide: true }
    )
    child.on('exit', (c) => resolve(c === 0))
    child.on('error', () => resolve(false))
  })
}

export function psAnyDescendantAlive(rootPid) {
  return new Promise((resolve) => {
    const pwsh = getPwsh64()
    const script = `$r=${Number(rootPid)};$kids=Get-WmiObject Win32_Process -Filter "ParentProcessId=$r"; if($kids){exit 0}else{exit 1}`
    const child = execFile(
      pwsh,
      [
        '-NoLogo',
        '-NonInteractive',
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        script
      ],
      { windowsHide: true }
    )
    child.on('exit', (c) => resolve(c === 0))
    child.on('error', () => resolve(false))
  })
}
