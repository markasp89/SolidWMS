/** SolidWMS mark (inline, so it also works in the single-file demo). */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#1e293b" />
      <path d="M6 13 16 7l10 6v12H6z" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="11" y="17" width="10" height="8" fill="#38bdf8" />
    </svg>
  )
}
