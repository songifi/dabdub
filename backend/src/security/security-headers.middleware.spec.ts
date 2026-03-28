import { SecurityHeadersMiddleware, SECURITY_HEADERS } from './security-headers.middleware';

describe('SecurityHeadersMiddleware', () => {
  it('sets the required headers on every response', () => {
    const middleware = new SecurityHeadersMiddleware();
    const setHeader = jest.fn();
    const next = jest.fn();

    middleware.use({} as any, { setHeader } as any, next);

    Object.entries(SECURITY_HEADERS).forEach(([header, value]) => {
      expect(setHeader).toHaveBeenCalledWith(header, value);
    });
    expect(next).toHaveBeenCalled();
  });
});
