import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OrdersTable from './OrdersTable';

let wsCallback: ((type: string, data?: unknown) => void) | undefined;

jest.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: (callback: (type: string, data?: unknown) => void) => {
    wsCallback = callback;
  },
}));

const orderData = [
  {
    id: 1,
    order_number: 'ORD-1',
    product: 'Soup',
    status: 'confirmed',
    created_at: '2026-01-01T12:00:00Z',
  },
  {
    id: 2,
    order_number: 'ORD-2',
    product: 'Rice bowl',
    status: 'ready',
    created_at: '2026-01-01T12:05:00Z',
  },
];

describe('OrdersTable', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: orderData }),
    });
    wsCallback = undefined;
  });

  test('loads orders and filters by status', async () => {
    render(<OrdersTable />);

    expect(screen.getByText('Loading orders...')).toBeInTheDocument();
    expect(await screen.findByText('ORD-1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ready' }));

    expect(screen.getByText('ORD-2')).toBeInTheDocument();
    expect(screen.queryByText('ORD-1')).not.toBeInTheDocument();
  });

  test('refresh button fetches orders again', async () => {
    render(<OrdersTable />);
    await screen.findByText('ORD-1');

    fireEvent.click(screen.getByRole('button', { name: 'Refresh Table' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });

  test.each(['ORDER_UPDATED', 'ORDERS_CREATED'])('refreshes for %s WebSocket events', async (type) => {
    render(<OrdersTable />);
    await screen.findByText('ORD-1');

    wsCallback?.(type);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });

  test('does not refresh for other WebSocket events', async () => {
    render(<OrdersTable />);
    await screen.findByText('ORD-1');

    wsCallback?.('INVENTORY_UPDATED');

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('shows empty state when there are no orders', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    render(<OrdersTable />);

    expect(await screen.findByText('No orders found.')).toBeInTheDocument();
  });

  test('shows request and server errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    render(<OrdersTable />);

    expect(await screen.findByText('Failed to fetch orders')).toBeInTheDocument();
  });

  test('uses an empty list when response data is malformed', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });
    render(<OrdersTable />);

    expect(await screen.findByText('No orders found.')).toBeInTheDocument();
  });
});
