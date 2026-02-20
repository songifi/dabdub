import { Injectable, Logger } from "@nestjs/common";
import { ethers } from "ethers";
import { config } from "../../config";

const ERC20_ABI = [
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function balanceOf(address account) external view returns (uint256)",
];

@Injectable()
export class RpcService {
  private readonly logger = new Logger(RpcService.name);

  async verifyTokenOnChain(
    rpcUrl: string,
    tokenAddress: string,
    symbol: string,
    decimals: number,
  ): Promise<boolean> {
    try {
      // For native tokens, skip verification
      if (tokenAddress.toLowerCase() === "native") {
        return true;
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

      const onChainSymbol = await contract.symbol();
      const onChainDecimals = await contract.decimals();

      const symbolMatch = onChainSymbol === symbol;
      const decimalsMatch = onChainDecimals === decimals;

      if (!symbolMatch || !decimalsMatch) {
        this.logger.warn(
          `Token verification mismatch for ${tokenAddress}: ` +
            `symbol match: ${symbolMatch}, decimals match: ${decimalsMatch}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to verify token on-chain: ${error.message}`,
        error,
      );
      return false;
    }
  }

  async checkNodeHealth(rpcUrl: string): Promise<boolean> {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl, null, {
        timeout: config.rpc.timeout,
      });
      const blockNumber = await provider.getBlockNumber();
      return blockNumber > 0;
    } catch (error) {
      this.logger.error(
        `Node health check failed for ${rpcUrl}: ${error.message}`,
      );
      return false;
    }
  }
}
