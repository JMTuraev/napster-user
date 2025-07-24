import { join, basename, extname } from 'path'
import { existsSync, mkdirSync, writeFileSync } from 'fs'

/**
 * Icon bufferini public/icons ga png formatida saqlash (FQAT BIR MARTA)
 * @param {Buffer} iconBuf - PNG buffer
 * @param {string} exePath - exe fayl yo‘li (nom uchun ishlatiladi)
 * @param {string} iconsDir - icons katalogi (default: renderer/public/icons)
 * @returns {string} - public/icons dan nisbiy path (masalan: '/icons/chrome.png')
 */
export function saveIcon(
  iconBuf,
  exePath,
  iconsDir = join(process.cwd(), 'src', 'renderer', 'public', 'icons')
) {
  if (!iconBuf) return '/icons/default-icon.png'

  if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true })

  // Fayl nomi: [exeName].png  (timestamp yo‘q!)
  const exeName = basename(exePath, extname(exePath)) // '.exe' ni olib tashlaydi
  const fileName = `${exeName}.png`
  const filePath = join(iconsDir, fileName)

  // Agar icon PNG yo‘q bo‘lsa, yaratadi. Bor bo‘lsa, mavjud faylni ishlatadi
  if (!existsSync(filePath)) {
    writeFileSync(filePath, iconBuf)
  }

  // Renderer uchun nisbiy path
  return `/icons/${fileName}`
}
