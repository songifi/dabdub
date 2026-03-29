import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BulkPaymentProcessor } from '../bulk-payment.processor';
import { BulkPayment, BulkPaymentStatus } from '../entities/bulk-payment.entity';
import { BulkPaymentRow, BulkPaymentRowStatus } from '../entities/bulk-payment-row.entity';
import { TransfersService } from '../../transfers/transfers.service';
import { UsersService } from '../../users/users.service';
import { EmailService } from '../../email/email.service';

describe('BulkPaymentProcessor', () => {
  let processor: BulkPaymentProcessor;
  let bulkPaymentRepo: Repository<BulkPayment>;
  let bulkPaymentRowRepo: Repository<BulkPaymentRow>;
  let transfersService: TransfersService;

  const mockBulkPayment = {
    id: 'bulk-1',
    initiatedBy: 'user-1',
    totalRows: 2,
    status: BulkPaymentStatus.PROCESSING,
  };

  const mockRows = [
    {
      id: 'row-1',
      rowNumber: 1,
      toUsername: 'user2',
      amountUsdc: '10.00',
      status: BulkPaymentRowStatus.PENDING,
    },
    {
      id: 'row-2',
      rowNumber: 2,
      toUsername: 'user3',
      amountUsdc: '20.00',
      status: BulkPaymentRowStatus.PENDING,
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkPaymentProcessor,
        {
          provide: getRepositoryToken(BulkPayment),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(BulkPaymentRow),
          useClass: Repository,
        },
        {
          provide: TransfersService,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendBulkPaymentSummary: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get<BulkPaymentProcessor>(BulkPaymentProcessor);
    bulkPaymentRepo = module.get<Repository<BulkPayment>>(getRepositoryToken(BulkPayment));
    bulkPaymentRowRepo = module.get<Repository<BulkPaymentRow>>(getRepositoryToken(BulkPaymentRow));
    transfersService = module.get<TransfersService>(TransfersService);
  });

  it('should process rows sequentially', async () => {
    const mockTransfer = { id: 'tx-1' };

    jest.spyOn(bulkPaymentRepo, 'findOneOrFail').mockResolvedValue(mockBulkPayment as any);
    jest.spyOn(bulkPaymentRowRepo, 'find').mockResolvedValue(mockRows as any);
    jest.spyOn(transfersService, 'create').mockResolvedValue(mockTransfer as any);
    jest.spyOn(bulkPaymentRepo, 'update').mockResolvedValue({} as any);
    jest.spyOn(bulkPaymentRowRepo, 'update').mockResolvedValue({} as any);

    const job = { data: { bulkPaymentId: 'bulk-1' } };

    await processor.process(job as any);

    expect(transfersService.create).toHaveBeenCalledTimes(2);
    expect(bulkPaymentRepo.update).toHaveBeenCalledWith('bulk-1', {
      status: BulkPaymentStatus.COMPLETED,
      successCount: 2,
      failureCount: 0,
      completedAt: expect.any(Date),
    });
  });

  it('should handle partial failures', async () => {
    const mockTransfer = { id: 'tx-1' };

    jest.spyOn(bulkPaymentRepo, 'findOneOrFail').mockResolvedValue(mockBulkPayment as any);
    jest.spyOn(bulkPaymentRowRepo, 'find').mockResolvedValue(mockRows as any);
    jest.spyOn(transfersService, 'create')
      .mockResolvedValueOnce(mockTransfer as any)
      .mockRejectedValueOnce(new Error('Transfer failed'));
    jest.spyOn(bulkPaymentRepo, 'update').mockResolvedValue({} as any);
    jest.spyOn(bulkPaymentRowRepo, 'update').mockResolvedValue({} as any);

    const job = { data: { bulkPaymentId: 'bulk-1' } };

    await processor.process(job as any);

    expect(transfersService.create).toHaveBeenCalledTimes(2);
    expect(bulkPaymentRepo.update).toHaveBeenCalledWith('bulk-1', {
      status: BulkPaymentStatus.PARTIAL_FAILURE,
      successCount: 1,
      failureCount: 1,
      completedAt: expect.any(Date),
    });
  });
});