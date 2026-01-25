/**
 * Cache key naming conventions and builder utility
 *
 * Format: {prefix}:{entity}:{identifier}:{suffix?}
 * Examples:
 * - user:profile:123
 * - payment:request:abc-123
 * - transaction:list:user:123:page:1
 * - rate:limit:ip:192.168.1.1
 */

export class CacheKeyBuilder {
  private static readonly PREFIX = 'dabdub';

  /**
   * Build a cache key with consistent naming convention
   */
  static build(...parts: (string | number | undefined)[]): string {
    const validParts = parts.filter(
      (part) => part !== undefined && part !== null,
    );
    return [this.PREFIX, ...validParts.map(String)].join(':');
  }

  /**
   * Build user-related cache keys
   */
  static user = {
    profile: (userId: string | number): string =>
      this.build('user', 'profile', userId),
    preferences: (userId: string | number): string =>
      this.build('user', 'preferences', userId),
    session: (sessionId: string): string =>
      this.build('user', 'session', sessionId),
    wallet: (userId: string | number): string =>
      this.build('user', 'wallet', userId),
  };

  /**
   * Build payment-related cache keys
   */
  static payment = {
    request: (paymentId: string): string =>
      this.build('payment', 'request', paymentId),
    status: (paymentId: string): string =>
      this.build('payment', 'status', paymentId),
    history: (userId: string | number, page?: number): string =>
      this.build(
        'payment',
        'history',
        userId,
        page ? `page:${page}` : undefined,
      ),
    byMerchant: (merchantId: string | number, page?: number): string =>
      this.build(
        'payment',
        'merchant',
        merchantId,
        page ? `page:${page}` : undefined,
      ),
  };

  /**
   * Build transaction-related cache keys
   */
  static transaction = {
    detail: (txId: string): string => this.build('transaction', 'detail', txId),
    list: (userId: string | number, filters?: string): string =>
      this.build('transaction', 'list', userId, filters),
    blockchain: (txHash: string, network?: string): string =>
      this.build('transaction', 'blockchain', txHash, network),
  };

  /**
   * Build rate limiting cache keys
   */
  static rateLimit = {
    ip: (ip: string, endpoint: string): string =>
      this.build('rate', 'limit', 'ip', ip, endpoint),
    user: (userId: string | number, endpoint: string): string =>
      this.build('rate', 'limit', 'user', userId, endpoint),
    apiKey: (apiKey: string, endpoint: string): string =>
      this.build('rate', 'limit', 'apikey', apiKey, endpoint),
  };

  /**
   * Build blockchain-related cache keys
   */
  static blockchain = {
    balance: (address: string, network: string): string =>
      this.build('blockchain', 'balance', address, network),
    networkStatus: (network: string): string =>
      this.build('blockchain', 'network', network, 'status'),
    gasPrice: (network: string): string =>
      this.build('blockchain', 'gas', network, 'price'),
  };

  /**
   * Build API-related cache keys
   */
  static api = {
    response: (endpoint: string, params?: string): string =>
      this.build('api', 'response', endpoint, params),
    list: (resource: string, filters?: string): string =>
      this.build('api', 'list', resource, filters),
  };

  /**
   * Build configuration cache keys
   */
  static config = {
    feature: (featureName: string): string =>
      this.build('config', 'feature', featureName),
    settings: (category: string): string =>
      this.build('config', 'settings', category),
  };

  /**
   * Build pattern for cache invalidation (supports wildcards)
   */
  static pattern(...parts: (string | number | undefined)[]): string {
    return this.build(...parts) + '*';
  }

  /**
   * Build namespace pattern for bulk invalidation
   */
  static namespace(entity: string): string {
    return this.build(entity) + ':*';
  }
}
