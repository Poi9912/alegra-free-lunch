export default {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/coverage/',
    'config\\.js$',
    '(^|/)index\\.js$',
  ],
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/*config.js',
    '!**/index.js',
    '!**/*.test.js',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/coverage/',
    'config\\.js$',
    '(^|/)index\\.js$',
  ],
  coverageReporters: ['text', 'lcov', 'json', 'clover'],
  reporters: ['jest-silent-reporter'],
};
