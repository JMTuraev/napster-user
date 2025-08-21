// src/main/handlers/powershell.js
import fs from 'fs'
import { execFile } from 'child_process'
import { BrowserWindow } from 'electron'

/* ----------------------------- PowerShell helper ---------------------------- */

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

function runPwsh(script) {
  return new Promise((resolve) => {
    const pwsh = getPwsh64()
    const PS_PREFIX =
      `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
$ErrorActionPreference   = 'SilentlyContinue';
$ProgressPreference      = 'SilentlyContinue';
$InformationPreference   = 'SilentlyContinue';
$WarningPreference       = 'SilentlyContinue';
`.trim() + '\n'
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

/** Alt+Tab’ga o‘xshash: ko‘rinadigan, MainWindowTitle bor jarayonlar ro‘yxati */
export async function enumAltTabWindows() {
  const script = `
$procs = Get-Process |
  Where-Object { $_.MainWindowHandle -ne 0 -and -not [string]::IsNullOrWhiteSpace($_.MainWindowTitle) } |
  Sort-Object ProcessName, Id

$items = foreach ($p in $procs) {
  [pscustomobject]@{
    hwnd    = ($p.MainWindowHandle.ToInt64().ToString())
    pid     = $p.Id
    title   = $p.MainWindowTitle
    exeName = ($p.ProcessName + '.exe')
    exePath = $p.Path
  }
}

$items | ConvertTo-Json -Depth 4 -Compress
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

/** Barcha desktoplarda exePath bo‘yicha birorta hwnd topish (topilmasa '') */
export async function findAnyHwndByExePathAllDesktops(exePath) {
  const target = String(exePath || '').replace(/'/g, "''")
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

$target = '${target}'
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

  const { out } = await runPwsh(script)
  return String(out || '').trim()
}

/** Kuchli aktivlashtirish: restore + AttachThreadInput + ALT hack + BringToTop */
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
  public const int SW_SHOW = 5;
  public const int SW_RESTORE = 9;
  public const byte VK_MENU = 0x12;
  public const int KEYEVENTF_KEYUP = 0x2;
}
"@

try { $h = [IntPtr]::Parse('${String(hwndStr)}') } catch { "FAIL"; exit 2 }

if ([W]::IsIconic($h)) { [W]::ShowWindowAsync($h, [W]::SW_RESTORE) | Out-Null }
else { [W]::ShowWindowAsync($h, [W]::SW_SHOW) | Out-Null }

$fg = [W]::GetForegroundWindow()
$curTid = [W]::GetCurrentThreadId()
$fgTid = 0; if ($fg -ne [IntPtr]::Zero) { [void][W]::GetWindowThreadProcessId($fg, [ref]$fgTid) }
$targetTid = 0; [void][W]::GetWindowThreadProcessId($h, [ref]$targetTid)

if ($fgTid -ne 0) { [W]::AttachThreadInput($curTid, $fgTid, $true) | Out-Null }
if ($targetTid -ne 0) { [W]::AttachThreadInput($curTid, $targetTid, $true) | Out-Null }

[W]::BringWindowToTop($h) | Out-Null
[W]::keybd_event([W]::VK_MENU, 0, 0, 0)
$ok = [W]::SetForegroundWindow($h)
[W]::keybd_event([W]::VK_MENU, 0, [W]::KEYEVENTF_KEYUP, 0)

if ($targetTid -ne 0) { [W]::AttachThreadInput($curTid, $targetTid, $false) | Out-Null }
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
    const script = `$names=@(${filter});$alive=Get-Process|Where-Object{ $names -contains ($_.Name + '.exe').ToLower() -or $names -contains $_.Name.ToLower() };if($alive){exit 0}else{exit 1}`
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
    const script = `$root=${Number(rootPid)};$kids=Get-CimInstance Win32_Process|Where-Object{$_.ParentProcessId -eq $root};if($kids){exit 0}else{exit 1}`
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

/* ------------------------------ Electron utils ------------------------------ */

export function setElectronMousePassthrough(active) {
  const w = BrowserWindow.getAllWindows()[0]
  if (!w) return
  try {
    if (active) w.setIgnoreMouseEvents(true, { forward: true })
    else w.setIgnoreMouseEvents(false)
  } catch (e) {
    console.error('[setElectronMousePassthrough] xato:', e)
  }
}

// === Aktivlashtirish diagnostikasi: bir nechta usulni ketma-ket sinab, JSON hisobot qaytaradi ===
export async function activationDiagnostics({ pid, hwnd }) {
  const pwsh = getPwsh64()

  // PowerShell'ni jim/UTF-8 rejimga qo'yamiz
  const PS_PREFIX = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
$ErrorActionPreference   = 'SilentlyContinue';
$ProgressPreference      = 'SilentlyContinue';
$InformationPreference   = 'SilentlyContinue';
$WarningPreference       = 'SilentlyContinue';
`.trim()

  const script = `
${PS_PREFIX}

$rep = [ordered]@{
  ok = $false
  reason = $null
  inputs = @{
    pid  = ${Number(pid) || 0}
    hwnd = "${String(hwnd ?? '').Trim()}"
  }
  env = @{
    user    = $env:USERNAME
    isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    clm     = $ExecutionContext.SessionState.LanguageMode.ToString()
  }
  foreground_before = @{}
  steps  = @{}
  errors = @()
}

function Add-Err($m) { $rep.errors += $m }

# --- Foreground oynani aniqlaymiz (oldin) ---
try {
  Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class F {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowThreadProcessId(IntPtr hWnd, out int pid);
}
"@
  $fg = [F]::GetForegroundWindow()
  $fgpid = 0; [void][F]::GetWindowThreadProcessId($fg, [ref]$fgpid)
  $rep.foreground_before = @{ hwnd = ($fg.ToInt64()); pid = $fgpid }
} catch { Add-Err "FG query failed: $($_.Exception.Message)" }

# --- Target ma'lumotlari (title/hwnd/pid) ---
$targetPid   = ${Number(pid) || 0}
$targetHwnd  = 0
$targetTitle = $null

try {
  if ($targetPid -gt 0) {
    $p = Get-Process -Id $targetPid -ErrorAction Stop
    $targetTitle = $p.MainWindowTitle
    $targetHwnd  = $p.MainWindowHandle.ToInt64()
  }
} catch { Add-Err "Get-Process: $($_.Exception.Message)" }

if (-not $targetTitle -and "${String(hwnd ?? '').Trim()}" -ne "") {
  try {
    Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class T {
  [DllImport("user32.dll")] public static extern int  GetWindowTextLength(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int  GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMax);
}
"@
    $h = [IntPtr]::Parse("${String(hwnd ?? '').Trim()}")
    $len = [T]::GetWindowTextLength($h)
    if ($len -gt 0) {
      $sb = New-Object System.Text.StringBuilder ($len+1)
      [void][T]::GetWindowText($h, $sb, $sb.Capacity)
      $targetTitle = $sb.ToString()
    }
    $targetHwnd = $h.ToInt64()
  } catch { Add-Err "TitleByHwnd: $($_.Exception.Message)" }
}

$rep.inputs.title         = $targetTitle
$rep.inputs.hwndResolved  = $targetHwnd

# --- 1) COM: WScript.Shell.AppActivate(PID) ---
try {
  $sh = New-Object -ComObject WScript.Shell
  $ok1 = $false
  if ($targetPid -gt 0) {
    $ok1 = $sh.AppActivate($targetPid)
    if ($ok1) { Start-Sleep -Milliseconds 60; $sh.SendKeys('%') } # ALT
  }
  $rep.steps.AppActivatePid = $ok1
} catch { Add-Err "AppActivate(PID): $($_.Exception.Message)"; $rep.steps.AppActivatePid = $false }

# --- 2) COM: AppActivate(Title) ---
try {
  $ok2 = $false
  if (-not $rep.steps.AppActivatePid -and $targetTitle) {
    $ok2 = $sh.AppActivate($targetTitle)
    if ($ok2) { Start-Sleep -Milliseconds 60; $sh.SendKeys('%') }
  }
  $rep.steps.AppActivateTitle = $ok2
} catch { Add-Err "AppActivate(Title): $($_.Exception.Message)"; $rep.steps.AppActivateTitle = $false }

# --- 3) P/Invoke: Restore + AttachThreadInput + BringToTop + SetForegroundWindow ---
try {
  Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class W {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, int dwFlags, int dwExtraInfo);
  public const int SW_RESTORE = 9;
  public const byte VK_MENU = 0x12;  // ALT
  public const int KEYEVENTF_KEYUP = 0x2;
}
"@
  $ok3 = $false
  if ($targetHwnd -ne 0) {
    $h = [IntPtr]::new($targetHwnd)
    if ([W]::IsIconic($h)) { [W]::ShowWindowAsync($h, [W]::SW_RESTORE) | Out-Null }

    $fg    = [W]::GetForegroundWindow()
    $cur   = [W]::GetCurrentThreadId()
    $fgTid = 0; if ($fg -ne [IntPtr]::Zero) { [void][W]::GetWindowThreadProcessId($fg, [ref]$fgTid) }
    $tgTid = 0; [void][W]::GetWindowThreadProcessId($h,  [ref]$tgTid)

    if ($fgTid -ne 0) { [W]::AttachThreadInput($cur, $fgTid, $true) | Out-Null }
    if ($tgTid -ne 0) { [W]::AttachThreadInput($cur, $tgTid, $true) | Out-Null }

    [W]::BringWindowToTop($h) | Out-Null
    [W]::keybd_event([W]::VK_MENU, 0, 0, 0)
    $ok3 = [W]::SetForegroundWindow($h)
    [W]::keybd_event([W]::VK_MENU, 0, [W]::KEYEVENTF_KEYUP, 0)

    if ($tgTid -ne 0) { [W]::AttachThreadInput($cur, $tgTid, $false) | Out-Null }
    if ($fgTid -ne 0) { [W]::AttachThreadInput($cur, $fgTid, $false) | Out-Null }
  }
  $rep.steps.PInvokeSetForeground = $ok3
} catch { Add-Err "P/Invoke: $($_.Exception.Message)"; $rep.steps.PInvokeSetForeground = $false }

# --- Yakuniy foreground tekshiruvi ---
try {
  $fg2 = [F]::GetForegroundWindow()
  $fg2pid = 0; [void][F]::GetWindowThreadProcessId($fg2, [ref]$fg2pid)
  $rep.foreground_after = @{ hwnd = ($fg2.ToInt64()); pid = $fg2pid }
} catch { Add-Err "FG after query: $($_.Exception.Message)" }

# --- OK mezoni ---
$okByHwnd = ($targetHwnd -ne 0 -and $rep.foreground_after.hwnd -eq $targetHwnd)
$okByPid  = ($targetPid  -gt 0 -and  $rep.foreground_after.pid  -eq $targetPid)

$rep.ok = ($okByHwnd -or $okByPid -or $rep.steps.AppActivatePid -or $rep.steps.AppActivateTitle)

if (-not $rep.ok) {
  if ($env:USERNAME -and $rep.env.isAdmin) {
    $rep.reason = 'foreground-policy-or-uipi'
  } else {
    $rep.reason = 'maybe-foreground-policy; try admin or increase AOT delay'
  }
}

$rep | ConvertTo-Json -Compress -Depth 7
`.trim()

  return new Promise((resolve) => {
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
    let out = '',
      err = ''
    child.stdout.on('data', (d) => (out += String(d)))
    child.stderr?.on?.('data', (d) => (err += String(d)))
    child.on('exit', () => {
      try {
        const rep = JSON.parse((out || '').trim() || '{}')
        resolve(rep)
      } catch (e) {
        resolve({
          ok: false,
          parseError: true,
          stdout: out,
          stderr: err,
          error: String(e?.message || e)
        })
      }
    })
    child.on('error', (e) => {
      resolve({ ok: false, execError: String(e?.message || e) })
    })
  })
}

export function setElectronAlwaysOnTop(active) {
  const w = BrowserWindow.getAllWindows()[0]
  if (!w) return
  try {
    // 'screen-saver' prioriteti yuqoriroq; kerak bo‘lsa 'normal'ga almashtiring
    w.setAlwaysOnTop(!!active, 'screen-saver')
    w.setVisibleOnAllWorkspaces(!!active, { visibleOnFullScreen: true })
    w.setFullScreenable(!active)
  } catch (e) {
    console.error('[setElectronAlwaysOnTop] xato:', e)
  }
}

/** Sichqon hodisalarini vaqtincha UI’dan o‘tkazib yuborish */
export async function temporaryPassthrough(ms = 500) {
  setElectronMousePassthrough(true)
  await new Promise((r) => setTimeout(r, ms))
  setElectronMousePassthrough(false)
}

/** AlwaysOnTop’ni vaqtincha o‘chirib, keyin qaytarish */
export async function temporaryAlwaysOnTop(ms = 400) {
  setElectronAlwaysOnTop(false)
  await new Promise((r) => setTimeout(r, ms))
  setElectronAlwaysOnTop(true)
}

// PID bo'yicha fokus berish: COM WScript.Shell (Add-Type talab qilmaydi)
export async function bringToFrontByPid(pid) {
  const pwsh = getPwsh64()
  const script = `
$pid = ${Number(pid)};
try {
  $sh = New-Object -ComObject WScript.Shell
  # AppActivate ichida ALT xili mavjud; barqarorlik uchun yana Alt yuboramiz
  $ok = $sh.AppActivate($pid)
  if ($ok) { Start-Sleep -Milliseconds 60; $sh.SendKeys('%'); "OK" } else { "FAIL" }
} catch { "FAIL" }
`.trim()

  return new Promise((resolve) => {
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
    let out = ''
    child.stdout.on('data', (d) => (out += String(d)))
    child.on('exit', () => resolve(out.includes('OK')))
    child.on('error', () => resolve(false))
  })
}

export async function activateWindowSmart({ pid, hwnd, title }) {
  const pwsh = getPwsh64()
  const p = Number(pid || 0)
  const hStr = String(hwnd || '').trim()
  const tStr = String(title || '').replace(/"/g, '`"')

  const script = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference='SilentlyContinue'

# 0) Foregroundga ruxsat berish (ANY)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class A {
  [DllImport("user32.dll")] public static extern bool AllowSetForegroundWindow(int dwProcessId);
}
"@
[A]::AllowSetForegroundWindow(-1) | Out-Null

# 1) COM orqali PID bo‘yicha
$ok = $false
try {
  if (${p} -gt 0) {
    $sh = New-Object -ComObject WScript.Shell
    $ok = $sh.AppActivate(${p})
    if ($ok) { Start-Sleep -Milliseconds 60; $sh.SendKeys('%') }  # ALT
  }
} catch {}

# 2) Agar PID ishlamasa, sarlavha bo‘yicha
if (-not $ok -and "${tStr}") {
  try {
    if (-not $sh) { $sh = New-Object -ComObject WScript.Shell }
    $ok = $sh.AppActivate("${tStr}")
    if ($ok) { Start-Sleep -Milliseconds 60; $sh.SendKeys('%') }
  } catch {}
}

# 3) HWND bilan kuchli urinish
if (-not $ok -and "${hStr}") {
  try {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class W {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
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
    $h = [IntPtr]::Parse("${hStr}")
    if ([W]::IsIconic($h)) { [W]::ShowWindowAsync($h, [W]::SW_RESTORE) | Out-Null }

    $fg=[W]::GetForegroundWindow()
    $cur=[W]::GetCurrentThreadId()
    $fgTid=0; if ($fg -ne [IntPtr]::Zero) { [void][W]::GetWindowThreadProcessId($fg, [ref]$fgTid) }
    $tgTid=0; [void][W]::GetWindowThreadProcessId($h, [ref]$tgTid)
    if ($fgTid -ne 0) { [W]::AttachThreadInput($cur, $fgTid, $true) | Out-Null }
    if ($tgTid -ne 0) { [W]::AttachThreadInput($cur, $tgTid, $true) | Out-Null }

    [W]::BringWindowToTop($h) | Out-Null
    [W]::keybd_event([W]::VK_MENU, 0, 0, 0)
    $ok = [W]::SetForegroundWindow($h)
    [W]::keybd_event([W]::VK_MENU, 0, [W]::KEYEVENTF_KEYUP, 0)

    if ($tgTid -ne 0) { [W]::AttachThreadInput($cur, $tgTid, $false) | Out-Null }
    if ($fgTid -ne 0) { [W]::AttachThreadInput($cur, $fgTid, $false) | Out-Null }
  } catch {}
}

if ($ok) { "OK" } else { "FAIL" }
`.trim()

  return new Promise((resolve) => {
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
    let out = ''
    child.stdout.on('data', (d) => (out += String(d)))
    child.on('exit', () => resolve(out.includes('OK')))
    child.on('error', () => resolve(false))
  })
}

// Foreground oynani tekshirish (PID yoki HWND bo‘yicha)
export async function isForegroundMatch({ pid, hwnd }) {
  const pwsh = getPwsh64()
  const p = Number(pid || 0)
  const h = String(hwnd || '').trim()
  const script = `
$hStr = "${h}"
$wantPid = ${p}
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class F {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowThreadProcessId(IntPtr hWnd, out int pid);
}
"@
$fg = [F]::GetForegroundWindow()
$pid = 0; [void][F]::GetWindowThreadProcessId($fg, [ref]$pid)
$fgH = $fg.ToInt64().ToString()
if (($wantPid -gt 0 -and $pid -eq $wantPid) -or
    ($hStr -ne "" -and $fgH -eq $hStr)) { "YES" } else { "NO" }
`.trim()
  return new Promise((resolve) => {
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
    let out = ''
    child.stdout.on('data', (d) => (out += String(d)))
    child.on('exit', () => resolve(out.includes('YES')))
    child.on('error', () => resolve(false))
  })
}

// Foreground targetga o‘tib, 300–500ms barqaror turganini kutish
export async function waitForegroundStable({
  pid,
  hwnd,
  timeout = 2500,
  stableMs = 400,
  interval = 120
}) {
  let okSince = 0
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const ok = await isForegroundMatch({ pid, hwnd })
    const now = Date.now()
    if (ok) {
      if (!okSince) okSince = now
      if (now - okSince >= stableMs) return true
    } else {
      okSince = 0
    }
    await new Promise((r) => setTimeout(r, interval))
  }
  return false
}
