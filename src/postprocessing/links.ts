import { linkifyUrlsToHtml } from "linkify-urls";

export default function processLinks(document: Document) {
  const window = document.defaultView;

  // Linkify plain text URLs
  const walker = document.createTreeWalker(
    document.querySelector(".ltx_page_main") as Node,
    4, // NodeFilter.SHOW_TEXT not in Deno typings yet
    {
      acceptNode(node: Node) {
        // Skip links and all their children
        if (node.parentNode && node.parentNode.nodeName === "A") {
          // return window!.NodeFilter.FILTER_REJECT;
          return 2; // FILTER_REJECT not in Deno typings yet
        }
        return 1; // FILTER_ACCEPT not in Deno typings yet
      },
    }
  );

  const nodesToReplace: { node: Node; replacement: string }[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const newText = linkifyUrlsToHtml(node.textContent || "");
    // Linkify didn't do anything
    if (node.textContent === newText) {
      continue;
    }
    // Treewalker stops if we replace the node it is currently on, so collect
    // up changes and perform after treewalker has finished
    nodesToReplace.push({
      node,
      replacement: newText,
    });
  }

  nodesToReplace.forEach((obj) => {
    const replacementNode = document.createElement("span");
    replacementNode.innerHTML = obj.replacement;
    obj.node.parentNode!.replaceChild(replacementNode, obj.node);
  });

  // Add http:// to URLs which don't have it
  Array.from(document.querySelectorAll("a")).forEach((a) => {
    const href = a.getAttribute("href");
    if (!href) {
      return;
    }
    if (
      !href.startsWith("http://") &&
      !href.startsWith("https://") &&
      !href.startsWith("#") &&
      !href.startsWith("mailto:")
    ) {
      a.setAttribute("href", "http://" + href);
    }
  });
}
