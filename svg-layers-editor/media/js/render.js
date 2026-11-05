const renderers = [];

export function onRender(fn) {
  renderers.push(fn);
}

export function renderAll() {
  for (const fn of renderers) fn();
}
