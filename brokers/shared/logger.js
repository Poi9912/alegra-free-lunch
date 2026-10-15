export const logger = {
  info: (msg, meta) => {
    const timestamp = new Date().toISOString();
    if (meta !== undefined && Object.keys(meta).length > 0) {
      console.log(`[INFO] ${timestamp} - ${msg}`, meta);
    } else {
      console.log(`[INFO] ${timestamp} - ${msg}`);
    }
  },
  error: (msg, err) => {
    const timestamp = new Date().toISOString();
    if (err !== undefined && Object.keys(err).length > 0) {
      console.error(`[ERROR] ${timestamp} - ${msg}`, err);
    } else {
      console.error(`[ERROR] ${timestamp} - ${msg}`);
    }
  },
};