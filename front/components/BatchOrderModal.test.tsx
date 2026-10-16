import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BatchOrderModal from './BatchOrderModal';

describe('BatchOrderModal', () => {
  const onClose = jest.fn();
  const onSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  test('does not render while closed', () => {
    const { container } = render(
      <BatchOrderModal isOpen={false} onClose={onClose} onSuccess={onSuccess} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('submits the selected count and signals success', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    render(<BatchOrderModal isOpen onClose={onClose} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Queue Orders' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(global.fetch).toHaveBeenCalledWith('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 4 }),
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('shows server errors and allows the user to retry', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Queue unavailable' }),
    });
    render(<BatchOrderModal isOpen onClose={onClose} onSuccess={onSuccess} />);

    fireEvent.click(screen.getByRole('button', { name: 'Queue Orders' }));

    expect(await screen.findByText('Queue unavailable')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Queue Orders' })).toBeEnabled();
  });

  test('resets loading when the request fails without an error message', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error());
    render(<BatchOrderModal isOpen onClose={onClose} onSuccess={onSuccess} />);

    fireEvent.click(screen.getByRole('button', { name: 'Queue Orders' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Queue Orders' })).toBeEnabled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  test('closes from the close and cancel buttons', () => {
    render(<BatchOrderModal isOpen onClose={onClose} onSuccess={onSuccess} />);

    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
