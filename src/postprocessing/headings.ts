import toTitleCase from "titlecase";

export default function processHeadings(document: Document) {
  // Apply transformations to all heading elements
  const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
  headings.forEach((heading) => {
    const treeWalker = document.createTreeWalker(
      heading,
      4 // NodeFilter.SHOW_TEXT not in Deno typings yet
    );
    let node: Text | null;
    while ((node = treeWalker.nextNode() as Text | null)) {
      // Convert all-uppercase headings to title case
      if (node.nodeValue && node.nodeValue === node.nodeValue.toUpperCase()) {
        node.nodeValue = toTitleCase(node.nodeValue.toLowerCase());
      }
      // Remove weird characters (e.g., full-width space)
      node.nodeValue = node.nodeValue?.replace(/\u3000/g, "") ?? "";
    }
  });
}
