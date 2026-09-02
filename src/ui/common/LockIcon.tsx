interface LockIconProps {
  className?: string
}

/** Candado dibujado a mano en SVG, mismo patron sin libreria que NavIcons.tsx:
 * marca contenido todavia bloqueado por el progreso del usuario (niveles de
 * Aprender, tamanos de tablero de Jugar), nunca un icono decorativo. */
export function LockIcon({ className }: LockIconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}
