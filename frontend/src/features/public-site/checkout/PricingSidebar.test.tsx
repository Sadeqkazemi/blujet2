import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PricingSidebar from './PricingSidebar';

describe('PricingSidebar seat selection pricing', () => {
  it('includes the current seat-type amount in the visible grand total', () => {
    render(
      <MemoryRouter>
      <PricingSidebar
        locale="fa"
        priceIrr="50000000"
        paxCount={1}
        passengerMix={{ adult: 1, child: 0, infant: 0 }}
        extras={[]}
        seatSelectionIrr="8000000"
        nextLabel="ادامه"
        onNext={() => undefined}
        canBack={false}
      />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('seat-selection-price-row')).toHaveTextContent('۸۰۰٬۰۰۰');
    expect(screen.getByTestId('checkout-pricing-total')).toHaveTextContent('۵٬۸۰۰٬۰۰۰');
  });
});
