import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Stars } from './Stars.js';

describe('Stars', () => {
  it('renders an accessible label with the value and max', () => {
    render(<Stars value={3.6} max={5} />);

    expect(screen.getByRole('img', { name: 'Nota 3.6 de 5' })).toBeInTheDocument();
  });

  it('fills the rounded number of stars', () => {
    render(<Stars value={3.6} max={5} />);

    const img = screen.getByRole('img', { name: 'Nota 3.6 de 5' });
    const filled = within(img).getAllByTestId('star-filled');
    const empty = within(img).getAllByTestId('star-empty');

    expect(filled).toHaveLength(4);
    expect(empty).toHaveLength(1);
  });

  it('renders the count in parentheses when given', () => {
    render(<Stars value={4} count={12} />);

    expect(screen.getByText('(12)')).toBeInTheDocument();
  });

  it('does not render a count when it is not given', () => {
    render(<Stars value={4} />);

    expect(screen.queryByText(/^\(\d/)).not.toBeInTheDocument();
  });

  it('renders a count of 0 when explicitly given', () => {
    render(<Stars value={0} count={0} />);

    expect(screen.getByText('(0)')).toBeInTheDocument();
  });
});
