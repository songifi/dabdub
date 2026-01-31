import { Test, TestingModule } from '@nestjs/testing';
import { StacksService } from './stacks.service';
import { GlobalConfigService } from '../../config/global-config.service';

describe('StacksService', () => {
    let service: StacksService;
    let configService: GlobalConfigService;

    const mockConfigService = {
        getStacksConfig: jest.fn().mockReturnValue({
            activeNetwork: 'testnet',
            networks: {
                testnet: {
                    rpcUrl: 'https://api.testnet.hiro.so',
                    network: 'testnet',
                    usdcAssetIdentifier: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usd-token::usdc',
                }
            }
        }),
        getActiveStacksNetworkConfig: jest.fn().mockReturnValue({
            rpcUrl: 'https://api.testnet.hiro.so',
            network: 'testnet',
            usdcAssetIdentifier: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usd-token::usdc',
        }),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StacksService,
                { provide: GlobalConfigService, useValue: mockConfigService },
            ],
        }).compile();

        service = module.get<StacksService>(StacksService);
        configService = module.get<GlobalConfigService>(GlobalConfigService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should generate a new wallet', async () => {
        const wallet = await service.generateNewWallet();
        expect(wallet.address).toBeDefined();
        expect(wallet.mnemonic).toBeDefined();
        expect(wallet.privateKey).toBeDefined();
    });
});
