export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function adjustColor(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  if (percent >= 0) {
    return rgbToHex(
      r + ((255 - r) * percent) / 100,
      g + ((255 - g) * percent) / 100,
      b + ((255 - b) * percent) / 100,
    );
  }
  const factor = 1 + percent / 100;
  return rgbToHex(r * factor, g * factor, b * factor);
}

export function generateShades(baseHex: string): Record<string, string> {
  return {
    50: adjustColor(baseHex, 90),
    100: adjustColor(baseHex, 80),
    200: adjustColor(baseHex, 60),
    300: adjustColor(baseHex, 40),
    400: adjustColor(baseHex, 20),
    500: baseHex,
    600: adjustColor(baseHex, -10),
    700: adjustColor(baseHex, -20),
    800: adjustColor(baseHex, -30),
    900: adjustColor(baseHex, -40),
  };
}