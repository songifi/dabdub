import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, StreamableFile } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';
import {
  SKIP_RESPONSE_WRAP_KEY,
  PAGINATED_KEY,
  API_RESPONSE_MESSAGE_KEY,
} from '../decorators';
import type { ResponseEnvelope, RawPaginatedResponse } from '../dto/response.dto';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResponseInterceptor,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    interceptor = module.get<ResponseInterceptor>(ResponseInterceptor);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('wraps plain object in envelope', () => {
    it('should wrap simple data in response envelope', async () => {
      const testData = { id: 1, name: 'Test User' };
      const correlationId = 'test-correlation-123';

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ correlationId }),
          getResponse: () => ({
            setHeader: jest.fn(),
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const mockCallHandler = {
        handle: () => of(testData),
      };

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

      const result = await new Promise<ResponseEnvelope>((resolve) => {
        interceptor.intercept(mockContext, mockCallHandler).subscribe((data) => {
          resolve(data as ResponseEnvelope);
        });
      });

      expect(result).toEqual({
        success: true,
        data: testData,
        message: undefined,
        timestamp: expect.any(String),
        requestId: correlationId,
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual(testData);
      expect(result.requestId).toBe(correlationId);
      expect(result.timestamp).toBeDefined();
    });

    it('should use custom message when @ApiResponse is set', async () => {
      const testData = { id: 1, name: 'Test User' };
      const customMessage = 'User created successfully';

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ correlationId: 'test-id' }),
          getResponse: () => ({
            setHeader: jest.fn(),
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const mockCallHandler = {
        handle: () => of(testData),
      };

      (reflector.getAllAndOverride as jest.Mock).mockImplementation((key) => {
        if (key === API_RESPONSE_MESSAGE_KEY) return customMessage;
        return undefined;
      });

      const result = await new Promise<ResponseEnvelope>((resolve) => {
        interceptor.intercept(mockContext, mockCallHandler).subscribe((data) => {
          resolve(data as ResponseEnvelope);
        });
      });

      expect(result.message).toBe(customMessage);
    });
  });

  describe('paginated responses', () => {
    it('should extract pagination metadata and add to meta field', async () => {
      const paginatedData: RawPaginatedResponse = {
        data: [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }],
        limit: 10,
        hasMore: true,
        total: 100,
        page: 1,
        nextCursor: 'cursor-next',
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ correlationId: 'test-id' }),
          getResponse: () => ({
            setHeader: jest.fn(),
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const mockCallHandler = {
        handle: () => of(paginatedData),
      };

      (reflector.getAllAndOverride as jest.Mock).mockImplementation((key) => {
        if (key === PAGINATED_KEY) return true;
        return undefined;
      });

      const result = await new Promise<ResponseEnvelope>((resolve) => {
        interceptor.intercept(mockContext, mockCallHandler).subscribe((data) => {
          resolve(data as ResponseEnvelope);
        });
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(paginatedData.data);
      expect(result.meta).toEqual({
        limit: 10,
        hasMore: true,
        total: 100,
        page: 1,
        nextCursor: 'cursor-next',
      });
    });

    it('should handle paginated response without optional fields', async () => {
      const paginatedData: RawPaginatedResponse = {
        data: [{ id: 1 }],
        limit: 20,
        hasMore: false,
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ correlationId: 'test-id' }),
          getResponse: () => ({
            setHeader: jest.fn(),
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const mockCallHandler = {
        handle: () => of(paginatedData),
      };

      (reflector.getAllAndOverride as jest.Mock).mockImplementation((key) => {
        if (key === PAGINATED_KEY) return true;
        return undefined;
      });

      const result = await new Promise<ResponseEnvelope>((resolve) => {
        interceptor.intercept(mockContext, mockCallHandler).subscribe((data) => {
          resolve(data as ResponseEnvelope);
        });
      });

      expect(result.meta).toEqual({
        limit: 20,
        hasMore: false,
      });
    });
  });

  describe('@SkipResponseWrap decorator', () => {
    it('should bypass interceptor when @SkipResponseWrap is applied', async () => {
      const testData = { status: 'ok' };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ correlationId: 'test-id' }),
          getResponse: () => ({
            setHeader: jest.fn(),
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const mockCallHandler = {
        handle: () => of(testData),
      };

      (reflector.getAllAndOverride as jest.Mock).mockImplementation((key) => {
        if (key === SKIP_RESPONSE_WRAP_KEY) return true;
        return undefined;
      });

      const result = await new Promise<unknown>((resolve) => {
        interceptor.intercept(mockContext, mockCallHandler).subscribe((data) => {
          resolve(data);
        });
      });

      expect(result).toEqual(testData);
      expect((result as ResponseEnvelope).success).toBeUndefined();
    });
  });

  describe('streaming responses', () => {
    it('should skip wrapping for StreamableFile responses', async () => {
      const testFile = new StreamableFile(Buffer.from('test'));

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ correlationId: 'test-id' }),
          getResponse: () => ({
            setHeader: jest.fn(),
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const mockCallHandler = {
        handle: () => of(testFile),
      };

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

      const result = await new Promise<unknown>((resolve) => {
        interceptor.intercept(mockContext, mockCallHandler).subscribe((data) => {
          resolve(data);
        });
      });

      expect(result).toBe(testFile);
      expect((result as ResponseEnvelope).success).toBeUndefined();
    });
  });

  describe('response timing', () => {
    it('should measure handler execution time and set X-Response-Time header', async () => {
      const testData = { id: 1 };
      const mockSetHeader = jest.fn();

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ correlationId: 'test-id' }),
          getResponse: () => ({
            setHeader: mockSetHeader,
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const mockCallHandler = {
        handle: () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(testData), 50);
          }),
      };

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

      await new Promise<void>((resolve) => {
        interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
          resolve();
        });
      });

      expect(mockSetHeader).toHaveBeenCalledWith('X-Response-Time', expect.stringMatching(/\d+ms/));
    });
  });

  describe('requestId from correlationId', () => {
    it('should set requestId to match correlationId from request', async () => {
      const testData = { id: 1 };
      const correlationId = 'my-correlation-id-12345';

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ correlationId }),
          getResponse: () => ({
            setHeader: jest.fn(),
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const mockCallHandler = {
        handle: () => of(testData),
      };

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

      const result = await new Promise<ResponseEnvelope>((resolve) => {
        interceptor.intercept(mockContext, mockCallHandler).subscribe((data) => {
          resolve(data as ResponseEnvelope);
        });
      });

      expect(result.requestId).toBe(correlationId);
    });

    it('should use empty string as requestId if correlationId is missing', async () => {
      const testData = { id: 1 };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({}),
          getResponse: () => ({
            setHeader: jest.fn(),
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const mockCallHandler = {
        handle: () => of(testData),
      };

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

      const result = await new Promise<ResponseEnvelope>((resolve) => {
        interceptor.intercept(mockContext, mockCallHandler).subscribe((data) => {
          resolve(data as ResponseEnvelope);
        });
      });

      expect(result.requestId).toBe('');
    });
  });

  describe('timestamp format', () => {
    it('should include ISO 8601 formatted timestamp', async () => {
      const testData = { id: 1 };
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ correlationId: 'test-id' }),
          getResponse: () => ({
            setHeader: jest.fn(),
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const mockCallHandler = {
        handle: () => of(testData),
      };

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

      const result = await new Promise<ResponseEnvelope>((resolve) => {
        interceptor.intercept(mockContext, mockCallHandler).subscribe((data) => {
          resolve(data as ResponseEnvelope);
        });
      });

      expect(result.timestamp).toMatch(isoRegex);
    });
  });
});
