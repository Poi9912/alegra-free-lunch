const { logger } = require('./logger.js');

describe('logger', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('logs info messages with an ISO timestamp and default metadata', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    logger.info('ready');

    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/^\[INFO\] \d{4}-\d\d-\d\dT.* - ready$/),
      {}
    );
  });

  test('logs error messages with supplied error details', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const details = new Error('failed');

    logger.error('operation failed', details);

    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(/^\[ERROR\] \d{4}-\d\d-\d\dT.* - operation failed$/),
      details
    );
  });

  test('uses empty metadata when error details are omitted', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    logger.error('operation failed');

    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(/^\[ERROR\] \d{4}-\d\d-\d\dT.* - operation failed$/),
      {}
    );
  });
});
