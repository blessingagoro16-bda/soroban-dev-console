/**
 * FE-012 / DEVOPS-003: Workspace serialization layer.
 * Defines the versioned export/import format for workspace state.
 * Sensitive or purely ephemeral state (wallet keys, health data) is excluded.
 *
 * Version is sourced from schema-version.ts — the single source of truth.
 */

import { SERIALIZER_VERSION, assertSupportedVersion } from "@/store/schema-version";
import type { WorkspaceSnapshot } from "@/store/workspace-schema";
import type { Contract } from "@/store/useContractStore";
import type { SavedCall } from "@/store/useSavedCallsStore";

export { SERIALIZER_VERSION };

export interface SerializedWorkspace {
  version: typeof SERIALIZER_VERSION;
  exportedAt: string;
  workspace: WorkspaceSnapshot;
  /** Only contracts referenced by this workspace */
  contracts: Contract[];
  /** Only saved calls referenced by this workspace */
  savedCalls: SavedCall[];
}

export function serializeWorkspace(
  workspace: WorkspaceSnapshot,
  allContracts: Contract[],
  allSavedCalls: SavedCall[],
): SerializedWorkspace {
  const contractSet = new Set(workspace.contractIds);
  const savedCallSet = new Set(workspace.savedCallIds);

  return {
    version: SERIALIZER_VERSION,
    exportedAt: new Date().toISOString(),
    workspace,
    contracts: allContracts.filter((c) => contractSet.has(c.id)),
    savedCalls: allSavedCalls.filter((c) => savedCallSet.has(c.id)),
  };
}

export function deserializeWorkspace(raw: unknown): SerializedWorkspace {
  if (!raw || typeof raw !== "object") {
    throw new Error("Malformed workspace export: not an object");
  }

  const payload = raw as SerializedWorkspace;

  // Validate version — throws with recovery guidance for unsupported versions.
  assertSupportedVersion(payload.version, "workspace-serializer");

  if (!payload.workspace?.id || !payload.workspace?.name) {
    throw new Error("Malformed workspace payload: missing id or name");
  }

  return payload;
}
