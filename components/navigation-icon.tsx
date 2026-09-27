import type { ReactNode } from "react";

type NavigationIconName = "overview" | "assistant" | "conversations" | "knowledge" | "queue" | "profile" | "settings";

export function NavigationIcon({ name }: { name: NavigationIconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  const paths: Record<NavigationIconName, ReactNode> = {
    overview: <><rect x="3.5" y="3.5" width="6" height="6" rx="1" /><rect x="14.5" y="3.5" width="6" height="6" rx="1" /><rect x="3.5" y="14.5" width="6" height="6" rx="1" /><rect x="14.5" y="14.5" width="6" height="6" rx="1" /></>,
    assistant: <><path d="m12 2 1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6L12 2Z" /><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" /></>,
    conversations: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.6 8.6 0 0 1-3.2-.7L4 20l1.5-4.1A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" /><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" /></>,
    knowledge: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22V5.5Z" /></>,
    queue: <><path d="M4 5.5h16v12H4z" /><path d="M4 13h4l1.5 2h5L16 13h4" /><path d="m9.5 9 1.5 1.5L14.5 7" /></>,
    profile: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21c.8-4 3.2-6 7-6s6.2 2 7 6" /></>,
    settings: <><path d="M4 7h16M4 17h16M8 3v8M16 13v8" /><circle cx="8" cy="7" r="2" /><circle cx="16" cy="17" r="2" /></>,
  };

  return <svg className="navigation-icon" viewBox="0 0 24 24" aria-hidden="true" {...common}>{paths[name]}</svg>;
}

export type { NavigationIconName };
