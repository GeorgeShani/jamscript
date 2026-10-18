/** Vitest does not run in Workers. Route imports need this inert binding. */
export const env = {
  AGENT_RATE_LIMITER: {
    limit: async () => ({ success: true }),
  },
};
