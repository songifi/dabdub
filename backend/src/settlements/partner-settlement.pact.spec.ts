import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import axios from 'axios';
import * as path from 'path';

const { like, string, number } = MatchersV3;

const provider = new PactV3({
  consumer: 'CheesePay',
  provider: 'PartnerSettlementAPI',
  dir: path.resolve(__dirname, '../../../pacts'),
});

describe('Partner Settlement API - Consumer Contract', () => {
  describe('POST /transfers', () => {
    it('initiates a fiat transfer and returns a reference', async () => {
      await provider
        .given('partner API is available')
        .uponReceiving('a fiat transfer request')
        .withRequest({
          method: 'POST',
          path: '/transfers',
          headers: { 'Content-Type': 'application/json' },
          body: {
            amount: like(98.5),
            currency: string('USD'),
            merchantId: string('merchant-uuid-123'),
            reference: string('settlement-uuid-456'),
          },
        })
        .willRespondWith({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            reference: string('partner-ref-789'),
            status: string('processing'),
            amount: number(98.5),
            currency: string('USD'),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await axios.post(
            `${mockServer.url}/transfers`,
            {
              amount: 98.5,
              currency: 'USD',
              merchantId: 'merchant-uuid-123',
              reference: 'settlement-uuid-456',
            },
            { headers: { 'Content-Type': 'application/json' } },
          );

          expect(response.status).toBe(200);
          expect(response.data.reference).toBeDefined();
          expect(response.data.status).toBe('processing');
        });
    });

    it('returns 400 for invalid transfer request', async () => {
      await provider
        .given('partner API is available')
        .uponReceiving('an invalid fiat transfer request with missing amount')
        .withRequest({
          method: 'POST',
          path: '/transfers',
          headers: { 'Content-Type': 'application/json' },
          body: {
            currency: string('USD'),
            merchantId: string('merchant-uuid-123'),
            reference: string('settlement-uuid-456'),
          },
        })
        .willRespondWith({
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: {
            error: string('amount is required'),
          },
        })
        .executeTest(async (mockServer) => {
          await expect(
            axios.post(
              `${mockServer.url}/transfers`,
              { currency: 'USD', merchantId: 'merchant-uuid-123', reference: 'settlement-uuid-456' },
              { headers: { 'Content-Type': 'application/json' } },
            ),
          ).rejects.toMatchObject({ response: { status: 400 } });
        });
    });
  });
});
