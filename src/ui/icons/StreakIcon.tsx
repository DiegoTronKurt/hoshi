/** Icono simple de llama para la racha en TodayScreen. Mismo patron sin
 * dependencias que NavIcons.tsx: stroke/fill "currentColor". */
export function StreakIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
    >
      <path d="M12 2c.7 2.6-.6 4-1.8 5.3C9 8.5 8 9.9 8 12c0 2.2 1.8 4 4 4s4-1.8 4-4c0-1.1-.4-1.9-.9-2.7.9.6 1.9 1.8 1.9 3.7 0 3.3-2.7 6-6 6s-6-2.7-6-6c0-4.5 3.3-6.4 5-8.5.9-1.1 1.5-2.1 2-3.5z" />
    </svg>
  )
}
