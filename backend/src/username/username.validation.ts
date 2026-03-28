import { RESERVED_USERNAMES } from './reserved-usernames';

export const validateUsername = (
  username: string,
): { valid: boolean; error?: string } => {
  if (username.length < 3 || username.length > 20) {
    return { valid: false, error: 'Must be 3-20 characters' };
  }

  if (!/^[a-z0-9_]+$/.test(username)) {
    return {
      valid: false,
      error: 'Lowercase letters, numbers, and underscores only',
    };
  }

  if (username.includes('__')) {
    return { valid: false, error: 'Consecutive underscores not allowed' };
  }

  if (username.startsWith('_') || username.endsWith('_')) {
    return { valid: false, error: 'Cannot start or end with an underscore' };
  }

  const alphanumericCount = (username.match(/[a-z0-9]/g) || []).length;
  if (alphanumericCount < 2) {
    return { valid: false, error: 'Minimum 2 alphanumeric characters required' };
  }

  if (RESERVED_USERNAMES.includes(username.toLowerCase())) {
    return { valid: false, error: 'Username is reserved' };
  }

  return { valid: true };
};