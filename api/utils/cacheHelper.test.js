const redisClient = { get: jest.fn(), setEx: jest.fn() };
const logger = { error: jest.fn() };

jest.doMock('./db.js', () => ({ redisClient }));
jest.doMock('./logger.js', () => ({ logger }));

const { getOrSetCache } = require('./cacheHelper.js');

describe('getOrSetCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns parsed cached data without fetching or writing', async () => {
    redisClient.get.mockResolvedValue('[{"id":1}]');
    const fetchFunction = jest.fn();

    await expect(getOrSetCache('recipes', 30, fetchFunction)).resolves.toEqual([{ id: 1 }]);

    expect(fetchFunction).not.toHaveBeenCalled();
    expect(redisClient.setEx).not.toHaveBeenCalled();
  });

  test('fetches and caches data on a cache miss', async () => {
    redisClient.get.mockResolvedValue(null);
    redisClient.setEx.mockResolvedValue('OK');
    const freshData = [{ id: 2 }];
    const fetchFunction = jest.fn().mockResolvedValue(freshData);

    await expect(getOrSetCache('recipes', 30, fetchFunction)).resolves.toBe(freshData);

    expect(fetchFunction).toHaveBeenCalledTimes(1);
    expect(redisClient.setEx).toHaveBeenCalledWith('recipes', 30, JSON.stringify(freshData));
  });

  test('does not cache null results', async () => {
    redisClient.get.mockResolvedValue(null);
    const fetchFunction = jest.fn().mockResolvedValue(null);

    await expect(getOrSetCache('empty', 30, fetchFunction)).resolves.toBeNull();

    expect(redisClient.setEx).not.toHaveBeenCalled();
  });

  test('logs cache read and write failures while returning fetched data', async () => {
    const readError = new Error('read unavailable');
    const writeError = new Error('write unavailable');
    const freshData = { available: true };
    redisClient.get.mockRejectedValue(readError);
    redisClient.setEx.mockRejectedValue(writeError);

    await expect(
      getOrSetCache('fallback', 10, jest.fn().mockResolvedValue(freshData))
    ).resolves.toBe(freshData);

    expect(logger.error).toHaveBeenNthCalledWith(1, 'Cache read error for key: fallback', readError);
    expect(logger.error).toHaveBeenNthCalledWith(2, 'Cache write error for key: fallback', writeError);
  });

  test('falls back to fresh data when cached JSON is malformed', async () => {
    redisClient.get.mockResolvedValue('{bad json');
    const freshData = { source: 'database' };

    await expect(
      getOrSetCache('malformed', 10, jest.fn().mockResolvedValue(freshData))
    ).resolves.toBe(freshData);

    expect(logger.error).toHaveBeenCalledWith(
      'Cache read error for key: malformed',
      expect.any(SyntaxError)
    );
  });
});
