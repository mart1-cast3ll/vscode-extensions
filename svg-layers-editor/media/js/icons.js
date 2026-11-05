const wrap = (inner) =>
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

const KIND = {
  g: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  a: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  path: '<path d="M4 20c4-1 6-5 8-9s5-7 8-7"/><circle cx="4" cy="20" r="1.5"/><circle cx="20" cy="4" r="1.5"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1.5"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="9" ry="6"/>',
  line: '<path d="M5 19 19 5"/>',
  polyline: '<path d="M3 17l6-6 4 4 8-8"/>',
  polygon: '<path d="M12 3l9 16H3z"/>',
  text: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>',
  use: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
};

export const kindIcon = (tag) => wrap(KIND[tag] || KIND.g);

export const ICONS = {
  chevron: wrap('<path d="m6 9 6 6 6-6"/>'),
  eye: wrap('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: wrap(
    '<path d="M3 3l18 18"/><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9' +
      'M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6"/>'
  ),
  pen: wrap('<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
};
