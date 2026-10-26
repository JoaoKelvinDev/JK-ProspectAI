import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// JSDOM não implementa o diálogo nativo. Os testes verificam estado e eventos,
// sem substituir a necessidade de verificar foco e layout em um navegador real.
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute('open');
};
HTMLElement.prototype.scrollIntoView = function () {};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('Rede externa bloqueada nos testes.'))),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
