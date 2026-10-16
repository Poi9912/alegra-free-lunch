import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const customJestConfig = {
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@components/(.*)$': '<rootDir>/components/$1',
  },
  testMatch: ['**/*.test.[jt]s?(x)'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/coverage/',
    'config\\.js$',
    '(^|/)index\\.[jt]sx?$',
  ],
  collectCoverageFrom: [
    '**/*.{js,jsx,ts,tsx}',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
    '!**/*config.{js,ts,mjs}',
    '!**/*.test.{js,jsx,ts,tsx}',
    '!**/jest.setup.*',
    '!**/next-env.d.ts',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/coverage/',
    'config\\.[jt]s$',
    '(^|/)index\\.[jt]sx?$',
  ],
  coverageReporters: ['text', 'lcov', 'json', 'clover'],
  reporters: ['jest-silent-reporter'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};

export default createJestConfig(customJestConfig);
