import { getStatusBadgeStyle } from './statusConfig';

describe('getStatusBadgeStyle', () => {
  test.each([
    ['created', 'bg-yellow-50'],
    ['confirmed', 'bg-blue-50'],
    ['cooking', 'bg-orange-50'],
    ['ready', 'bg-emerald-50'],
    ['delivered', 'bg-stone-100'],
  ] as const)('returns styling for %s orders', (status, expectedClass) => {
    expect(getStatusBadgeStyle(status)).toContain(expectedClass);
  });

  test('returns the generic style for an unknown status at runtime', () => {
    expect(getStatusBadgeStyle('unknown' as never)).toBe(
      'bg-stone-100 text-stone-700 border-stone-200'
    );
  });
});
