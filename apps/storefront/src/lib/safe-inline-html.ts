/**
 * Lets admins put a little formatting in short text fields (card titles and
 * subtitles) — line breaks, bold, italic, underline, small text — without ever
 * opening an XSS hole. Only these bare tags survive; every attribute is stripped
 * (so no onclick/style/href), every other tag is dropped, and a stray "<" that
 * isn't part of a complete tag is escaped. What comes out is safe to put in
 * dangerouslySetInnerHTML.
 */
const ALLOWED = new Set(['br', 'b', 'strong', 'i', 'em', 'u', 'span', 'small', 'sup', 'sub']);

export function safeInlineHtml(input: string | null | undefined): string {
  if (!input) return '';
  const out = input.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*>|</g, (match, closing: string | undefined, tag: string | undefined) => {
    if (tag === undefined) return '&lt;'; // a "<" that doesn't start a complete tag
    const name = tag.toLowerCase();
    if (!ALLOWED.has(name)) return '';
    if (name === 'br') return '<br>';
    return closing ? `</${name}>` : `<${name}>`;
  });
  return out;
}
