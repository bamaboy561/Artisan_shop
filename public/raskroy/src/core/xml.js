// Небольшие помощники для XML, которые работают и в браузере (DOMParser), и в Node (@xmldom/xmldom).
export const children = (el, tag) => {
  const out = [];
  for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1 && (!tag || n.tagName === tag)) out.push(n);
  return out;
};
export const child = (el, tag) => children(el, tag)[0] || null;

export function browserParseXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) return null;
  return doc;
}

export const escXml = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
