import { profile } from "@/content/portfolio";
import { LocalTime } from "./LocalTime";

/** Usman's "U" brand mark (same shape as app/icon.svg). */
function BrandMark() {
  return (
    <svg viewBox="0 0 64 64" className="topbar__logo" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="15" fill="currentColor" />
      <path d="M20 15v18.5a12 12 0 0 0 24 0V15" fill="none" stroke="#fff" strokeWidth="7.5" strokeLinecap="round" />
      <path d="M32 31v9" fill="none" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" />
    </svg>
  );
}

export function TopBar() {
  return (
    <header className="topbar">
      <a href="#home" className="topbar__brand" aria-label={`${profile.name}, back to top`}>
        <BrandMark />
        <span className="topbar__name">{profile.name}</span>
      </a>
      <div className="topbar__meta">
        <a href="#contact" className="status">
          <span className="status__dot" aria-hidden="true" />
          Available for work
        </a>
        <LocalTime />
      </div>
    </header>
  );
}
