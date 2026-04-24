/**
 * DEVOPS-005: Frontend client for the /runtime-config API endpoint.
 *
 * The frontend bootstraps from this so networks, fixture IDs, and feature
 * flags can be changed centrally without rebuilding the frontend.
 * Falls back to safe defaults if the API is unreachable.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface RuntimeNetworkEntry {
  id: string;
  name: string;
  rpcUrl: string;
  networkPassphrase: string;
  horizonUrl?: string;
}

export interface RuntimeFixtureEntry {
  key: string;
  label: string;
  description: string;
  network: string;
  contractId: string | null;
}

export interface RuntimeFeatureFlags {
  enableSharing: boolean;
  enableMultiOp: boolean;
  enableTokenDashboard: boolean;
}

export interface RuntimeConfig {
  version: number;
  networks: RuntimeNetworkEntry[];
  fixtures: RuntimeFixtureEntry[];
  flags: RuntimeFeatureFlags;
}

const FALLBACK_CONFIG: RuntimeConfig = {
  version: 1,
  networks: [
    {
      id: "testnet",
      name: "Testnet",
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
      horizonUrl: "https://horizon-testnet.stellar.org",
    },
  ],
  fixtures: [],
  flags: {
    enableSharing: true,
    enableMultiOp: true,
    enableTokenDashboard: true,
  },
};

let cached: RuntimeConfig | null = null;

export async function fetchRuntimeConfig(): Promise<RuntimeConfig> {
  if (cached) return cached;

  try {
    const res = await fetch(`${API_BASE}/runtime-config`, {
      next: { revalidate: 300 }, // cache for 5 min in Next.js
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cached = (await res.json()) as RuntimeConfig;
    return cached;
  } catch {
    console.warn("[runtime-config] Failed to fetch from API — using fallback config");
    return FALLBACK_CONFIG;
  }
}

/** Reset the in-memory cache (useful for testing). */
export function resetRuntimeConfigCache(): void {
  cached = null;
}
