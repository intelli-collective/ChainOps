export function ArrowIcon({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M2.5 8h11M9 3.5L13.5 8 9 12.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
