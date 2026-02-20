import { Test, TestingModule } from "@nestjs/testing";
import { BlockchainConfigService } from "./blockchain-config.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BlockchainConfig } from "../entities/blockchain-config.entity";
import { AuditService } from "./audit.service";
import { CacheService } from "./cache.service";
import { EventService } from "./event.service";
import { EncryptionService } from "./encryption.service";
import { RpcService } from "./rpc.service";

describe("BlockchainConfigService", () => {
  let service: BlockchainConfigService;
  let mockBlockchainRepository: any;
  let mockAuditService: any;
  let mockCacheService: any;
  let mockEventService: any;
  let mockEncryptionService: any;
  let mockRpcService: any;

  beforeEach(async () => {
    mockBlockchainRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    mockAuditService = {
      log: jest.fn(),
    };

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      getChainConfigKey: jest.fn((id) => `chain:${id}`),
      getChainListKey: jest.fn(() => "chains:all"),
    };

    mockEventService = {
      publishChainConfigUpdated: jest.fn(),
    };

    mockEncryptionService = {
      decrypt: jest.fn((val) => val),
      encrypt: jest.fn((val) => val),
    };

    mockRpcService = {
      checkNodeHealth: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainConfigService,
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
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
        {
          provide: RpcService,
          useValue: mockRpcService,
        },
      ],
    }).compile();

    service = module.get<BlockchainConfigService>(BlockchainConfigService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getAllChains", () => {
    it("should return cached chains if available", async () => {
      const mockChains = [{ chainId: "base", displayName: "Base" }];
      mockCacheService.get.mockResolvedValueOnce(mockChains);

      const result = await service.getAllChains();

      expect(result).toEqual(mockChains);
      expect(mockBlockchainRepository.find).not.toHaveBeenCalled();
    });

    it("should fetch and cache chains if not cached", async () => {
      const mockChains = [
        {
          id: "1",
          chainId: "base",
          displayName: "Base",
          rpcUrl: "https://mainnet.base.org",
          fallbackRpcUrl: null,
        },
      ];

      mockCacheService.get.mockResolvedValueOnce(null);
      mockBlockchainRepository.find.mockResolvedValueOnce(mockChains);

      const result = await service.getAllChains();

      expect(result).toBeDefined();
      expect(result[0].nodeStatus).toBeDefined();
      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  describe("updateChain", () => {
    it("should update chain and publish event", async () => {
      const chainId = "base";
      const mockChain = {
        id: "1",
        chainId,
        isEnabled: true,
        requiredConfirmations: 12,
        pollingIntervalSeconds: 30,
      };

      mockBlockchainRepository.findOne.mockResolvedValueOnce(mockChain);
      mockBlockchainRepository.save.mockResolvedValueOnce({
        ...mockChain,
        requiredConfirmations: 15,
      });

      const updateDto = { requiredConfirmations: 15 };

      const result = await service.updateChain(chainId, updateDto);

      expect(result).toBeDefined();
      expect(mockBlockchainRepository.save).toHaveBeenCalled();
      expect(mockEventService.publishChainConfigUpdated).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalled();
    });
  });
});
