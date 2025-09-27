import { nodeFromString } from "./utils.ts";

export default function processMath(document: Document) {
  Array.from(document.querySelectorAll(".ltx_equation .ltx_Math")).forEach(
    (math) => {
      // Disambiguate display maths
      math.className = "ltx_DisplayMath";
      // Add markup so mathjax picks it up
      math.innerHTML = `\\[ ${math.innerHTML} \\]`;
    }
  );

  const eqnTables = document.querySelectorAll(
    ".ltx_equation.ltx_eqn_table, .ltx_equationgroup"
  );
  for (const table of Array.from(eqnTables)) {
    // Add parent div so we can make it scrollable on mobile.
    // See hacks in _ltx_engrafo_equation_container.scss
    const tableContainer = nodeFromString(
      document,
      '<div class="ltx_engrafo_equation_container"></div>'
    );
    table.parentNode?.replaceChild(tableContainer, table);
    tableContainer.appendChild(table);
  }

  Array.from(document.querySelectorAll(".ltx_Math")).forEach((math) => {
    math.innerHTML = `\\(${math.innerHTML}\\)`;
  });
}
