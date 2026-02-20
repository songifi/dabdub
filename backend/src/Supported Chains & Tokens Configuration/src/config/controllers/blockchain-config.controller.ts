import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import { BlockchainConfigService } from "../services/blockchain-config.service";
import { UpdateChainConfigDto } from "../dtos/update-chain-config.dto";

@Controller("api/v1/config/chains")
export class BlockchainConfigController {
  private readonly logger = new Logger(BlockchainConfigController.name);

  constructor(
    private readonly blockchainConfigService: BlockchainConfigService,
  ) {}

  @Get()
  async getChains(@Req() req: Request) {
    const chains = await this.blockchainConfigService.getAllChains();
    return {
      success: true,
      data: chains,
      count: chains.length,
    };
  }

  @Get(":chainId")
  async getChain(@Param("chainId") chainId: string, @Req() req: Request) {
    const chain = await this.blockchainConfigService.getChainById(chainId);

    if (!chain) {
      return {
        success: false,
        error: `Chain config not found for ${chainId}`,
        statusCode: HttpStatus.NOT_FOUND,
      };
    }

    return {
      success: true,
      data: chain,
    };
  }

  @Patch(":chainId")
  @HttpCode(HttpStatus.OK)
  async updateChain(
    @Param("chainId") chainId: string,
    @Body() updateDto: UpdateChainConfigDto,
    @Req() req: Request,
  ) {
    try {
      const userId = req.user?.["id"];
      const ipAddress = this.getClientIp(req);

      const updatedChain = await this.blockchainConfigService.updateChain(
        chainId,
        updateDto,
        userId,
        ipAddress,
      );

      return {
        success: true,
        data: updatedChain,
        message: `Chain config updated for ${chainId}`,
      };
    } catch (error) {
      this.logger.error(`Failed to update chain: ${error.message}`, error);
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
