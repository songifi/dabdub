/** Jest-only stub when @nestjs/axios is not resolved from node_modules (e.g. partial install). */
export class HttpService {}
export const HttpModule = { register: () => ({}) };
