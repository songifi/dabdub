import { Controller, Get, Header, VERSION_NEUTRAL, Version } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { SkipResponseWrap } from '../common/decorators/skip-response-wrap.decorator';
import { CHEESE_PWA_MANIFEST } from './pwa.constants';

@Public()
@SkipResponseWrap()
@Controller('manifest.json')
export class PwaController {
  @Version(VERSION_NEUTRAL)
  @Get()
  @Header('Content-Type', 'application/manifest+json')
  getManifest() {
    return CHEESE_PWA_MANIFEST;
  }
}
