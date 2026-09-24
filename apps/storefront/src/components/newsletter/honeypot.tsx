/** Hidden field real visitors never see or fill; bots that fill every input
 *  give themselves away (the proxy route drops those sign-ups silently). */
export function Honeypot() {
  return (
    <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
  );
}
