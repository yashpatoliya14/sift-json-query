interface IconProps {
  className?: string;
}

const base = "h-4 w-4";

export function ChevronIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

export function UploadIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <path d="M8 11V2.5M8 2.5L4.75 5.75M8 2.5l3.25 3.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <path d="M2.5 11.5v2h11v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

export function CopyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <rect x="5.75" y="5.75" width="8" height="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.25 2.25h-8v8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ArrowIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <path d="M8 3v10M8 13l3.5-3.5M8 13l-3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

export function DatabaseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <ellipse cx="8" cy="4" rx="5.25" ry="2.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.75 4v8c0 1.24 2.35 2.25 5.25 2.25s5.25-1.01 5.25-2.25V4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.75 8c0 1.24 2.35 2.25 5.25 2.25S13.25 9.24 13.25 8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function TreeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <path d="M3 2v9.5h4M3 6.5h4M11 2h2M7 11.5h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <rect x="7" y="4.75" width="6" height="3.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="10" width="4" height="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
