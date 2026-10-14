const { sendError } = require('./errorHandler.js');

describe('sendError', () => {
  test('writes a JSON error response with the supplied status and message', () => {
    const res = { writeHead: jest.fn(), end: jest.fn() };

    sendError(res, 422, 'Invalid input');

    expect(res.writeHead).toHaveBeenCalledWith(422, {
      'Content-Type': 'application/json',
    });
    expect(res.end).toHaveBeenCalledWith(
      JSON.stringify({ success: false, error: 'Invalid input' })
    );
  });
});
