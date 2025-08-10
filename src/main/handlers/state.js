export const state = {
  kioskLocked: true,
  activeRuns: 0,
  running: new Set()
}

export const setKioskLocked = (v) => {
  state.kioskLocked = !!v
}
