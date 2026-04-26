import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";

@ApiTags("health")
@SkipThrottle()
@Controller("health")
export class HealthController {
  @Get()
  @ApiOperation({ summary: "Health check" })
  check() {
    return { status: "ok" };
  }
}
