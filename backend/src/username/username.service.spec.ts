import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UsernameService } from '../src/username/username.service';
import { User } from '../src/users/entities/user.entity';
import { UsernameHistory } from '../src/username/entities/username-history.entity';
import { Wallet } from '../src/wallets/entities/wallet.entity';
import { SorobanService } from '../src/soroban/soroban.service';

describe('UsernameService', () => {
  let service: UsernameService;
  let userRepo: any;
  let historyRepo: any;
  let walletRepo: any;
  let sorobanService: any;
  let dataSource: any;

  const mockUser = {
    id: 'user-1',
    username: 'old_user',
  };

  const mockWallet = {
    userId: 'user-1',
    stellarAddress: 'GBC...',
  };

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    historyRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    walletRepo = {
      findOne: jest.fn(),
    };
    sorobanService = {
      registerUser: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn((cb) => cb({
        save: jest.fn((entity) => Promise.resolve(entity)),
        create: jest.fn((cls, data) => ({ ...data })),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsernameService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(UsernameHistory), useValue: historyRepo },
        { provide: getRepositoryToken(Wallet), useValue: walletRepo },
        { provide: SorobanService, useValue: sorobanService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<UsernameService>(UsernameService);
  });

  describe('isAvailable', () => {
    it('should return false for invalid format (too short)', async () => {
      const result = await service.isAvailable('ab');
      expect(result.available).toBe(false);
      expect(result.reason).toContain('3-20 characters');
    });

    it('should return false for invalid characters', async () => {
      const result = await service.isAvailable('user@name');
      expect(result.available).toBe(false);
      expect(result.reason).toContain('Lowercase letters, numbers, and underscores only');
    });

    it('should return false for consecutive underscores', async () => {
      const result = await service.isAvailable('user__name');
      expect(result.available).toBe(false);
      expect(result.reason).toContain('Consecutive underscores');
    });

    it('should return false for reserved words', async () => {
      const result = await service.isAvailable('admin');
      expect(result.available).toBe(false);
      expect(result.reason).toContain('reserved');
    });

    it('should return false if username is taken', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      const result = await service.isAvailable('taken_user');
      expect(result.available).toBe(false);
      expect(result.reason).toBe('Username already taken');
    });

    it('should return true for valid available username', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const result = await service.isAvailable('valid_user');
      expect(result.available).toBe(true);
    });
  });

  describe('change', () => {
    it('should throw BadRequestException if username is not available', async () => {
      userRepo.findOne.mockResolvedValue(mockUser); // taken
      await expect(service.change('user-1', 'taken_user')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if cooldown is active', async () => {
      userRepo.findOne.mockResolvedValue(null); // available check for newUsername
      userRepo.findOne.mockImplementation(({ where }) => {
          if (where.username === 'new_user') return null;
          if (where.id === 'user-1') return mockUser;
          return null;
      });
      walletRepo.findOne.mockResolvedValue(mockWallet);
      
      const recentChange = {
        changedAt: new Date(), // Just now
      };
      historyRepo.findOne.mockResolvedValue(recentChange);

      await expect(service.change('user-1', 'new_user')).rejects.toThrow(/change your username once every 30 days/);
    });

    it('should successfully change username and sync to Soroban', async () => {
      // 1. isAvailable check for 'new_user'
      userRepo.findOne.mockImplementation(({ where }) => {
        if (where.username === 'new_user') return null;
        if (where.id === 'user-1') return { ...mockUser };
        return null;
      });
      walletRepo.findOne.mockResolvedValue(mockWallet);
      historyRepo.findOne.mockResolvedValue(null); // No previous changes
      
      const result = await service.change('user-1', 'new_user');

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(sorobanService.registerUser).toHaveBeenCalledWith('new_user', mockWallet.stellarAddress);
      expect(result.username).toBe('new_user');
    });

    it('should throw if Soroban sync fails', async () => {
      userRepo.findOne.mockImplementation(({ where }) => {
        if (where.username === 'new_user') return null;
        if (where.id === 'user-1') return { ...mockUser };
        return null;
      });
      walletRepo.findOne.mockResolvedValue(mockWallet);
      historyRepo.findOne.mockResolvedValue(null);
      sorobanService.registerUser.mockRejectedValue(new Error('Blockchain error'));

      await expect(service.change('user-1', 'new_user')).rejects.toThrow(/Failed to sync username to blockchain/);
    });
  });
});
