// bu yerda biz faqat ethernet MAC manzillarini olish uchun ishlaymiz
// src/utils/network.js
import os from 'os'

/**
 * Faqat Ethernet interfeyslardan MAC addressni qaytaradi.
 * Wi-Fi adapterlar inkor qilinadi.
 * @returns {string|null}
 */
export function getEthernetMac() {
  const nets = os.networkInterfaces()

  for (const name of Object.keys(nets)) {
    if (!/ethernet|eth|enp|en0/i.test(name)) continue

    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
        return net.mac.toLowerCase()
      }
    }
  }

  return null
}
