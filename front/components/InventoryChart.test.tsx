import { act, render, screen, waitFor } from '@testing-library/react';
import InventoryChart from './InventoryChart';

let wsCallback: ((type: string, data?: unknown) => void) | undefined;

jest.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: (callback: (type: string, data?: unknown) => void) => {
    wsCallback = callback;
  },
}));

jest.mock('recharts', () => ({
  Cell: () => null,
  Pie: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
}));

describe('InventoryChart', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    wsCallback = undefined;
  });

  test('loads inventory and displays it in descending quantity order', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        data: [
          { id: 1, ingredient_name: 'Tomato', quantity: 3 },
          { id: 2, ingredient_name: 'Rice', quantity: 8 },
        ],
      }),
    });
    render(<InventoryChart />);

    expect(screen.getByText('Loading inventory data...')).toBeInTheDocument();
    expect(await screen.findByText('Rice')).toBeInTheDocument();
    expect(screen.getByText('8 units')).toBeInTheDocument();
    expect(screen.getAllByText(/units$/)[0]).toHaveTextContent('8 units');
  });

  test('shows empty inventory when the response is not an array', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ data: null }),
    });
    render(<InventoryChart />);

    expect(await screen.findByText('No inventory data available.')).toBeInTheDocument();
  });

  test('colors known ingredients and applies the fallback color to unknown ones', async () => {
    const ingredients = [
      ['tomato', '#e22d2d'],
      ['lemon', '#a3db4f'],
      ['potato', '#ca8a04'],
      ['rice', '#c7cace'],
      ['ketchup', '#7c1616'],
      ['lettuce', '#2ba758'],
      ['onion', '#ffed67'],
      ['cheese', '#89d3fc'],
      ['meat', '#b3451a'],
      ['chicken', '#f7bd7b'],
      ['celery', '#708238'],
    ] as const;
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        data: ingredients.map(([ingredient_name], id) => ({
          id,
          ingredient_name,
          quantity: id + 1,
        })),
      }),
    });
    render(<InventoryChart />);

    for (const [name, color] of ingredients) {
      const label = await screen.findByText(name);
      expect(label.previousElementSibling).toHaveStyle({ backgroundColor: color });
    }
  });

  test('silently refreshes on inventory WebSocket events', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ data: [] }),
    });
    render(<InventoryChart />);
    await screen.findByText('No inventory data available.');

    await act(async () => {
      wsCallback?.('INVENTORY_UPDATED');
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('does not refresh on unrelated WebSocket events', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ data: [] }),
    });
    render(<InventoryChart />);
    await screen.findByText('No inventory data available.');

    act(() => wsCallback?.('ORDER_UPDATED'));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  });

  test('logs inventory request errors and finishes loading', async () => {
    const error = new Error('network down');
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    (global.fetch as jest.Mock).mockRejectedValue(error);
    render(<InventoryChart />);

    await waitFor(() => expect(consoleError).toHaveBeenCalledWith('Failed to fetch inventory', error));
    expect(screen.getByText('No inventory data available.')).toBeInTheDocument();
  });
});
