/**
 * Static color-name → hex lookup, used only to render a circular swatch for
 * a variant axis literally named "Color"/"Colour" — the backend has no hex
 * value for an option label (`VariantAxisValue` carries only
 * `optionLabel`, e.g. "Red"), so there's no real color data to show. Falls
 * back to a neutral gray for any option name not in this list, which
 * covers the common case (a color axis whose values genuinely are colors)
 * without inventing a wrong-looking color for something unexpected.
 */
const COLOR_HEX: Record<string, string> = {
  black: '#111111',
  white: '#f5f5f4',
  red: '#c0392b',
  blue: '#2980b9',
  navy: '#1f2a44',
  green: '#27713f',
  yellow: '#e8b93a',
  orange: '#d97a34',
  pink: '#e08ab0',
  purple: '#7d5ba6',
  grey: '#8a8a86',
  gray: '#8a8a86',
  brown: '#7b4a2e',
  beige: '#e0d3bd',
  gold: '#b8956a',
  silver: '#c8c8c4',
  maroon: '#7a2331',
  teal: '#2e7d78',
};
const FALLBACK_HEX = '#c8c8c4';

export function colorSwatchHex(optionLabel: string): string {
  return COLOR_HEX[optionLabel.trim().toLowerCase()] ?? FALLBACK_HEX;
}

/** True when an axis is meant to render as color swatches rather than
 *  text/size pills — matched by attribute code OR label, so either a
 *  `color`-coded attribute or one merely labeled "Colour" is caught. */
export function isColorAxis(attributeCode: string, attributeLabel: string): boolean {
  return /colou?r/i.test(attributeCode) || /colou?r/i.test(attributeLabel);
}
