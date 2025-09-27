export default function processInlineStyles(document: Document) {
  // Remove all inline styles
  const elementsWithStyle = document.querySelectorAll("[style]");
  elementsWithStyle.forEach((el) => el.removeAttribute("style"));
}