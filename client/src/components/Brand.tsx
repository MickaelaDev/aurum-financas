export function Brand({
  compact = false,
  tagline = true,
}: {
  compact?: boolean;
  tagline?: boolean;
}) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`.trim()}>
      <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
        <path
          d="M16 3.5 27 28.5h-5.1l-2.3-5.7h-7.2L10.1 28.5H5L16 3.5Zm0 9.3-2.4 6.2h4.8L16 12.8Z"
          fill="currentColor"
        />
      </svg>
      <div className="brand__text">
        <span className="brand__word">AURUM</span>
        {tagline ? <span className="brand__tagline">finanças pessoais</span> : null}
      </div>
    </div>
  );
}
