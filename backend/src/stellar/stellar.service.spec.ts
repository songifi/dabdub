import { Test, TestingModule } from '@nestjs/testing';
import { StellarService } from './stellar.service';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';

// Mock Stellar SDK
jest.mock('@stellar/stellar-sdk', () => {
    return {
        Horizon: {
            Server: jest.fn().mockImplementation(() => ({
                loadAccount: jest.fn().mockResolvedValue({
                    id: 'G...',
                    balances: [{ asset_type: 'native', balance: '100' }],
                }),
                submitTransaction: jest.fn().mockResolvedValue({
                    hash: 'tx_hash',
                }),
                payments: jest.fn().mockReturnThis(),
                forAccount: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                call: jest.fn().mockResolvedValue({ records: [] }),
                cursor: jest.fn().mockReturnThis(),
                stream: jest.fn().mockReturnValue(() => { }),
                friendbot: jest.fn().mockReturnThis(),
            })),
        },
        Keypair: {
            random: jest.fn().mockReturnValue({
                publicKey: () => 'G_RANDOM_PUBLIC',
                secret: () => 'S_RANDOM_SECRET',
            }),
            fromSecret: jest.fn().mockReturnValue({
                publicKey: () => 'G_SOURCE_PUBLIC',
                sign: jest.fn(),
            }),
        },
        Asset: {
            native: jest.fn().mockReturnValue({ isNative: () => true }),
        },
        TransactionBuilder: jest.fn().mockImplementation(() => ({
            addOperation: jest.fn().mockReturnThis(),
            addMemo: jest.fn().mockReturnThis(),
            setTimeout: jest.fn().mockReturnThis(),
            build: jest.fn().mockReturnValue({
                sign: jest.fn(),
                toXDR: jest.fn().mockReturnValue('mock_xdr'),
            }),
        })),
        Operation: {
            payment: jest.fn(),
            changeTrust: jest.fn(),
        },
        Memo: {
            text: jest.fn(),
        },
        Networks: {
            TESTNET: 'TESTNET',
        },
        BASE_FEE: 100,
    };
});
// Need to re-assign static methods for TransactionBuilder since jest.mock hoists
(StellarSdk.TransactionBuilder as any).fromXDR = jest.fn().mockReturnValue({});


describe('StellarService', () => {
    let service: StellarService;
    let configService: ConfigService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StellarService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key, defaultValue) => defaultValue || 'mock_value'),
                    },
                },
            ],
        }).compile();

        service = module.get<StellarService>(StellarService);
        configService = module.get<ConfigService>(ConfigService);

        // Trigger onModuleInit manually if needed, or rely on Nest
        service.onModuleInit();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should create an account', async () => {
        const account = await service.createAccount();
        expect(account).toHaveProperty('publicKey');
        expect(account).toHaveProperty('secret');
    });

    it('should build a payment transaction', async () => {
        const xdr = await service.buildPaymentTransaction('S_SECRET', 'G_DEST', '10', 'XLM', 'memo');
        expect(xdr).toBe('mock_xdr');
    });

    it('should submit a transaction', async () => {
        const result = await service.submitTransaction('mock_xdr');
        expect(result).toHaveProperty('hash');
    });
});
