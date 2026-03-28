import { BadGatewayException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SorobanService } from './soroban.service';
import type { SimulationResult } from './soroban.client';

const configValues: Record<string, string> = {
  STELLAR_RPC_URL: 'https://rpc.testnet.stellar.org',
  CONTRACT_ID: 'CA_TEST_CONTRACT',
  ADMIN_SECRET_KEY: 'SADMINSECRETKEYEXAMPLE123456789',
  STELLAR_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
};

const mockConfigService = {
  get: jest.fn((key: string) => configValues[key]),
} as unknown as ConfigService;

describe('SorobanService', () => {
  let service: SorobanService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SorobanService(mockConfigService);
  });

  it.each([
    [3, HttpStatus.SERVICE_UNAVAILABLE],
    [5, HttpStatus.BAD_REQUEST],
    [6, HttpStatus.NOT_FOUND],
    [7, HttpStatus.FORBIDDEN],
    [8, HttpStatus.BAD_REQUEST],
  ])('maps contract error code %i to HTTP %i', (code, status) => {
    const exception = service.mapContractErrorCode(code);
    expect(exception).toBeInstanceOf(HttpException);
    expect(exception.getStatus()).toBe(status);
  });

  it('maps unknown contract code to BadGatewayException', () => {
    const exception = service.mapContractErrorCode(999);
    expect(exception).toBeInstanceOf(BadGatewayException);
    expect(exception.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
  });

  it('does not submit when write simulation fails', async () => {
    const simulateSpy = jest
      .spyOn(service.server, 'simulateTransaction')
      .mockResolvedValue({
        ok: false,
        error: 'rpc timeout',
      } as SimulationResult);
    const sendSpy = jest.spyOn(service.server, 'sendTransaction');

    await expect(service.deposit('alice', '100')).rejects.toThrow(
      BadGatewayException,
    );
    expect(simulateSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('treats write simulation contract error as gateway failure', async () => {
    jest.spyOn(service.server, 'simulateTransaction').mockResolvedValue({
      ok: false,
      contractErrorCode: 5,
    } as SimulationResult);
    const sendSpy = jest.spyOn(service.server, 'sendTransaction');

    await expect(service.withdraw('alice', '50')).rejects.toThrow(
      BadGatewayException,
    );
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('maps read simulation XDR contract errors to typed HTTP exceptions', async () => {
    jest.spyOn(service.server, 'simulateTransaction').mockResolvedValue({
      ok: false,
      contractErrorXdr: 'contract_error code: 5',
    } as SimulationResult);

    await expect(service.getBalance('alice')).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    });
  });

  it('maps submit XDR contract errors to typed HTTP exceptions', async () => {
    jest.spyOn(service.server, 'simulateTransaction').mockResolvedValue({
      ok: true,
      result: { simulated: true },
    } as SimulationResult);
    jest.spyOn(service.server, 'sendTransaction').mockResolvedValue({
      ok: false,
      contractErrorXdr: 'contract_error code: 3',
    });

    await expect(service.pause()).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });

  it('submits when simulation succeeds', async () => {
    jest.spyOn(service.server, 'simulateTransaction').mockResolvedValue({
      ok: true,
      result: { simulated: true },
    } as SimulationResult);
    const sendSpy = jest
      .spyOn(service.server, 'sendTransaction')
      .mockResolvedValue({
        ok: true,
        result: { txHash: 'abc123' },
      });

    await expect(service.pause()).resolves.toEqual({ txHash: 'abc123' });
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });
});
