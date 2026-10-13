/**
 * @file Making elements: HTML and SVG, with a class and some text.
 * Public interface: el, svg, byId, button.
 * Owner context: Board (adapter).
 */

const SVGNS = 'http://www.w3.org/2000/svg';

/** An HTML element with an optional class and text. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

/** An SVG element with attributes and an optional class. */
export function svg(tag: string, attrs?: Readonly<Record<string, string | number>>, cls?: string): SVGElement {
  const n = document.createElementNS(SVGNS, tag);
  if (cls) n.setAttribute('class', cls);
  if (attrs) for (const a of Object.keys(attrs)) n.setAttribute(a, String(attrs[a]));
  return n;
}

/** The element with an id, which the page promises exists. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const n = document.getElementById(id);
  if (!n) throw new Error(`no element #${id}`);
  return n as T;
}

/** A button with a click handler. */
export function button(text: string, onClick: () => void, cls = 'btn small'): HTMLButtonElement {
  const b = el('button', cls, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}
