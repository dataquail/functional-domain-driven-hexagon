// Runtime config resolved from the environment. The CLI/MCP point at a
// deployed server via `APP_API_URL`; the default targets the local BFF.
export const resolveBaseUrl = (): string => process.env.APP_API_URL ?? "http://localhost:3001";

// CI/headless override: a pre-minted PAT in the environment wins over any
// stored credential, so pipelines need no `auth login` and no on-disk state.
export const tokenFromEnv = (): string | null => {
  const fromEnv = process.env.APP_API_TOKEN;
  return fromEnv !== undefined && fromEnv.length > 0 ? fromEnv : null;
};
