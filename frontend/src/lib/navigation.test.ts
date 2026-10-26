import { afterEach, describe, expect, it, vi } from 'vitest';
import { focusDetailsOnSmallScreen, returnToSelectedResult } from './navigation';

afterEach(() => document.body.replaceChildren());

function media(small: boolean, reduced = false) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('max-width') ? small : reduced,
      media: query,
    })),
  );
}

describe('navegação responsiva', () => {
  it('leva foco aos detalhes em uma tela pequena', () => {
    media(true);
    document.body.innerHTML = '<aside id="business-details" tabindex="-1"></aside>';
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
    focusDetailsOnSmallScreen();
    expect(document.getElementById('business-details')).toHaveFocus();
    expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
  });
  it('respeita a preferência por movimento reduzido', () => {
    media(true, true);
    document.body.innerHTML = '<aside id="business-details" tabindex="-1"></aside>';
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
    focusDetailsOnSmallScreen();
    expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' });
  });
  it('não desloca o usuário em desktop', () => {
    media(false);
    document.body.innerHTML = '<aside id="business-details" tabindex="-1"></aside>';
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
    focusDetailsOnSmallScreen();
    expect(scroll).not.toHaveBeenCalled();
  });
  it('volta ao registro selecionado', () => {
    document.body.innerHTML =
      '<button class="business-select" aria-pressed="true">Negócio</button>';
    returnToSelectedResult();
    expect(document.querySelector('button')).toHaveFocus();
  });
  it('tolera a ausência do painel ou do registro', () => {
    media(true);
    expect(focusDetailsOnSmallScreen).not.toThrow();
    expect(returnToSelectedResult).not.toThrow();
  });
});
