import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('janela de revisão', () => {
  it('restaura o foco e a rolagem ao fechar', () => {
    const opener = document.createElement('button');
    opener.textContent = 'Abrir formulário';
    document.body.append(opener);
    opener.focus();
    const previous = document.body.style.overflow;
    const { unmount } = render(
      <Modal title="Revisão" onClose={() => {}}>
        <input autoFocus />
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe(previous);
    opener.remove();
  });
  it('não confunde clique no espaço interno com clique no fundo', () => {
    const close = vi.fn();
    render(
      <Modal title="Revisão" onClose={close}>
        <p>Conteúdo da janela</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 100,
      right: 500,
      bottom: 500,
      width: 400,
      height: 400,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    });
    fireEvent.click(dialog, { clientX: 110, clientY: 110 });
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(dialog, { clientX: 20, clientY: 20 });
    expect(close).toHaveBeenCalledOnce();
  });
});
