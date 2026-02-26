import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import {
  CoinGeckoFiatProvider,
  OpenExchangeRatesProvider,
} from './fiat-rate.provider';

describe('CoinGeckoFiatProvider', () => {
  let provider: CoinGeckoFiatProvider;
  let httpService: jest.Mocked<HttpService>;

  beforeEach(async () => {
    const mockHttpService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoinGeckoFiatProvider,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    provider = module.get<CoinGeckoFiatProvider>(CoinGeckoFiatProvider);
    httpService = module.get(HttpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch USD to EUR rate', async () => {
    const mockResponse = {
      data: {
        rates: {
          usd: { value: 1.0 },
          eur: { value: 0.85 },
        },
      },
    };

    httpService.get.mockReturnValue(of(mockResponse as any));

    const rate = await provider.getRate('USD', 'EUR');

    expect(rate).toBeCloseTo(0.85, 2);
    expect(httpService.get).toHaveBeenCalledWith(
      'https://api.coingecko.com/api/v3/exchange_rates',
      { timeout: 5000 },
    );
  });

  it('should calculate cross rate for NGN to GBP', async () => {
    const mockResponse = {
      data: {
        rates: {
          ngn: { value: 1500 },
          gbp: { value: 0.75 },
        },
      },
    };

    httpService.get.mockReturnValue(of(mockResponse as any));

    const rate = await provider.getRate('NGN', 'GBP');

    expect(rate).toBeCloseTo(0.0005, 6);
  });

  it('should throw error when rate not found', async () => {
    const mockResponse = {
      data: {
        rates: {
          usd: { value: 1.0 },
        },
      },
    };

    httpService.get.mockReturnValue(of(mockResponse as any));

    await expect(provider.getRate('USD', 'XYZ')).rejects.toThrow(
      'Rate not found for USD/XYZ pair',
    );
  });

  it('should throw error on invalid response', async () => {
    const mockResponse = {
      data: {},
    };

    httpService.get.mockReturnValue(of(mockResponse as any));

    await expect(provider.getRate('USD', 'EUR')).rejects.toThrow(
      'Invalid response from CoinGecko',
    );
  });

  it('should throw error on HTTP failure', async () => {
    httpService.get.mockReturnValue(
      throwError(() => new Error('Network error')),
    );

    await expect(provider.getRate('USD', 'EUR')).rejects.toThrow();
  });
});

describe('OpenExchangeRatesProvider', () => {
  let provider: OpenExchangeRatesProvider;
  let httpService: jest.Mocked<HttpService>;
  const originalEnv = process.env;

  beforeEach(async () => {
    jest.resetModules();
    process.env = { ...originalEnv, OPEN_EXCHANGE_RATES_API_KEY: 'test-key' };

    const mockHttpService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenExchangeRatesProvider,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    provider = module.get<OpenExchangeRatesProvider>(OpenExchangeRatesProvider);
    httpService = module.get(HttpService);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it('should fetch USD to EUR rate', async () => {
    const mockResponse = {
      data: {
        rates: {
          EUR: 0.85,
        },
      },
    };

    httpService.get.mockReturnValue(of(mockResponse as any));

    const rate = await provider.getRate('USD', 'EUR');

    expect(rate).toBe(0.85);
    expect(httpService.get).toHaveBeenCalledWith(
      'https://openexchangerates.org/api/latest.json',
      {
        params: {
          app_id: 'test-key',
          base: 'USD',
          symbols: 'USD,EUR',
        },
        timeout: 5000,
      },
    );
  });

  it('should fetch EUR to USD rate (inverse)', async () => {
    const mockResponse = {
      data: {
        rates: {
          EUR: 0.85,
        },
      },
    };

    httpService.get.mockReturnValue(of(mockResponse as any));

    const rate = await provider.getRate('EUR', 'USD');

    expect(rate).toBeCloseTo(1.176, 2);
  });

  it('should calculate cross rate for EUR to GBP', async () => {
    const mockResponse = {
      data: {
        rates: {
          EUR: 0.85,
          GBP: 0.75,
        },
      },
    };

    httpService.get.mockReturnValue(of(mockResponse as any));

    const rate = await provider.getRate('EUR', 'GBP');

    expect(rate).toBeCloseTo(0.882, 2);
  });

  it('should throw error when API key not configured', async () => {
    process.env.OPEN_EXCHANGE_RATES_API_KEY = '';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenExchangeRatesProvider,
        {
          provide: HttpService,
          useValue: httpService,
        },
      ],
    }).compile();

    const providerWithoutKey = module.get<OpenExchangeRatesProvider>(
      OpenExchangeRatesProvider,
    );

    await expect(providerWithoutKey.getRate('USD', 'EUR')).rejects.toThrow(
      'OpenExchangeRates API key not configured',
    );
  });

  it('should throw error when rate not found', async () => {
    const mockResponse = {
      data: {
        rates: {
          EUR: 0.85,
        },
      },
    };

    httpService.get.mockReturnValue(of(mockResponse as any));

    await expect(provider.getRate('USD', 'XYZ')).rejects.toThrow(
      'Rate not found for XYZ',
    );
  });

  it('should throw error on invalid response', async () => {
    const mockResponse = {
      data: {},
    };

    httpService.get.mockReturnValue(of(mockResponse as any));

    await expect(provider.getRate('USD', 'EUR')).rejects.toThrow(
      'Invalid response from OpenExchangeRates',
    );
  });

  it('should throw error on HTTP failure', async () => {
    httpService.get.mockReturnValue(
      throwError(() => new Error('Network error')),
    );

    await expect(provider.getRate('USD', 'EUR')).rejects.toThrow();
  });
});
