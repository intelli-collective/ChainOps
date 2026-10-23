export const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
export const formatDateTime = (iso: string) => {
  const date = new Date(iso)
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
