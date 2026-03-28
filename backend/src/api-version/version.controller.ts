import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { SkipResponseWrap } from '../common/decorators/skip-response-wrap.decorator';
import { getVersionDiscovery } from './api-version.policy';

@ApiTags('version')
@Public()
@SkipResponseWrap()
@Controller({ path: 'version', version: VERSION_NEUTRAL })
export class VersionController {
  @Get()
  @ApiOperation({ summary: 'API version discovery' })
  getVersion() {
    return getVersionDiscovery();
  }
}
