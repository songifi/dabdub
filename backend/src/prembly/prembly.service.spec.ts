import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { BadRequestException } from '@nestjs/common';
import { of } from 'rxjs';
import { PremblyService } from './prembly.service';
import { premblyConfig } from '../config/prembly.config';
import { appConfig } from '../config/app.config';

const mockPost = jest.fn();
const mockRedisGet = jest.fn().mockResolvedValue(null);
const mockRedisSet = jest.fn().mockResolvedValue('OK');

const cfg = {
  apiKey: 'test-api-key',
  appId: 'test-app-id',
  baseUrl: 'https://api.prembly.com/identitypass/verification',
};

describe('PremblyService', () => {
  let service: PremblyService;

  const buildModule = async (nodeEnv: string) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PremblyService,
        { provide: HttpService, useValue: { post: mockPost } },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: { get: mockRedisGet, set: mockRedisSet },
        },
        { provide: premblyConfig.KEY, useValue: cfg },
        {
          provide: appConfig.KEY,
          useValue: { nodeEnv },
        },
      ],
    }).compile();

    return module.get<PremblyService>(PremblyService);
  };

  beforeEach(() => jest.clearAllMocks());

  describe('development environment', () => {
    beforeEach(async () => {
      service = await buildModule('development');
    });

    it('returns mock verified without calling API', async () => {
      const result = await service.verifyBvn('12345678901', 'user-1');
      expect(result.verified).toBe(true);
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('invalid BVN format throws 400 before calling API', async () => {
      await expect(service.verifyBvn('123', 'user-1')).rejects.toThrow(BadRequestException);
      expect(mockPost).not.toHaveBeenCalled();
    });
  });

  describe('production environment', () => {
    beforeEach(async () => {
      service = await buildModule('production');
    });

    it('returns verified result from API', async () => {
      mockRedisGet.mockResolvedValue(null);
      mockPost.mockReturnValue(
        of({
          data: {
            status: true,
            data: { firstname: 'John', lastname: 'Doe', birthdate: '1990-01-01' },
          },
        }),
      );

      const result = await service.verifyBvn('12345678901', 'user-1');
      expect(result.verified).toBe(true);
      expect(result.firstName).toBe('John');
    });

    it('cache hit skips API call', async () => {
      const cached = JSON.stringify({ verified: true, firstName: 'Jane', lastName: 'Doe' });
      mockRedisGet.mockResolvedValue(cached);

      const result = await service.verifyBvn('12345678901', 'user-1');
      expect(result.firstName).toBe('Jane');
      expect(mockPost).not.toHaveBeenCalled();
    });
  });
});
