import { fireEvent, render, screen } from '@testing-library/react';
import NotFound from './not-found';

const back = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ back }),
}));

test('provides a back action and dashboard link for missing pages', () => {
  render(<NotFound />);

  fireEvent.click(screen.getByRole('button', { name: 'Go Back' }));

  expect(back).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute(
    'href',
    '/dashboard'
  );
});
