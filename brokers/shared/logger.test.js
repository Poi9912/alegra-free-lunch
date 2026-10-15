const { logger } = require('./logger.js');

describe('logger', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('logs info without empty metadata', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    logger.info('worker started');

    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/^\[INFO\] \d{4}-\d\d-\d\dT.* - worker started$/)
    );
  });

  test('logs non-empty info metadata', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const metadata = { worker: 'cooking' };

    logger.info('worker started', metadata);

    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/^\[INFO\] \d{4}-\d\d-\d\dT.* - worker started$/),
      metadata
    );
  });

  test('logs errors without empty details', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    logger.error('worker failed', {});

    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(/^\[ERROR\] \d{4}-\d\d-\d\dT.* - worker failed$/)
    );
  });

  test('logs non-empty error details', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const details = { message: 'failed' };

    logger.error('worker failed', details);

    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(/^\[ERROR\] \d{4}-\d\d-\d\dT.* - worker failed$/),
      details
    );
  });
});
