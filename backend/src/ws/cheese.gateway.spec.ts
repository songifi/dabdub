import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { CheeseGateway } from './cheese.gateway';
import { jwtConfig } from '../config/jwt.config';
import { redisConfig } from '../config/redis.config';
import type { Socket } from 'socket.io';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    hset: jest.fn().mockResolvedValue(1),
    hdel: jest.fn().mockResolvedValue(1),
    hkeys: jest.fn().mockResolvedValue([]),
    hlen: jest.fn().mockResolvedValue(0),
    keys: jest.fn().mockResolvedValue([]),
  }));
});

const mockJwtService = { verify: jest.fn() };

const mockJwtConfig = {
  accessSecret: 'test-secret',
  refreshSecret: 'test-refresh',
  accessExpiry: '15m',
  refreshExpiry: '7d',
};

const mockRedisConfig = { host: 'localhost', port: 6379, password: undefined };

function makeClient(authOverride: Record<string, unknown> = { token: 'valid.jwt' }): Socket & { userId?: string } {
  return {
    id: 'socket-1',
    handshake: { auth: authOverride },
    join: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
  } as unknown as Socket & { userId?: string };
}

describe('CheeseGateway', () => {
  let gateway: CheeseGateway;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheeseGateway,
        { provide: JwtService, useValue: mockJwtService },
        { provide: jwtConfig.KEY, useValue: mockJwtConfig },
        { provide: redisConfig.KEY, useValue: mockRedisConfig },
      ],
    }).compile();

    gateway = module.get(CheeseGateway);
  });

  describe('handleConnection', () => {
    it('joins user room and stores socket in Redis on valid JWT', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-1', username: 'alice', role: 'user', sessionId: 's1' });
      const client = makeClient();

      await gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith('user:user-1');
      expect((gateway as any).redis.hset).toHaveBeenCalledWith('ws:connections:user-1', 'socket-1', '1');
      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.userId).toBe('user-1');
    });

    it('joins admin room when role is admin', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'admin-1', username: 'admin', role: 'admin', sessionId: 's2' });
      const client = makeClient();

      await gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith('user:admin-1');
      expect(client.join).toHaveBeenCalledWith('admin');
    });

    it('joins admin room when role is super_admin', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'sa-1', username: 'sa', role: 'super_admin', sessionId: 's3' });
      const client = makeClient();

      await gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith('user:sa-1');
      expect(client.join).toHaveBeenCalledWith('admin');
    });

    it('disconnects client when token is missing', async () => {
      const client = makeClient({});

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('disconnects client when JWT is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => { throw new Error('invalid'); });
      const client = makeClient();

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('removes socket from Redis on disconnect', async () => {
      const client = makeClient() as Socket & { userId: string };
      client.userId = 'user-1';

      await gateway.handleDisconnect(client);

      expect((gateway as any).redis.hdel).toHaveBeenCalledWith('ws:connections:user-1', 'socket-1');
    });
  });

  describe('emitToUser', () => {
    it('emits to room when user has active sockets', async () => {
      (gateway as any).redis.hkeys.mockResolvedValue(['socket-1']);
      const mockEmit = jest.fn();
      (gateway as any).server = { to: jest.fn().mockReturnValue({ emit: mockEmit }) };

      await gateway.emitToUser('user-1', 'transfer_sent', { amount: 100 });

      expect((gateway as any).server.to).toHaveBeenCalledWith('user:user-1');
      expect(mockEmit).toHaveBeenCalledWith('transfer_sent', { amount: 100 });
    });

    it('skips emit when user is offline', async () => {
      (gateway as any).redis.hkeys.mockResolvedValue([]);
      const mockServer = { to: jest.fn() };
      (gateway as any).server = mockServer;

      await gateway.emitToUser('user-offline', 'transfer_sent', {});

      expect(mockServer.to).not.toHaveBeenCalled();
    });
  });
});
