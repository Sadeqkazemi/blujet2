import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FlightPathPlane from './FlightPathPlane';

describe('FlightPathPlane', () => {
  it('flips horizontally in RTL so the nose faces the destination (left)', () => {
    const { getByTestId } = render(<FlightPathPlane rtl />);
    expect(getByTestId('flight-path-plane')).toHaveStyle({ transform: 'scaleX(-1)' });
    expect(getByTestId('flight-path-plane')).toHaveAttribute('data-rtl', 'true');
  });

  it('keeps default orientation in LTR', () => {
    const { getByTestId } = render(<FlightPathPlane rtl={false} />);
    expect(getByTestId('flight-path-plane')).not.toHaveStyle({ transform: 'scaleX(-1)' });
    expect(getByTestId('flight-path-plane')).toHaveAttribute('data-rtl', 'false');
  });
});
