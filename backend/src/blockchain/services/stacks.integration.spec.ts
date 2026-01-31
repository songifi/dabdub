import { Test, TestingModule } from '@nestjs/testing';
import { StacksService } from './stacks.service';
import { StacksClientService } from './stacks-client.service';
import { GlobalConfigService } from '../../config/global-config.service';

describe('Stacks Integration', () => {
    let service: StacksService;
    let clientService: StacksClientService;

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
                StacksClientService,
                { provide: GlobalConfigService, useValue: mockConfigService },
            ],
        }).compile();

        service = module.get<StacksService>(StacksService);
        clientService = module.get<StacksClientService>(StacksClientService);
    });

    describe('End-to-End Flow (Simulation)', () => {
        it('should generate a wallet and build a STX transfer', async () => {
            const wallet = await service.generateNewWallet();
            expect(wallet.address).toBeDefined();

            // Mock getNonce for the build call
            jest.spyOn(service, 'getNonce').mockResolvedValue(0n);

            const tx = await service.buildStxTransfer({
                recipient: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
                amount: 1000000n,
                senderKey: wallet.privateKey,
            });

            expect(tx).toBeDefined();
            expect(tx.auth.spendingCondition.signer).toBeDefined();
        });

        it('should fetch and parse a block with transactions', async () => {
            // Mock the API client for getBlock
            const mockBlockData = { hash: 'test-hash', burn_block_time: 1625097600 };
            const mockTxsData = {
                results: [
                    {
                        tx_id: 'tx-1',
                        sender_address: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
                        tx_type: 'token_transfer',
                        token_transfer: { recipient_address: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM', amount: '5000' },
                        burn_block_time: 1625097600
                    }
                ]
            };

            jest.spyOn(service.getApiClient(), 'GET')
                .mockImplementation((path: any) => {
                    if (path === '/extended/v1/block/by_height/{height}') {
                        return Promise.resolve({ data: mockBlockData, error: null }) as any;
                    }
                    if (path === '/extended/v1/tx/block_height/{height}') {
                        return Promise.resolve({ data: mockTxsData, error: null }) as any;
                    }
                    return Promise.resolve({ data: null, error: 'Not found' }) as any;
                });

            const block = await clientService.getBlock(100n);
            expect(block.number).toBe('100');
            expect(block.transactions.length).toBe(1);
            expect(block.transactions[0].amount).toBe('5000');
        });
    });
});
