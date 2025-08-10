import { session } from 'electron'

export function patchCSP() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const cspDirectives = [
      "default-src 'self'",
      "img-src 'self' data: http://localhost:3000 http://192.168.1.10:5173",
      "connect-src 'self' ws://localhost:3000 http://localhost:3000 ws://192.168.1.10:3000 http://192.168.1.10:3000 ws://192.168.0.100:3000 http://192.168.0.100:3000",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'"
    ].join('; ')
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspDirectives]
      }
    })
  })
}
