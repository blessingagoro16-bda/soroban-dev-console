/**
 * FE-015 / DEVOPS-005: Fixture contract manifest.
 *
 * Contract IDs are served from the API via /runtime-config and embedded in
 * the page as __runtime_config__. This file provides a typed accessor so
 * components don't need to know the source.
 *
 * Falls back to env vars (NEXT_PUBLIC_CONTRACT_*) for local dev without an API.
 */

export interface FixtureContract {
  key: string;
  label: string;
  description: string;
  network: "testnet" | "local";
  contractId: string | null;
}

function readRuntimeFixtures(): FixtureContract[] | null {
  if (typeof document === "undefined") return null;
  try {
    const el = document.getElementById("__runtime_config__");
    if (!el?.textContent) return null;
    const config = JSON.parse(el.textContent) as {
      fixtures?: Array<{ key: string; label: string; description: string; network: string; contractId: string | null }>;
    };
    return (config.fixtures ?? []).map((f) => ({
      ...f,
      network: (f.network === "testnet" ? "testnet" : "local") as "testnet" | "local",
    }));
  } catch {
    return null;
  }
}

const env = (key: string): string | null => process.env[key] ?? null;

const STATIC_FIXTURES: FixtureContract[] = [
  {
    key: "counter",
    label: "Counter",
    description: "Simple increment/decrement counter for testing basic calls.",
    network: "local",
    contractId: env("NEXT_PUBLIC_CONTRACT_COUNTER_FIXTURE"),
  },
  {
    key: "token",
    label: "Token",
    description: "SAC-compatible token fixture for transfer/mint demos.",
    network: "local",
    contractId: env("NEXT_PUBLIC_CONTRACT_TOKEN_FIXTURE"),
  },
  {
    key: "event",
    label: "Event Emitter",
    description: "Emits contract events for testing the event feed.",
    network: "local",
    contractId: env("NEXT_PUBLIC_CONTRACT_EVENT_FIXTURE"),
  },
  {
    key: "failure",
    label: "Failure Fixture",
    description: "Intentionally fails to test error handling flows.",
    network: "local",
    contractId: env("NEXT_PUBLIC_CONTRACT_FAILURE_FIXTURE"),
  },
  {
    key: "types-tester",
    label: "Types Tester",
    description: "Exercises all Soroban ScVal types for ABI form testing.",
    network: "local",
    contractId: env("NEXT_PUBLIC_CONTRACT_TYPES_TESTER"),
  },
  {
    key: "auth-tester",
    label: "Auth Tester",
    description: "Tests authorization flows and account-based access control.",
    network: "local",
    contractId: env("NEXT_PUBLIC_CONTRACT_AUTH_TESTER"),
  },
  {
    key: "source-registry",
    label: "Source Registry",
    description: "Registry contract for source verification demos.",
    network: "local",
    contractId: env("NEXT_PUBLIC_CONTRACT_SOURCE_REGISTRY"),
  },
  {
    key: "error-trigger",
    label: "Error Trigger",
    description: "Triggers specific error codes for debugging UI.",
    network: "local",
    contractId: env("NEXT_PUBLIC_CONTRACT_ERROR_TRIGGER"),
  },
];

export function getFixtureContracts(): FixtureContract[] {
  return readRuntimeFixtures() ?? STATIC_FIXTURES;
}

/** Returns only fixture contracts that have a deployed contract ID. */
export function getDeployedFixtures(): FixtureContract[] {
  return getFixtureContracts().filter((f) => f.contractId !== null);
}

/** @deprecated Use getFixtureContracts() instead */
export const FIXTURE_CONTRACTS = STATIC_FIXTURES;
