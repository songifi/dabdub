export class IpUtils {
  /**
   * Checks if an IP address is within a CIDR range.
   * Supports IPv4. IPv6 support can be added if needed.
   */
  static isIpInCidr(ip: string, cidr: string): boolean {
    const [range, bitsStr] = cidr.split('/');
    const bits = parseInt(bitsStr, 10);

    if (isNaN(bits)) {
      return ip === range;
    }

    const ipNum = this.ipToLong(ip);
    const rangeNum = this.ipToLong(range);
    const mask = ~(Math.pow(2, 32 - bits) - 1);

    return (ipNum & mask) === (rangeNum & mask);
  }

  private static ipToLong(ip: string): number {
    const parts = ip.split('.').map((p) => parseInt(p, 10));
    return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
  }
}
