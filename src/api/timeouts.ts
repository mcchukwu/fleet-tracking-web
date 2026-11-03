export const endpointTimeouts = {
  default: 15_000,
  history: 30_000,
  upload: 120_000,
} as const;

export type EndpointTimeout = keyof typeof endpointTimeouts;
