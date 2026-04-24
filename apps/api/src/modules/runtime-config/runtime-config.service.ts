/**
 * DEVOPS-005: Serve runtime network, fixture, and feature configuration.
 *
 * The frontend bootstraps from this endpoint so deploy-time behaviour
 * (networks, fixture contract IDs, feature flags) can be changed centrally
 * without rebuilding the frontend.
 *
 * Payload is versioned so clients can detect incompatible changes.
 */

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export const RUNTIME_CONFIG_VERSION = 1 as const;

export interface NetworkEntry {
  id: string;
  name: string;
  rpcUrl: string;
  networkPassphrase: string;
  horizonUrl?: string;
}

export interface FixtureEntry {
  key: string;
  label: string;
  description: string;
  network: string;
  contractId: string | null;
}

export interface FeatureFlags {
  enableSharing: boolean;
  enableMultiOp: boolean;
  enableTokenDashboard: boolean;
}

export interface RuntimeConfig {
  version: typeof RUNTIME_CONFIG_VERSION;
  networks: NetworkEntry[];
  fixtures: FixtureEntry[];
  flags: FeatureFlags;
}

@Injectable()
export class RuntimeConfigService {
  constructor(private readonly config: ConfigService) {}

  getConfig(): RuntimeConfig {
    return {
      version: RUNTIME_CONFIG_VERSION,
      networks: this.buildNetworks(),
      fixtures: this.buildFixtures(),
      flags: this.buildFlags(),
    };
  }

  private buildNetworks(): NetworkEntry[] {
    const mainnetUrl = this.config.get<string>("SOROBAN_RPC_MAINNET_URL");
    return [
      {
        id: "mainnet",
        name: "Mainnet",
        rpcUrl: mainnetUrl ?? "",
        networkPassphrase: "Public Global Stellar Network ; September 2015",
        horizonUrl: "https://horizon.stellar.org",
      },
      {
        id: "testnet",
        name: "Testnet",
        rpcUrl:
          this.config.get<string>("SOROBAN_RPC_TESTNET_URL") ??
          "https://soroban-testnet.stellar.org",
        networkPassphrase: "Test SDF Network ; September 2015",
        horizonUrl: "https://horizon-testnet.stellar.org",
      },
      {
        id: "futurenet",
        name: "Futurenet",
        rpcUrl:
          this.config.get<string>("SOROBAN_RPC_FUTURENET_URL") ??
          "https://rpc-futurenet.stellar.org",
        networkPassphrase: "Test SDF Future Network ; October 2022",
        horizonUrl: "https://horizon-futurenet.stellar.org",
      },
      {
        id: "local",
        name: "Local Standalone",
        rpcUrl:
          this.config.get<string>("SOROBAN_RPC_LOCAL_URL") ??
          "http://localhost:8000/soroban/rpc",
        networkPassphrase: "Standalone Network ; February 2017",
        horizonUrl: "http://localhost:8000",
      },
    ].filter((n) => n.rpcUrl !== "");
  }

  private buildFixtures(): FixtureEntry[] {
    const fixtures: Array<Omit<FixtureEntry, "contractId"> & { envKey: string }> = [
      {
        key: "counter",
        label: "Counter",
        description: "Simple increment/decrement counter for testing basic calls.",
        network: "local",
        envKey: "CONTRACT_COUNTER_FIXTURE",
      },
      {
        key: "token",
        label: "Token",
        description: "SAC-compatible token fixture for transfer/mint demos.",
        network: "local",
        envKey: "CONTRACT_TOKEN_FIXTURE",
      },
      {
        key: "event",
        label: "Event Emitter",
        description: "Emits contract events for testing the event feed.",
        network: "local",
        envKey: "CONTRACT_EVENT_FIXTURE",
      },
      {
        key: "failure",
        label: "Failure Fixture",
        description: "Intentionally fails to test error handling flows.",
        network: "local",
        envKey: "CONTRACT_FAILURE_FIXTURE",
      },
      {
        key: "types-tester",
        label: "Types Tester",
        description: "Exercises all Soroban ScVal types for ABI form testing.",
        network: "local",
        envKey: "CONTRACT_TYPES_TESTER",
      },
      {
        key: "auth-tester",
        label: "Auth Tester",
        description: "Tests authorization flows and account-based access control.",
        network: "local",
        envKey: "CONTRACT_AUTH_TESTER",
      },
      {
        key: "source-registry",
        label: "Source Registry",
        description: "Registry contract for source verification demos.",
        network: "local",
        envKey: "CONTRACT_SOURCE_REGISTRY",
      },
      {
        key: "error-trigger",
        label: "Error Trigger",
        description: "Triggers specific error codes for debugging UI.",
        network: "local",
        envKey: "CONTRACT_ERROR_TRIGGER",
      },
    ];

    return fixtures.map(({ envKey, ...rest }) => ({
      ...rest,
      contractId: this.config.get<string>(envKey) ?? null,
    }));
  }

  private buildFlags(): FeatureFlags {
    return {
      enableSharing: this.config.get<string>("FEATURE_SHARING") !== "false",
      enableMultiOp: this.config.get<string>("FEATURE_MULTI_OP") !== "false",
      enableTokenDashboard:
        this.config.get<string>("FEATURE_TOKEN_DASHBOARD") !== "false",
    };
  }
}
