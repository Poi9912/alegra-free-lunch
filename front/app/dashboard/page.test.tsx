import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DashboardPage from './page';

const push = jest.fn();
let modalProps: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
} | undefined;
let wsCallback: ((type: string) => void) | undefined;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));
jest.mock('@components/OrdersTable', () => function MockOrdersTable() {
  return <div>Orders Table Component</div>;
});
jest.mock('@components/InventoryChart', () => function MockInventoryChart() {
  return <div>Inventory Chart Component</div>;
});
jest.mock('@components/OrderTiles', () => function MockOrderTiles(props: {
    allowedStatuses: string[];
    onAdvanceStatus: (id: number, status: string) => void;
  }) {
    return (
      <button onClick={() => props.onAdvanceStatus(7, 'cooking')}>
        Orders: {props.allowedStatuses.join(',')}
      </button>
    );
  }
);
jest.mock('@components/BatchOrderModal', () => function MockBatchOrderModal(props: {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
  }) {
    modalProps = props;
    return props.isOpen ? (
      <div>
        Batch modal open
        <button onClick={props.onClose}>Close modal</button>
        <button onClick={props.onSuccess}>Succeed modal</button>
      </div>
    ) : null;
  }
);
jest.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: (callback: (type: string) => void) => {
    wsCallback = callback;
  },
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
  });

  test('shows manager controls, loads orders, and opens batch modal', async () => {
    localStorage.setItem('role', 'manager');
    render(<DashboardPage />);

    expect(await screen.findByText('Role: manager')).toBeInTheDocument();
    expect(await screen.findByText('Orders Table Component')).toBeInTheDocument();
    expect(screen.getByText('Inventory Chart Component')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/orders', { cache: 'no-store' });

    fireEvent.click(screen.getByRole('button', { name: 'New Batch Orders' }));
    expect(screen.getByText('Batch modal open')).toBeInTheDocument();
    expect(modalProps?.isOpen).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
    fireEvent.click(screen.getByRole('button', { name: 'New Batch Orders' }));
    fireEvent.click(screen.getByRole('button', { name: 'Succeed modal' }));
  });

  test('shows operation tabs, loads recipes, and advances order status', async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => url === '/api/recipes'
        ? { data: [{ id: 1, product: 'Soup', ingredients: [{ ingredient_name: 'Rice', quantity: 2 }] }] }
        : { data: [] },
    }));
    render(<DashboardPage />);

    expect(await screen.findByText('Role: operation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Kiosk View' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Kiosk View' }));
    expect(push).toHaveBeenCalledWith('/dashboard/kiosk');
    expect(screen.getByText('Orders: confirmed,cooking')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Tab 2:/ }));
    expect(await screen.findByText('Soup')).toBeInTheDocument();
    expect(screen.getByText('Rice: 2 units')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Tab 3:/ }));
    expect(screen.getByText('Orders: ready')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Orders: ready' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/orders/7/status',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'cooking' }),
      })
    ));
  });

  test('logs out, navigates to login, and does not load recipes for manager', async () => {
    localStorage.setItem('role', 'manager');
    localStorage.setItem('token', 'secret');
    render(<DashboardPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));

    expect(localStorage.getItem('token')).toBeNull();
    expect(push).toHaveBeenCalledWith('/login');
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  });

  test('refreshes orders on relevant WebSocket events', async () => {
    localStorage.setItem('role', 'manager');
    render(<DashboardPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    wsCallback?.('INVENTORY_UPDATED');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    wsCallback?.('ORDER_UPDATED');
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });

  test('logs order fetch and status update errors', async () => {
    localStorage.setItem('role', 'operation');
    const error = new Error('network down');
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error);
    render(<DashboardPage />);

    expect(await screen.findByText('Role: operation')).toBeInTheDocument();
    await waitFor(() => expect(consoleError).toHaveBeenCalledWith(error));
    fireEvent.click(screen.getByRole('button', { name: 'Orders: confirmed,cooking' }));

    await waitFor(() => expect(consoleError).toHaveBeenCalledWith('Failed to update status', error));
  });

  test('does not refresh orders after an unsuccessful status response', async () => {
    localStorage.setItem('role', 'operation');
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockResolvedValueOnce({ json: async () => ({ data: [] }) })
      .mockResolvedValueOnce({ ok: false });
    render(<DashboardPage />);
    expect(await screen.findByText('Role: operation')).toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: 'Orders: confirmed,cooking' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
  });
});
