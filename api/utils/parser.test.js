const { EventEmitter } = require('node:events');
const { parseJsonBody } = require('./parser.js');

function requestFrom(chunks = []) {
  const req = new EventEmitter();
  const result = parseJsonBody(req);
  for (const chunk of chunks) req.emit('data', chunk);
  req.emit('end');
  return result;
}

describe('parseJsonBody', () => {
  test('parses JSON split across multiple request chunks', async () => {
    await expect(requestFrom(['{"name":', '"soup"}'])).resolves.toEqual({ name: 'soup' });
  });

  test('returns an empty object for an empty body', async () => {
    await expect(requestFrom()).resolves.toEqual({});
  });

  test('rejects malformed JSON with a stable error message', async () => {
    await expect(requestFrom(['{broken'])).rejects.toThrow('Invalid JSON payload');
  });

  test('rejects request stream errors', async () => {
    const req = new EventEmitter();
    const result = parseJsonBody(req);
    const streamError = new Error('request stream failed');
    req.emit('error', streamError);

    await expect(result).rejects.toBe(streamError);
  });
});
