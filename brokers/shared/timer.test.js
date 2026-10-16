import { jest } from '@jest/globals';
import { getRandomDelay } from './timer.js';

describe('getRandomDelay', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('uses the default minimum and maximum delays', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(getRandomDelay()).toBe(30000);

    Math.random.mockReturnValue(0.999999);
    expect(getRandomDelay()).toBe(45000);
  });

  test('returns an integer within the supplied inclusive range', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(getRandomDelay(10, 20)).toBe(15);
  });
});
