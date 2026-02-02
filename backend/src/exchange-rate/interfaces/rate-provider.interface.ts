export interface RateProvider {
  name: string;
  getRate(pair: string): Promise<number>;
}
