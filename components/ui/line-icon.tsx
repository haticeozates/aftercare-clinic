const paths = {
  home: "M3 10l9-7 9 7v10H3zM9 20v-6h6v6",
  people: "M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M21 21v-2a4 4 0 0 0-3-3.9M16 3.3a4 4 0 0 1 0 7.5",
  procedure: "M9 3h6v6h6v6h-6v6H9v-6H3V9h6z",
  template: "M7 3h7l5 5v13H5V3zM14 3v6h5M8 13h8M8 17h8",
  calendar: "M3 6h18v15H3zM7 3v6M17 3v6M3 11h18M8 15h2M14 15h2M8 18h2",
  plan: "M7 5H4v16h16V5h-3M8 3h8v5H8zM8 13l2 2 4-4M8 18h8",
  chart: "M4 3v17h17M8 16v-4M13 16V7M18 16V9",
  alert: "M12 3 2.5 20h19zM12 9v4M12 16v.5",
  consent: "M12 22c4-2 8-5 8-10V5l-8-3-8 3v7c0 5 4 8 8 10zM8 12l3 3 5-5",
  request: "M4 13l3-7h10l3 7v7H4zM4 13h5l1 3h4l1-3h5",
  settings: "M4 7h16M4 17h16M9 4v6M15 14v6",
  bell: "M18 8a6 6 0 0 0-12 0c0 6-3 8-3 8h18s-3-2-3-8M10 20a2 2 0 0 0 4 0",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6 6 18",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  check: "M4 12l5 5L20 6",
  photo: "M3 5h18v14H3zM7 15l3-3 3 3 2-2 3 3M15 9h.01",
  checkin: "M3 3h18v13h-8l-5 5v-5H3zM7 8h10M7 12h6",
  exit: "M10 4H4v16h6M9 12h12M17 8l4 4-4 4"
} as const;

export type LineIconName = keyof typeof paths;

export function LineIcon({ name, size = 20 }: { name: LineIconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d={paths[name]} />
  </svg>;
}
