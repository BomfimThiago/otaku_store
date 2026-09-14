import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Skeleton, ProductCardSkeleton } from './Skeleton.js';
import { EmptyState } from './EmptyState.js';
import { ErrorState } from './ErrorState.js';

describe('Skeleton', () => {
  it('renders a status region with an accessible loading name and aria-busy', () => {
    render(<Skeleton count={3} />);

    const status = screen.getByRole('status');

    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveAccessibleName(/carregando/i);
  });

  it('renders exactly `count` aria-hidden placeholders', () => {
    render(<Skeleton count={3} />);

    const status = screen.getByRole('status');
    const items = within(status).getAllByTestId('skeleton-item');

    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('renders a single placeholder when no count is given', () => {
    render(<Skeleton />);

    const status = screen.getByRole('status');
    const items = within(status).getAllByTestId('skeleton-item');

    expect(items).toHaveLength(1);
  });
});

describe('ProductCardSkeleton', () => {
  it('renders a status region with aria-busy and the requested number of card placeholders', () => {
    render(<ProductCardSkeleton count={4} />);

    const status = screen.getByRole('status');

    expect(status).toHaveAttribute('aria-busy', 'true');

    const items = within(status).getAllByTestId('skeleton-item');
    expect(items).toHaveLength(4);
  });
});

describe('EmptyState', () => {
  it('renders the title as a heading and the message text', () => {
    render(<EmptyState title="Nada por aqui" message="Nenhum produto encontrado." />);

    expect(screen.getByRole('heading', { name: 'Nada por aqui' })).toBeInTheDocument();
    expect(screen.getByText('Nenhum produto encontrado.')).toBeInTheDocument();
  });

  it('renders no button when no action is given', () => {
    render(<EmptyState title="Nada por aqui" message="Nenhum produto encontrado." />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders an action button that is keyboard-operable', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <EmptyState
        title="Nada por aqui"
        message="Nenhum produto encontrado."
        action={{ label: 'Ver produtos', onClick }}
      />,
    );

    const button = screen.getByRole('button', { name: 'Ver produtos' });

    await user.tab();
    expect(button).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('ErrorState', () => {
  it('renders the given message inside an alert region', () => {
    render(<ErrorState message="Falha ao buscar os produtos." onRetry={vi.fn()} />);

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('Falha ao buscar os produtos.')).toBeInTheDocument();
  });

  it('renders a default network-error message when none is given', () => {
    render(<ErrorState onRetry={vi.fn()} />);

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('Não foi possível carregar. Verifique sua conexão.')).toBeInTheDocument();
  });

  it('calls onRetry when the retry button is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(<ErrorState onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('is keyboard-operable via both Enter and Space', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(<ErrorState onRetry={onRetry} />);

    const button = screen.getByRole('button', { name: /tentar novamente/i });

    await user.tab();
    expect(button).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(onRetry).toHaveBeenCalledTimes(1);

    await user.keyboard(' ');
    expect(onRetry).toHaveBeenCalledTimes(2);
  });
});
