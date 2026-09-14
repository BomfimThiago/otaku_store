import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TOAST_TIMEOUT_MS, ToastProvider, useToast } from './ToastProvider.js';

function ShowButton({ message }: { message: string }) {
  const { show } = useToast();
  return <button onClick={() => show(message)}>{message}</button>;
}

function renderWithProvider(children: ReactNode) {
  return render(<ToastProvider>{children}</ToastProvider>);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  act(() => {
    vi.runOnlyPendingTimers();
  });
  vi.useRealTimers();
});

describe('ToastProvider / useToast', () => {
  it('renders an empty live region before any toast is shown', () => {
    renderWithProvider(<ShowButton message="Adicionado ao carrinho" />);

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();
  });

  it('shows the message inside the live region after show is called', () => {
    renderWithProvider(<ShowButton message="Adicionado ao carrinho" />);
    const region = screen.getByRole('status');

    act(() => {
      fireEvent.click(screen.getByText('Adicionado ao carrinho'));
    });

    expect(within(region).getByText('Adicionado ao carrinho')).toBeInTheDocument();
  });

  it('dismisses the toast after TOAST_TIMEOUT_MS', () => {
    renderWithProvider(<ShowButton message="Adicionado ao carrinho" />);
    const region = screen.getByRole('status');

    act(() => {
      fireEvent.click(screen.getByText('Adicionado ao carrinho'));
    });

    act(() => {
      vi.advanceTimersByTime(TOAST_TIMEOUT_MS - 1);
    });
    expect(within(region).getByText('Adicionado ao carrinho')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(within(region).queryByText('Adicionado ao carrinho')).toBeNull();
  });

  it('stacks messages from multiple show calls', () => {
    renderWithProvider(
      <>
        <ShowButton message="Primeiro aviso" />
        <ShowButton message="Segundo aviso" />
      </>,
    );
    const region = screen.getByRole('status');

    act(() => {
      fireEvent.click(screen.getByText('Primeiro aviso'));
      fireEvent.click(screen.getByText('Segundo aviso'));
    });

    expect(within(region).getByText('Primeiro aviso')).toBeInTheDocument();
    expect(within(region).getByText('Segundo aviso')).toBeInTheDocument();
  });

  it('throws a descriptive error when used outside a ToastProvider', () => {
    function Bad() {
      useToast();
      return null;
    }

    expect(() => render(<Bad />)).toThrow('useToast must be used within a ToastProvider');
  });
});
