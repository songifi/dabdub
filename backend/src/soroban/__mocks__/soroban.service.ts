export const SorobanService = jest.fn().mockImplementation(() => ({
  registerUser: jest.fn(),
  getBalance: jest.fn(),
  getStakeBalance: jest.fn(),
  getUsername: jest.fn(),
  deposit: jest.fn(),
  withdraw: jest.fn(),
  transfer: jest.fn(),
}));
