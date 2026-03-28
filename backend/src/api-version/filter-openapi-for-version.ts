type OpenApiLike = {
  paths?: Record<string, unknown>;
};

export function filterOpenApiPathsForVersion<T extends OpenApiLike>(
  document: T,
  version: string,
): T {
  const versionPrefix = `/api/v${version}`;
  const nextPaths: Record<string, unknown> = {};
  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    const isVersioned = /^\/api\/v\d+/.test(path);
    if (!isVersioned || path === versionPrefix || path.startsWith(`${versionPrefix}/`)) {
      nextPaths[path] = pathItem;
    }
  }
  return { ...document, paths: nextPaths };
}
