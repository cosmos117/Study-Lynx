/**
 * Night Lynx brand mark.
 * Place your uploaded lynx image at: frontend/public/study-lynx-logo.svg
 * (also used as favicon). Falls back to an inline SVG eye-mark if missing.
 */
export default function BrandMark({ size = 40 }) {
  return (
    <span className="lynx-brand" style={{ width: size, height: size }}>
      <img
        src="/study-lynx-logo.svg"
        alt="Study Lynx logo"
        className="lynx-brand-img"
        onError={(event) => {
          event.currentTarget.style.display = 'none';
          const fallback = event.currentTarget.nextElementSibling;
          if (fallback) fallback.style.display = 'grid';
        }}
      />
      <span className="lynx-brand-fallback" style={{ display: 'none' }} aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <path
            d="M8 22.5 13.2 17l4.1 3.1L24 11.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M8 25h16" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="24" cy="11.5" r="2.4" fill="#F59E0B" />
          <circle cx="24" cy="11.5" r="1" fill="#0F172A" />
        </svg>
      </span>
    </span>
  );
}



