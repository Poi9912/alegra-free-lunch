import { fireEvent, render, screen } from '@testing-library/react';
import ErrorPage from './error';

const back = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ back }),
}));

describe('ErrorPage', () => {
  test('logs the error and invokes recovery actions', () => {
    const error = new Error('render failed');
    const reset = jest.fn();
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorPage error={error} reset={reset} />);

    expect(errorLog).toHaveBeenCalledWith(error);
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    fireEvent.click(screen.getByRole('button', { name: 'Go Back' }));

    expect(reset).toHaveBeenCalledTimes(1);
    expect(back).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
  });
});
