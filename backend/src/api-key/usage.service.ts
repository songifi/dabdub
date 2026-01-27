@Injectable()
export class ApiKeyUsageService {
  constructor(
    @InjectRepository(ApiKeyUsage) private usageRepo: Repository<ApiKeyUsage>,
    private readonly redis: Redis
  ) {}

  // Increment in Redis for speed, sync to DB later (Atomic)
  async recordUsage(apiKeyId: string) {
    const today = new Date().toISOString().split('T')[0];
    await this.redis.hincrby(`usage:${apiKeyId}`, today, 1);
  }

  async getStatistics(apiKeyId: string) {
    // Returns daily breakdown of API calls
    return this.redis.hgetall(`usage:${apiKeyId}`);
  }
}