import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User, KycStatus } from './entities/user.entity';
import { Role } from '../rbac/rbac.types';
import { UserResponseDto } from './dto/user-response.dto';
import { TierName } from '../tier-config/entities/tier-config.entity';

describe('UsersService', () => {
  let service: UsersService;
  let repository: Repository<User>;

  const mockUser: User = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    emailVerified: false,
    username: 'testuser',
    displayName: 'Test User',
    phone: '+234801234567',
    phoneVerified: false,
    passwordHash: 'hashed_password_123',
    tier: TierName.SILVER,
    kycStatus: KycStatus.NONE,
    isAdmin: false,
    isTreasury: false,
    isMerchant: false,
    role: Role.User,
    isActive: true,
    createdAt: new Date('2026-03-26'),
    updatedAt: new Date('2026-03-26'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            countBy: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const findOneSpy = jest
        .spyOn(repository, 'findOne')
        .mockResolvedValue(mockUser);

      const result = await service.findById(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(findOneSpy).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.findById('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByEmail', () => {
    it('should return user when email found', async () => {
      const findOneSpy = jest
        .spyOn(repository, 'findOne')
        .mockResolvedValue(mockUser);

      const result = await service.findByEmail(mockUser.email);

      expect(result).toEqual(mockUser);
      expect(findOneSpy).toHaveBeenCalledWith({
        where: { email: mockUser.email },
      });
    });

    it('should return null when email not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should return user when username found', async () => {
      const findOneSpy = jest
        .spyOn(repository, 'findOne')
        .mockResolvedValue(mockUser);

      const result = await service.findByUsername(mockUser.username);

      expect(result).toEqual(mockUser);
      expect(findOneSpy).toHaveBeenCalledWith({
        where: { username: mockUser.username },
      });
    });

    it('should return null when username not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      const result = await service.findByUsername('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('existsByEmail', () => {
    it('should return true when email exists', async () => {
      jest.spyOn(repository, 'countBy').mockResolvedValue(1);

      const result = await service.existsByEmail(mockUser.email);

      expect(result).toBe(true);
    });

    it('should return false when email does not exist', async () => {
      jest.spyOn(repository, 'countBy').mockResolvedValue(0);

      const result = await service.existsByEmail('nonexistent@example.com');

      expect(result).toBe(false);
    });
  });

  describe('existsByUsername', () => {
    it('should return true when username exists', async () => {
      jest.spyOn(repository, 'countBy').mockResolvedValue(1);

      const result = await service.existsByUsername(mockUser.username);

      expect(result).toBe(true);
    });

    it('should return false when username does not exist', async () => {
      jest.spyOn(repository, 'countBy').mockResolvedValue(0);

      const result = await service.existsByUsername('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('update', () => {
    it('should update displayName', async () => {
      const updatedUser = { ...mockUser, displayName: 'Updated Display Name' };
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockUser);
      const saveSpy = jest
        .spyOn(repository, 'save')
        .mockResolvedValue(updatedUser);

      const result = await service.update(mockUser.id, {
        displayName: 'Updated Display Name',
      });

      expect(result.displayName).toBe('Updated Display Name');
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockUser.id,
          displayName: 'Updated Display Name',
        }),
      );
    });

    it('should update phone', async () => {
      const updatedUser = { ...mockUser, phone: '+234802345678' };
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(repository, 'save').mockResolvedValue(updatedUser);

      const result = await service.update(mockUser.id, {
        phone: '+234802345678',
      });

      expect(result.phone).toBe('+234802345678');
    });

    it('should update both displayName and phone', async () => {
      const updatedUser = {
        ...mockUser,
        displayName: 'New Name',
        phone: '+234802345678',
      };
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(repository, 'save').mockResolvedValue(updatedUser);

      const result = await service.update(mockUser.id, {
        displayName: 'New Name',
        phone: '+234802345678',
      });

      expect(result.displayName).toBe('New Name');
      expect(result.phone).toBe('+234802345678');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(
        service.update('nonexistent-id', { displayName: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('should set isActive to false', async () => {
      const deactivatedUser = { ...mockUser, isActive: false };
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockUser);
      const saveSpy = jest
        .spyOn(repository, 'save')
        .mockResolvedValue(deactivatedUser);

      const result = await service.deactivate(mockUser.id);

      expect(result.isActive).toBe(false);
      expect(saveSpy).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user does not exist', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.deactivate('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markEmailVerified', () => {
    it('should set emailVerified to true', async () => {
      const verifiedUser = { ...mockUser, emailVerified: true };
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockUser);
      const saveSpy = jest
        .spyOn(repository, 'save')
        .mockResolvedValue(verifiedUser);

      const result = await service.markEmailVerified(mockUser.id);

      expect(result.emailVerified).toBe(true);
      expect(saveSpy).toHaveBeenCalled();
    });
  });

  describe('markPhoneVerified', () => {
    it('should set phoneVerified to true', async () => {
      const verifiedUser = { ...mockUser, phoneVerified: true };
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockUser);
      const saveSpy = jest
        .spyOn(repository, 'save')
        .mockResolvedValue(verifiedUser);

      const result = await service.markPhoneVerified(mockUser.id);

      expect(result.phoneVerified).toBe(true);
      expect(saveSpy).toHaveBeenCalled();
    });
  });

  describe('UserResponseDto', () => {
    it('should never contain passwordHash', () => {
      const dto = UserResponseDto.fromEntity(mockUser);

      expect(dto).not.toHaveProperty('passwordHash');
    });

    it('should contain all required public fields', () => {
      const dto = UserResponseDto.fromEntity(mockUser);

      expect(dto.id).toBe(mockUser.id);
      expect(dto.email).toBe(mockUser.email);
      expect(dto.username).toBe(mockUser.username);
      expect(dto.displayName).toBe(mockUser.displayName);
      expect(dto.phone).toBe(mockUser.phone);
      expect(dto.tier).toBe(mockUser.tier);
      expect(dto.kycStatus).toBe(mockUser.kycStatus);
      expect(dto.isMerchant).toBe(mockUser.isMerchant);
      expect(dto.role).toBe(mockUser.role);
      expect(dto.createdAt).toBe(mockUser.createdAt);
    });

    it('should not contain isAdmin or isTreasury fields', () => {
      const dto = UserResponseDto.fromEntity(mockUser);

      expect(dto).not.toHaveProperty('isAdmin');
      expect(dto).not.toHaveProperty('isTreasury');
    });

    it('should handle null displayName and phone', () => {
      const userWithNulls = { ...mockUser, displayName: null, phone: null };
      const dto = UserResponseDto.fromEntity(userWithNulls);

      expect(dto.displayName).toBeNull();
      expect(dto.phone).toBeNull();
    });
  });
});
