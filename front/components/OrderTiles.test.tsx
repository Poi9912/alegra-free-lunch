import { fireEvent, render, screen } from '@testing-library/react';
import OrderTiles from './OrderTiles';

const orders = [
  {
    id: 1,
    order_number: 'ORD-1',
    product: 'Tomato soup',
    status: 'confirmed' as const,
    created_at: '2026-01-01T12:00:00Z',
  },
  {
    id: 2,
    order_number: 'ORD-2',
    product: 'Rice bowl',
    status: 'ready' as const,
    created_at: '2026-01-01T12:05:00Z',
  },
];

describe('OrderTiles', () => {
  test('shows loading state', () => {
    render(
      <OrderTiles
        orders={[]}
        loading
        allowedStatuses={['confirmed']}
        onAdvanceStatus={jest.fn()}
      />
    );
    expect(screen.getByText('Loading orders...')).toBeInTheDocument();
  });

  test('shows empty state when there are no allowed orders', () => {
    render(
      <OrderTiles
        orders={orders}
        loading={false}
        allowedStatuses={['cooking']}
        onAdvanceStatus={jest.fn()}
      />
    );
    expect(screen.getByText('No orders currently in [cooking] state.')).toBeInTheDocument();
  });

  test('filters orders and invokes the next-status action', () => {
    const onAdvanceStatus = jest.fn();
    render(
      <OrderTiles
        orders={orders}
        loading={false}
        allowedStatuses={['confirmed']}
        showAction
        onAdvanceStatus={onAdvanceStatus}
      />
    );

    expect(screen.getByText('ORD-1')).toBeInTheDocument();
    expect(screen.queryByText('ORD-2')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start Cooking' }));
    expect(onAdvanceStatus).toHaveBeenCalledWith(1, 'cooking');
  });

  test.each([
    ['cooking', 'Mark Ready', 'ready'],
    ['ready', 'Mark Delivered', 'delivered'],
  ] as const)('advances %s orders', (status, label, nextStatus) => {
    const onAdvanceStatus = jest.fn();
    render(
      <OrderTiles
        orders={[{ ...orders[0], status }]}
        loading={false}
        allowedStatuses={[status]}
        showAction
        onAdvanceStatus={onAdvanceStatus}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(onAdvanceStatus).toHaveBeenCalledWith(1, nextStatus);
  });

  test('does not show action for statuses without a next step', () => {
    render(
      <OrderTiles
        orders={[{ ...orders[0], status: 'created' }]}
        loading={false}
        allowedStatuses={['created']}
        showAction
        onAdvanceStatus={jest.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: 'Start Cooking' })).not.toBeInTheDocument();
  });
});
