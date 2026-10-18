declare module "cloudflare:workers" {
  export const env: {
    AGENT_RATE_LIMITER?: {
      limit(options: { key: string }): Promise<{ success: boolean }>;
    };
  };
}
