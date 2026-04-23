import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import {
  CreateGroupDto,
  GroupResponseDto,
  SearchGroupsDto,
  SetTokenGateDto,
  UpdateGroupDto,
} from './dto/groups.dto';

// Re-use the existing JWT guard from auth module
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Groups')
@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new group' })
  create(@Body() dto: CreateGroupDto, @Req() req: any): Promise<GroupResponseDto> {
    return this.groupsService.createGroup(dto, req.user.id);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search groups by name with pagination' })
  search(@Query() dto: SearchGroupsDto) {
    return this.groupsService.searchGroups(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get group by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<GroupResponseDto> {
    return this.groupsService.getGroup(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update group metadata' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGroupDto,
    @Req() req: any,
  ): Promise<GroupResponseDto> {
    return this.groupsService.updateGroup(id, dto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a group' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any): Promise<void> {
    return this.groupsService.deleteGroup(id, req.user.id);
  }

  @Post(':id/invite-code')
  @ApiOperation({ summary: 'Regenerate invite code' })
  regenerateInviteCode(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<{ inviteCode: string }> {
    return this.groupsService.generateInviteCode(id, req.user.id);
  }

  @Post('join/:inviteCode')
  @ApiOperation({ summary: 'Join group by invite code' })
  join(
    @Param('inviteCode') inviteCode: string,
    @Req() req: any,
  ): Promise<GroupResponseDto> {
    return this.groupsService.joinByInviteCode(inviteCode, req.user.id);
  }

  @Post(':id/gate')
  @ApiOperation({ summary: 'Set token gate on group' })
  setGate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetTokenGateDto,
    @Req() req: any,
  ): Promise<GroupResponseDto> {
    return this.groupsService.setTokenGate(id, dto, req.user.id);
  }

  @Delete(':id/gate')
  @ApiOperation({ summary: 'Remove token gate from group' })
  removeGate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<GroupResponseDto> {
    return this.groupsService.removeTokenGate(id, req.user.id);
  }
}
