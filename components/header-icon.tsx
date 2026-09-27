type HeaderIconName = "search" | "bell";

export function HeaderIcon({ name }: { name: HeaderIconName }) {
  return <svg className="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "search" ? <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></> : <><path d="M18 10a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" /><path d="M10 22h4" /></>}
  </svg>;
}
