import { STORE_SCHEMA_VERSION } from "./schema-version";

export interface WorkspaceArtifactRef {
  kind: "wasm" | "decoded-xdr" | "storage-query" | "simulation";
  id: string;
}

export interface WorkspaceSnapshot {
  version: typeof STORE_SCHEMA_VERSION;
  id: string;
  name: string;
  contractIds: string[];
  savedCallIds: string[];
  artifactRefs: WorkspaceArtifactRef[];
  selectedNetwork: string;
  createdAt: number;
  updatedAt: number;
}
