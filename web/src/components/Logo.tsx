export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden className="transition-transform group-hover:-rotate-6">
      <path
        d="M7 3h18v24.5l-3-2-3 2-3-2-3 2-3-2-3 2V3z"
        fill="#F5F1E8"
        stroke="#F0B90B"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M11 9h10M11 13h10M11 17h6" stroke="#1b1a17" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="21" cy="19.5" r="3.2" fill="#F0B90B" />
      <path d="M19.7 19.5l1 1 1.7-1.9" stroke="#09090b" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
