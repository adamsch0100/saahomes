// Citation lines for the /resources/ stat pages. Every cite keeps the primary
// source named in the stat itself and adds the SAA Homes page that compiled it,
// so a writer who copies the line credits (and links) us as the compiler.

export const CITATION_PUBLISHER = "SAA Homes (Schwartz and Associates)";

// Plain-text line: the stat's own cite, then "Compiled by SAA Homes: <url>".
export function citationText(cite, url) {
  return `${cite} Compiled by ${CITATION_PUBLISHER}: ${url}`;
}

// HTML snippet for a writer's page: the cite plus a followable link back.
export function citationHtml(cite, url, pageTitle) {
  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  return `${esc(cite)} Compiled by <a href="${esc(url)}">${esc(pageTitle)} &mdash; SAA Homes</a>.`;
}
