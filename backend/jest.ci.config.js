module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testEnvironment: 'node',
  testRegex: 'soroban/soroban\\.service\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverage: true,
  collectCoverageFrom: ['soroban/soroban.service.ts'],
  coverageThreshold: {
    global: {
      lines: 0,
      branches: 0,
    },
  },
};
