declare module "cloudflare:workers" {
  export const env: {
    HYPERDRIVE_FRESH?: { connectionString: string };
    AGENT_RATE_LIMITER?: {
      limit(options: { key: string }): Promise<{ success: boolean }>;
    };
  };
}
