import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import { TokenConfigService } from "../services/token-config.service";
import { CreateTokenConfigDto } from "../dtos/create-token-config.dto";
import { UpdateTokenConfigDto } from "../dtos/update-token-config.dto";

@Controller("api/v1/config/tokens")
export class TokenConfigController {
  private readonly logger = new Logger(TokenConfigController.name);

  constructor(private readonly tokenConfigService: TokenConfigService) {}

  @Get()
  async getTokens(
    @Query("chainId") chainId?: string,
    @Query("isEnabled") isEnabled?: string,
    @Query("symbol") symbol?: string,
    @Req() req: Request = null,
  ) {
    try {
      const isEnabledBool =
        isEnabled === "true" ? true : isEnabled === "false" ? false : undefined;
      const tokens = await this.tokenConfigService.getAllTokens(
        chainId,
        isEnabledBool,
        symbol,
      );

      return {
        success: true,
        data: tokens,
        count: tokens.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get tokens: ${error.message}`, error);
      return {
        success: false,
        error: error.message,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createToken(
    @Body() createDto: CreateTokenConfigDto,
    @Req() req: Request,
  ) {
    try {
      const userId = req.user?.["id"];
      const ipAddress = this.getClientIp(req);

      const token = await this.tokenConfigService.createToken(
        createDto,
        userId,
        ipAddress,
      );

      return {
        success: true,
        data: token,
        message: `Token ${createDto.symbol} added successfully (disabled by default)`,
      };
    } catch (error) {
      this.logger.error(`Failed to create token: ${error.message}`, error);
      return {
        success: false,
        error: error.message,
        statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  async updateToken(
    @Param("id") id: string,
    @Body() updateDto: UpdateTokenConfigDto,
    @Req() req: Request,
  ) {
    try {
      const userId = req.user?.["id"];
      const ipAddress = this.getClientIp(req);

      const token = await this.tokenConfigService.updateToken(
        id,
        updateDto,
        userId,
        ipAddress,
      );

      return {
        success: true,
        data: token,
        message: `Token updated successfully`,
      };
    } catch (error) {
      this.logger.error(`Failed to update token: ${error.message}`, error);
      return {
        success: false,
        error: error.message,
        statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async deleteToken(@Param("id") id: string, @Req() req: Request) {
    try {
      const userId = req.user?.["id"];
      const ipAddress = this.getClientIp(req);

      await this.tokenConfigService.deleteToken(id, userId, ipAddress);

      return {
        success: true,
        message: `Token disabled successfully`,
      };
    } catch (error) {
      this.logger.error(`Failed to delete token: ${error.message}`, error);
      return {
        success: false,
        error: error.message,
        statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  private getClientIp(req: Request): string {
    return (
      (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
      req.socket.remoteAddress ||
      "unknown"
    );
  }
}
