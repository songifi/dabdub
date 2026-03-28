import { Controller, Get, Patch, Body, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Controller({ path: 'users', version: '1' })
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  /**
   * Get authenticated user's profile
   * @returns User profile without passwordHash
   */
  @Get('me')
  @ApiOperation({ summary: 'Get authenticated user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getProfile(@Req() req: any): Promise<UserResponseDto> {
    const user = await this.usersService.findById(req.user.id);
    return UserResponseDto.fromEntity(user);
  }

  /**
   * Update authenticated user's profile
   * @param dto Updated profile data
   * @returns Updated user profile
   */
  @Patch('me')
  @ApiOperation({ summary: 'Update authenticated user profile' })
  @ApiResponse({
    status: 200,
    description: 'Updated user profile',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async updateProfile(
    @Req() req: any,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.update(req.user.id, dto);
    return UserResponseDto.fromEntity(user);
  }
}
