import { filterOpenApiPathsForVersion } from './filter-openapi-for-version';

describe('filterOpenApiPathsForVersion', () => {
  const doc = {
    paths: {
      '/api/version': { get: {} },
      '/api/v1/auth/login': { post: {} },
      '/api/v2/auth/login': { post: {} },
    },
  };

  it('keeps neutral paths and only matching version prefix', () => {
    const v1 = filterOpenApiPathsForVersion(doc, '1');
    expect(Object.keys(v1.paths!)).toEqual([
      '/api/version',
      '/api/v1/auth/login',
    ]);

    const v2 = filterOpenApiPathsForVersion(doc, '2');
    expect(Object.keys(v2.paths!)).toEqual([
      '/api/version',
      '/api/v2/auth/login',
    ]);
  });
});
