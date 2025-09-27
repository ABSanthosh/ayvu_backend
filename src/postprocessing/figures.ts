export default function processFigures(document: Document): void {
  Array.from(document.querySelectorAll("figure")).forEach((figure) => {
    if (
      figure.children.length > 0 &&
      figure.children[0].tagName === "FIGCAPTION"
    ) {
      figure.appendChild(figure.children[0]);
    }
  });
}