// Paths from site/prototype/Foundations.dc.html:96-108 (24x24 viewBox, stroked).
export const ICONS = {
  logo: 'M4 4h7v7H4zM13 13h7v7h-7zM13 4h7v7M4 13v7h7', search: 'M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13zM20 20l-4.8-4.8', x: 'M6 6l12 12M18 6L6 18',
  sun: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z', menu: 'M4 7h16M4 12h16M4 17h16', filter: 'M4 6h16M7 12h10M10 18h4', copy: 'M9 9h10v10H9zM5 15V5h10',
  check: 'M5 12.5l4.5 4.5L19 7.5', ext: 'M14 5h5v5M19 5l-8 8M18 14v5H5V6h5', chevD: 'M6 9l6 6 6-6', chevR: 'M9 6l6 6-6 6', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14',
  arrowR: 'M5 12h14M13 6l6 6-6 6', arrowL: 'M19 12H5M11 6l-6 6 6 6', dot: 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z', warn: 'M12 3.5l9 16H3zM12 10v4M12 17v.5',
  err: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7.5v5.5M12 16.5v.5', info: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 11v5.5M12 7.5v.5',
  pkg: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9', skill: 'M6 4h11a1 1 0 0 1 1 1v15H8a2 2 0 0 1-2-2zM6 18a2 2 0 0 1 2-2h10M10 8h5',
  agent: 'M7 8h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3zM12 4v4M9 13v1.5M15 13v1.5', hook: 'M15 3v10a5 5 0 0 1-10 0v-1M5 12l-2 2.5M5 12l2.5 2M15 3h-3',
  command: 'M4 4h16v16H4zM14.5 8l-5 8', mcp: 'M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0zM12 16v5', file: 'M6 3h8l4 4v14H6zM14 3v4h4', refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6',
  code: 'M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 6l-3 12', list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01', clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7v5l3 2',
  compass: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM15.5 8.5l-2 5-5 2 2-5z',
} as const;

export type IconName = keyof typeof ICONS;
