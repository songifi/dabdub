import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AnalyticsService } from '../admin/analytics/analytics.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private analyticsService: AnalyticsService,
  ) {}

  /**
   * Find user by ID
   * @param id User UUID
   * @returns User entity or throws NotFoundException
   */
  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }

  /**
   * Find user by email
   * @param email User email
   * @returns User entity or null
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
    });
  }

  /**
   * Find user by username
   * @param username User username
   * @returns User entity or null
   */
  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { username },
    });
  }

  /**
   * Check if email already exists
   * @param email Email to check
   * @returns True if email exists
   */
  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.usersRepository.countBy({ email });
    return count > 0;
  }

  /**
   * Check if username already exists
   * @param username Username to check
   * @returns True if username exists
   */
  async existsByUsername(username: string): Promise<boolean> {
    const count = await this.usersRepository.countBy({ username });
    return count > 0;
  }

  /**
   * Update user profile
   * @param id User UUID
   * @param dto Update profile data (displayName, phone)
   * @returns Updated user entity
   */
  async update(id: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.findById(id);

    if (dto.displayName !== undefined) {
      user.displayName = dto.displayName;
    }

    if (dto.bio !== undefined) {
      if (typeof dto.bio === 'string' && dto.bio.length > 160) {
        throw new BadRequestException('Bio must be max 160 characters');
      }
      user.bio = dto.bio;
    }

    if (dto.avatarKey !== undefined) {
      user.avatarKey = dto.avatarKey;
    }

    if (dto.twitterHandle !== undefined) {
      user.twitterHandle = dto.twitterHandle;
    }

    if (dto.instagramHandle !== undefined) {
      user.instagramHandle = dto.instagramHandle;
    }

    if (dto.phone !== undefined) {
      user.phone = dto.phone;
    }

    const saved = await this.usersRepository.save(user);
    // Invalidate analytics cache on user changes
    await this.analyticsService.invalidateDashboardCache().catch(() => {});
    return saved;
  }

  /**
   * Deactivate user account
   * @param id User UUID
   * @returns Deactivated user entity
   */
  async deactivate(id: string): Promise<User> {
    const user = await this.findById(id);
    user.isActive = false;
    const saved = await this.usersRepository.save(user);
    await this.analyticsService.invalidateDashboardCache().catch(() => {});
    return saved;
  }

  async markEmailVerified(id: string): Promise<User> {
    const user = await this.findById(id);
    user.emailVerified = true;
    const saved = await this.usersRepository.save(user);
    await this.analyticsService.invalidateDashboardCache().catch(() => {});
    return saved;
  }

  async markPhoneVerified(id: string): Promise<User> {
    const user = await this.findById(id);
    user.phoneVerified = true;
    const saved = await this.usersRepository.save(user);
    await this.analyticsService.invalidateDashboardCache().catch(() => {});
    return saved;
  }

  /**
   * Find all active users for notifications
   * @returns Array of active users
   */
  async findActiveUsers(): Promise<User[]> {
    return this.usersRepository.find({
      where: { isActive: true },
      select: ['id', 'email', 'displayName', 'username'],
    });
  }
}

