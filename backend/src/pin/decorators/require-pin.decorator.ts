import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PIN_KEY = 'requirePin';

export const RequirePin = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(REQUIRE_PIN_KEY, true);
