import { render, screen } from '@testing-library/react';
import RootLayout, { metadata } from './layout';

jest.mock('next/font/google', () => ({
  Geist: () => ({ variable: 'font-geist-sans' }),
  Geist_Mono: () => ({ variable: 'font-geist-mono' }),
}));

test('provides application metadata and document shell', () => {
  render(<RootLayout params={Promise.resolve({})}><main>Application body</main></RootLayout>);

  expect(metadata).toEqual({
    title: 'Restaurant System',
    description: 'Recruitment assessment for Alegra',
  });
  expect(screen.getByText('Application body')).toBeInTheDocument();
  expect(document.querySelector('html')).toHaveAttribute('lang', 'en');
});
