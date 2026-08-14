/** Shown next to a price whenever the current website's Website.pricesIncludeTax
 *  is on (GST Settings admin page) — the number beside it is genuinely final,
 *  nothing gets added at checkout. Indian retail convention (Amazon.in,
 *  Flipkart show the same cue on MRP-style pricing). Callers gate rendering
 *  on the flag themselves (`{pricesIncludeTax ? <TaxInclusiveNote /> : null}`)
 *  — this component has no flag of its own to check. */
export function TaxInclusiveNote() {
  return <span className="ml-1 text-xs font-normal text-muted-foreground">(incl. of all taxes)</span>;
}
