import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';

const styles = readFileSync(new NodeURL('../styles.css', import.meta.url), 'utf8');

// Verifica combinações declaradas no CSS, sem alegar medir o layout renderizado.
// Referência: WCAG 2.2, SC 1.4.3 (texto comum: pelo menos 4,5:1).
function colors(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const result: Record<string, string> = {};
  for (const rule of styles.matchAll(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`, 'g'))) {
    for (const property of (rule[1] ?? '').matchAll(
      /(?:^|;)\s*([\w-]+)\s*:\s*(#[\da-f]{3}(?:[\da-f]{3})?)\s*(?=;|$)/gi,
    )) {
      if (property[1] && property[2]) result[property[1]] = property[2];
    }
  }
  return result;
}

function luminance(hex: string): number {
  if (hex.length === 4) hex = '#' + [...hex.slice(1)].map((char) => char + char).join('');
  const channels = [1, 3, 5].map((index) => {
    const channel = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return (channels[0] ?? 0) * 0.2126 + (channels[1] ?? 0) * 0.7152 + (channels[2] ?? 0) * 0.0722;
}

describe('contraste das combinações principais de texto', () => {
  it.each([
    [':root', ':root'],
    ['.small-note', '.detail-panel'],
    ['.business-title > span', 'tbody tr.selected'],
    ['.site-badge.informed', '.site-badge.informed'],
    ['.count-badge', '.count-badge'],
    ['.page-intro .eyebrow', ':root'],
    ['.button.primary', '.button.primary'],
    ['.score-warnings', '.score-warnings'],
  ])('%s sobre %s mantém ao menos 4,5:1', (foregroundSelector, backgroundSelector) => {
    const foreground = colors(foregroundSelector).color;
    const background = colors(backgroundSelector).background;
    expect(foreground).toBeDefined();
    expect(background).toBeDefined();
    if (!foreground || !background) throw new Error('Combinação CSS não localizada.');
    const [light, dark] = [luminance(foreground), luminance(background)].toSorted((a, b) => b - a);
    expect(((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});
