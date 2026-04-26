import { Controller, Get, Query, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { SettlementsService } from "./settlements.service";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";

@ApiTags("settlements")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("settlements")
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get()
  @ApiOperation({ summary: "List settlements" })
  findAll(@Request() req, @Query("page") page = 1, @Query("limit") limit = 20) {
    return this.settlementsService.findAll(req.user.merchantId, +page, +limit);
  }
}
