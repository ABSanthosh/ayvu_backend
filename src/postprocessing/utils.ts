/// <reference lib="dom" />

export function removeAll(els: NodeListOf<Element>) {
  Array.from(els).forEach((el) => {
    el.parentNode?.removeChild(el);
  });
}

export function nodeFromString(document: Document, str: string): ChildNode {
  const div = document.createElement("div");
  div.innerHTML = str;
  if (!div.firstChild) {
    throw new Error("Invalid HTML passed to nodeFromString");
  }
  return div.firstChild;
}