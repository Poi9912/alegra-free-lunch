const { logger } = require('./logger.js');

describe('logger', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('logs info messages without empty metadata', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    logger.info('ready');

    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^\[INFO\] \d{4}-\d\d-\d\dT.* - ready$/));
  });

  test('logs non-empty info metadata', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const metadata = { count: 2 };

    logger.info('ready', metadata);

    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/^\[INFO\] \d{4}-\d\d-\d\dT.* - ready$/),
      metadata
    );
  });

  test('logs error messages with supplied error details', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const details = { message: 'failed' };

    logger.error('operation failed', details);

    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(/^\[ERROR\] \d{4}-\d\d-\d\dT.* - operation failed$/),
      details
    );
  });

  test('omits empty error details', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    logger.error('operation failed');

    expect(error).toHaveBeenCalledWith(expect.stringMatching(/^\[ERROR\] \d{4}-\d\d-\d\dT.* - operation failed$/));
  });

  test('omits empty error objects', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    logger.error('operation failed', {});

    expect(error).toHaveBeenCalledWith(expect.stringMatching(/^\[ERROR\] \d{4}-\d\d-\d\dT.* - operation failed$/));
  });
});
