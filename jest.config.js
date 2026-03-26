module.exports = {
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
  testMatch: ['**/tests/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/\\.worktrees/'],
  modulePathIgnorePatterns: ['/\\.worktrees/'],
  watchPathIgnorePatterns: ['/\\.worktrees/'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  verbose: true,
};
