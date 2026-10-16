import { act, render, screen, waitFor } from '@testing-library/react';
import KioskPage from './page';

describe('KioskPage', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('shows only active kitchen statuses and polls periodically', async () => {
    jest.useFakeTimers();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 1, order_number: 'ORD-1', product: 'Soup', status: 'confirmed' },
          { id: 2, order_number: 'ORD-2', product: 'Rice', status: 'cooking' },
          { id: 3, order_number: 'ORD-3', product: 'Salad', status: 'ready' },
          { id: 4, order_number: 'ORD-4', product: 'Old', status: 'delivered' },
        ],
      }),
    });
    render(<KioskPage />);

    expect(await screen.findByText('ORD-1')).toBeInTheDocument();
    expect(screen.getByText('ORD-2')).toBeInTheDocument();
    expect(screen.getByText('ORD-3')).toBeInTheDocument();
    expect(screen.queryByText('ORD-4')).not.toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(4000);
    });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });

  test('logs fetch errors and ignores unsuccessful HTTP responses', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: false });
    render(<KioskPage />);

    await waitFor(() => expect(errorLog).toHaveBeenCalledWith(expect.any(Error)));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('shows no active order cards when response data is not an array', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: null }),
    });
    render(<KioskPage />);

    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/ORD-/)).not.toBeInTheDocument();
  });
});
