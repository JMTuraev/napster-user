import { existsSync, writeFileSync } from 'fs'
import { join, basename, extname } from 'path'
import extractIcon from 'extract-file-icon'

const iconsDir = join(process.cwd(), 'src', 'renderer', 'public', 'icons')

export function getIconBuffer(exePath) {
  try {
    return extractIcon(exePath, 32)
  } catch {
    return null
  }
}

// getIcon: exePath uchun icon path (agar PNG mavjud bo‘lsa uni qaytaradi, yo‘q bo‘lsa yaratadi)
export function saveIcon(iconBuf, exePath) {
  if (!iconBuf) return '/icons/default-icon.png'
  const iconFile = basename(exePath, extname(exePath)) + '.png'
  const iconPath = join(iconsDir, iconFile)
  if (!existsSync(iconPath)) {
    writeFileSync(iconPath, iconBuf)
  }
  return `/icons/${iconFile}`
}
