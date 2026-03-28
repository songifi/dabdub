import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
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

    if (dto.phone !== undefined) {
      user.phone = dto.phone;
    }

    return this.usersRepository.save(user);
  }

  /**
   * Deactivate user account
   * @param id User UUID
   * @returns Deactivated user entity
   */
  async deactivate(id: string): Promise<User> {
    const user = await this.findById(id);
    user.isActive = false;
    return this.usersRepository.save(user);
  }

  async markEmailVerified(id: string): Promise<User> {
    const user = await this.findById(id);
    user.emailVerified = true;
    return this.usersRepository.save(user);
  }

  async markPhoneVerified(id: string): Promise<User> {
    const user = await this.findById(id);
    user.phoneVerified = true;
    return this.usersRepository.save(user);
  }
}
