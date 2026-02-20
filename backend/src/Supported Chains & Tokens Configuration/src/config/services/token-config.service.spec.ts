import { Test, TestingModule } from "@nestjs/testing";
import { TokenConfigService } from "./token-config.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { TokenConfig } from "../entities/token-config.entity";
import { BlockchainConfig } from "../entities/blockchain-config.entity";
import { AuditService } from "./audit.service";
import { CacheService } from "./cache.service";
import { EventService } from "./event.service";
import { RpcService } from "./rpc.service";
import { EncryptionService } from "./encryption.service";

describe("TokenConfigService", () => {
  let service: TokenConfigService;
  let mockTokenRepository: any;
  let mockBlockchainRepository: any;
  let mockAuditService: any;
  let mockCacheService: any;
  let mockEventService: any;
  let mockRpcService: any;
  let mockEncryptionService: any;

  beforeEach(async () => {
    mockTokenRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockBlockchainRepository = {
      findOne: jest.fn(),
    };

    mockAuditService = {
      log: jest.fn(),
    };

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      getTokensKey: jest.fn((chainId) =>
        chainId ? `tokens:${chainId}` : "tokens:all",
      ),
      getTokenKey: jest.fn((id) => `token:${id}`),
    };

    mockEventService = {
      publishTokenAdded: jest.fn(),
      publishTokenUpdated: jest.fn(),
      publishTokenDisabled: jest.fn(),
    };

    mockRpcService = {
      verifyTokenOnChain: jest.fn().mockResolvedValue(true),
    };

    mockEncryptionService = {
      decrypt: jest.fn((val) => val),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenConfigService,
        {
          provide: getRepositoryToken(TokenConfig),
          useValue: mockTokenRepository,
        },
        {
          provide: getRepositoryToken(BlockchainConfig),
          useValue: mockBlockchainRepository,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: EventService,
          useValue: mockEventService,
        },
        {
          provide: RpcService,
          useValue: mockRpcService,
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
      ],
    }).compile();

    service = module.get<TokenConfigService>(TokenConfigService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createToken", () => {
    it("should create a new token with isEnabled = false", async () => {
      const createDto = {
        chainId: "base",
        tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        minimumAcceptedAmount: "0.01",
      };

      const mockChain = {
        id: "1",
        chainId: "base",
        rpcUrl: "https://rpc.example.com",
      };
      const createdToken = {
        id: "1",
        ...createDto,
        isEnabled: false,
        isNative: false,
      };

      mockBlockchainRepository.findOne.mockResolvedValueOnce(mockChain);
      mockTokenRepository.findOne.mockResolvedValueOnce(null);
      mockTokenRepository.create.mockReturnValueOnce(createdToken);
      mockTokenRepository.save.mockResolvedValueOnce(createdToken);

      const result = await service.createToken(createDto);

      expect(result).toBeDefined();
      expect(result.isEnabled).toBe(false);
      expect(mockEventService.publishTokenAdded).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalled();
    });
  });

  describe("updateToken", () => {
    it("should update token configuration", async () => {
      const tokenId = "1";
      const mockToken = {
        id: tokenId,
        symbol: "USDC",
        chainId: "base",
        isEnabled: false,
        minimumAcceptedAmount: 0.01,
      };

      const updateDto = {
        isEnabled: true,
        minimumAcceptedAmount: "0.05",
      };

      mockTokenRepository.findOne.mockResolvedValueOnce(mockToken);
      mockTokenRepository.save.mockResolvedValueOnce({
        ...mockToken,
        ...updateDto,
        minimumAcceptedAmount: 0.05,
      });

      const result = await service.updateToken(tokenId, updateDto);

      expect(result).toBeDefined();
      expect(mockEventService.publishTokenUpdated).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalled();
    });
  });

  describe("deleteToken", () => {
    it("should soft-disable token", async () => {
      const tokenId = "1";
      const mockToken = {
        id: tokenId,
        symbol: "USDC",
        chainId: "base",
        isEnabled: true,
      };

      mockTokenRepository.findOne.mockResolvedValueOnce(mockToken);
      mockTokenRepository.save.mockResolvedValueOnce({
        ...mockToken,
        isEnabled: false,
      });

      await service.deleteToken(tokenId);

      expect(mockEventService.publishTokenDisabled).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalled();
    });
  });
});
