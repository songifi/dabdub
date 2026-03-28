export function isAllowedCorsOrigin(
  origin: string | undefined,
  frontendUrl: string,
): boolean {
  if (!origin) {
    return true;
  }

  if (origin === 'cheesewallet://') {
    return true;
  }

  if (origin === frontendUrl) {
    return true;
  }

  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
