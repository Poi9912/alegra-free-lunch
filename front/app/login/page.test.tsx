import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPage from './page';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    global.fetch = jest.fn();
  });

  test('posts credentials, stores the session, and navigates after successful login', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'jwt', role: 'manager' }),
    });
    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText('usuario'), { target: { value: 'alex' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alex', password: 'secret' }),
    });
    expect(localStorage.getItem('token')).toBe('jwt');
    expect(localStorage.getItem('role')).toBe('manager');
  });

  test('shows a backend login error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Bad password' }),
    });
    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText('usuario'), { target: { value: 'alex' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Bad password')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  test('uses the default error message when the response has no message', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });
    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText('usuario'), { target: { value: 'alex' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });

  test('shows fallback request errors and resets loading state', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error());
    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText('usuario'), { target: { value: 'alex' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('An error occurred during login.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  });
});
