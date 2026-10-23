export function shorten(value?: string) {
  return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—'
}
export function displayDate(value?: string) {
  return value
    ? new Date(value).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Colombo'
      })
    : '—'
}
