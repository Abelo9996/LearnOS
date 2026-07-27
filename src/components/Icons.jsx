import React from 'react';

export const Icon = ({ d, size = 18, stroke = 'currentColor', sw = 1.6, fill = 'none' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
       stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

export const I = {
  home:     <Icon d={<><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></>} />,
  graph:    <Icon d={<><circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8.4 6h7.2M6 8.4v7.2M18 8.4v7.2M8.4 18h7.2"/></>} />,
  cap:      <Icon d={<><path d="M3 9 12 5l9 4-9 4z"/><path d="M7 11v4c0 1.5 2.5 3 5 3s5-1.5 5-3v-4"/></>} />,
  book:     <Icon d={<><path d="M4 4h11a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M4 16a4 4 0 0 1 4-4h11"/></>} />,
  calendar: <Icon d={<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 3v4M16 3v4"/></>} />,
  check:    <Icon d={<><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 3 3 5-6"/></>} />,
  ribbon:   <Icon d={<><circle cx="12" cy="9" r="6"/><path d="m8 14-2 7 6-3 6 3-2-7"/></>} />,
  people:   <Icon d={<><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="7" r="2.5"/><path d="M14 14.5c2-1 7-.5 7 4.5"/></>} />,
  rss:      <Icon d={<><circle cx="5.5" cy="18.5" r="1.8"/><path d="M5 11a8 8 0 0 1 8 8M5 5a14 14 0 0 1 14 14"/></>} />,
  cog:      <Icon d={<><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.3l2-1.6-2-3.4-2.4.8a7 7 0 0 0-2.2-1.3L13.8 3h-3.6l-.5 2.2a7 7 0 0 0-2.2 1.3l-2.4-.8-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.3l-2 1.6 2 3.4 2.4-.8a7 7 0 0 0 2.2 1.3l.5 2.2h3.6l.5-2.2a7 7 0 0 0 2.2-1.3l2.4.8 2-3.4-2-1.6c.1-.5.1-.9.1-1.3z"/></>} />,
  search:   <Icon d={<><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>} />,
  bell:     <Icon d={<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z"/><path d="M10 21a2 2 0 0 0 4 0"/></>} />,
  send:     <Icon d={<path d="M3 11 21 3l-8 18-2-8z"/>} />,
  fork:     <Icon d={<><circle cx="6" cy="5" r="2"/><circle cx="18" cy="5" r="2"/><circle cx="12" cy="19" r="2"/><path d="M6 7v3a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7M12 12v5"/></>} />,
  star:     <Icon d={<path d="m12 3 2.9 6 6.6.9-4.8 4.6 1.2 6.6L12 18l-5.9 3.1 1.2-6.6L2.5 9.9 9.1 9z"/>} />,
  starFilled: <Icon fill="currentColor" sw={0} d={<path d="m12 3 2.9 6 6.6.9-4.8 4.6 1.2 6.6L12 18l-5.9 3.1 1.2-6.6L2.5 9.9 9.1 9z"/>} />,
  spark:    <Icon d={<path d="M12 3v6M12 15v6M3 12h6M15 12h6M5.6 5.6l4.2 4.2M14.2 14.2l4.2 4.2M5.6 18.4l4.2-4.2M14.2 9.8l4.2-4.2"/>} />,
  flame:    <Icon d={<path d="M12 21c4 0 7-3 7-7 0-4-4-6-4-10 0 3-7 5-7 10 0 4 1 7 4 7z"/>} />,
  clock:    <Icon d={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>} />,
  play:     <Icon fill="currentColor" sw={0} d={<path d="M7 4v16l13-8z"/>} />,
  chevron:  <Icon d={<path d="m9 6 6 6-6 6"/>} />,
  chevronD: <Icon d={<path d="m6 9 6 6 6-6"/>} />,
  chevronL: <Icon d={<path d="m15 6-6 6 6 6"/>} />,
  plus:     <Icon d={<path d="M12 5v14M5 12h14"/>} />,
  x:        <Icon d={<path d="M6 6l12 12M18 6 6 18"/>} />,
  github:   <Icon fill="currentColor" sw={0} d={<path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.7.4-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.2-.4-1.2.1-2.6 0 0 .8-.3 2.7 1 .8-.2 1.6-.3 2.5-.3s1.7.1 2.5.3c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.6.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.8v2.6c0 .3.2.6.7.5A10 10 0 0 0 12 2z"/>} />,
  zap:      <Icon d={<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>} />,
  layers:   <Icon d={<><path d="m12 2 10 5-10 5-10-5z"/><path d="m2 12 10 5 10-5M2 17l10 5 10-5"/></>} />,
  // Overflow affordance for the mobile tab bar.
  more:     <Icon d={<><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></>} />,
  api:      <Icon d={<><path d="M14 3v4M10 17v4M4 12h4M16 12h4"/><rect x="8" y="7" width="8" height="10" rx="2"/></>} />,
  hd:       <Icon d={<><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 20h10M12 16v4"/></>} />,
  open:     <Icon d={<path d="M15 3h6v6M21 3l-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>} />,
  card:     <Icon d={<><rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 6V4h14v14h-2"/></>} />,
  bolt:     <Icon d={<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>} />,
  chart:    <Icon d={<><path d="M4 20V8M10 20V4M16 20v-6M22 20H2"/></>} />,
  user:     <Icon d={<><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></>} />,
  box:      <Icon d={<><path d="m12 3 9 5v8l-9 5-9-5V8z"/><path d="M3 8l9 5 9-5M12 13v9"/></>} />,
  upload:   <Icon d={<><path d="M12 4v12M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></>} />,
  download: <Icon d={<><path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></>} />,
  shield:   <Icon d={<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>} />,
  copy:     <Icon d={<><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V4h12"/></>} />,
  filter:   <Icon d={<path d="M3 5h18l-7 9v6l-4-2v-4z"/>} />,
  arrowR:   <Icon d={<path d="M5 12h14M13 6l6 6-6 6"/>} />,
  arrowUp:  <Icon d={<path d="m6 15 6-6 6 6"/>} />,
  arrowDown: <Icon d={<path d="m6 9 6 6 6-6"/>} />,
  logout:    <Icon d={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>} />,
};
