import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  PayloadTooLargeException,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { DomainEventBus } from "../../lib/domain-event-bus.js";
import {
  RPC_PROXIED,
  RPC_CACHE_HIT,
  RPC_UPSTREAM_ERROR,
} from "../../lib/domain-events.js";
import { RpcCacheService } from "./rpc-cache.service.js";

const networkSchema = z.enum(["mainnet", "testnet", "futurenet", "local"]);

const singleRpcRequestSchema = z
  .object({
    jsonrpc: z.literal("2.0"),
    method: z.string().trim().min(1),
    params: z.unknown().optional(),
    id: z.union([z.string(), z.number(), z.null()]).optional()
  })
  .passthrough();

const rpcRequestSchema = z.union([
  singleRpcRequestSchema,
  z.array(singleRpcRequestSchema).min(1)
]);

type RpcNetwork = z.infer<typeof networkSchema>;

const MAX_BATCH_REQUESTS = 25;
const MAX_PAYLOAD_BYTES = 50_000;
const REQUEST_TIMEOUT_MS = 15_000;

export type ProxiedRpcResponse = {
  statusCode: number;
  contentType: string;
  body: unknown;
};

@Injectable()
export class RpcService {
  constructor(
    private readonly configService: ConfigService,
    private readonly events: DomainEventBus,
    private readonly rpcCache: RpcCacheService,
  ) {}

  private getRpcUrl(network: RpcNetwork) {
    const urls: Record<RpcNetwork, string | undefined> = {
      mainnet: this.configService.get<string>("SOROBAN_RPC_MAINNET_URL"),
      testnet: this.configService.get<string>("SOROBAN_RPC_TESTNET_URL"),
      futurenet: this.configService.get<string>("SOROBAN_RPC_FUTURENET_URL"),
      local: this.configService.get<string>("SOROBAN_RPC_LOCAL_URL")
    };

    return urls[network];
  }

  async proxy(network: string, payload: unknown): Promise<ProxiedRpcResponse> {
    const parsedNetwork = networkSchema.safeParse(network);
    if (!parsedNetwork.success) {
      throw new BadRequestException("Unsupported network");
    }

    const parsedPayload = rpcRequestSchema.safeParse(payload);
    if (!parsedPayload.success) {
      throw new BadRequestException({
        error: "Invalid JSON-RPC payload",
        details: parsedPayload.error.flatten()
      });
    }

    if (
      Array.isArray(parsedPayload.data) &&
      parsedPayload.data.length > MAX_BATCH_REQUESTS
    ) {
      throw new BadRequestException(
        `RPC batch size exceeds limit of ${MAX_BATCH_REQUESTS}`
      );
    }

    const serializedPayload = JSON.stringify(parsedPayload.data);
    if (serializedPayload.length > MAX_PAYLOAD_BYTES) {
      throw new PayloadTooLargeException(
        `RPC payload exceeds limit of ${MAX_PAYLOAD_BYTES} bytes`
      );
    }

    const rpcUrl = this.getRpcUrl(parsedNetwork.data);
    if (!rpcUrl) {
      throw new ServiceUnavailableException(
        `RPC URL is not configured for network '${parsedNetwork.data}'`
      );
    }

    // Only single (non-batch) requests are eligible for caching/deduplication.
    const isSingle = !Array.isArray(parsedPayload.data);
    const method = isSingle
      ? parsedPayload.data.method
      : (parsedPayload.data[0]?.method ?? "batch");

    if (isSingle && this.rpcCache.isCacheable(method)) {
      const cacheKey = this.rpcCache.buildKey(
        parsedNetwork.data,
        method,
        (parsedPayload.data as { params?: unknown }).params,
      );

      // Cache hit — return immediately without hitting upstream.
      const cached = this.rpcCache.get(cacheKey);
      if (cached !== undefined) {
        this.events.emit(RPC_CACHE_HIT, { network: parsedNetwork.data, method });
        return cached as ProxiedRpcResponse;
      }

      // Deduplicate in-flight requests for the same cache key.
      return this.rpcCache.deduplicate(cacheKey, async () => {
        const result = await this.fetchUpstream(
          rpcUrl,
          serializedPayload,
          parsedNetwork.data,
          method,
        );
        if (result.statusCode === 200) {
          this.rpcCache.set(cacheKey, method, result);
        }
        return result;
      });
    }

    return this.fetchUpstream(rpcUrl, serializedPayload, parsedNetwork.data, method);
  }

  private async fetchUpstream(
    rpcUrl: string,
    serializedPayload: string,
    network: string,
    method: string,
  ): Promise<ProxiedRpcResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const start = Date.now();

    try {
      const upstreamResponse = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: serializedPayload,
        signal: controller.signal,
      });

      const rawBody = await upstreamResponse.text();
      const contentType =
        upstreamResponse.headers.get("content-type") ?? "text/plain";

      const result: ProxiedRpcResponse = contentType.includes("application/json")
        ? (() => {
            try {
              return { statusCode: upstreamResponse.status, contentType, body: JSON.parse(rawBody) };
            } catch {
              return { statusCode: upstreamResponse.status, contentType: "text/plain", body: rawBody };
            }
          })()
        : { statusCode: upstreamResponse.status, contentType, body: rawBody };

      this.events.emit(RPC_PROXIED, {
        network,
        method,
        statusCode: result.statusCode,
        durationMs: Date.now() - start,
        cached: false,
      });

      return result;
    } catch (error) {
      console.error("RPC proxy request failed", error);

      if (error instanceof Error && error.name === "AbortError") {
        this.events.emit(RPC_UPSTREAM_ERROR, { network, method, errorName: "AbortError" });
        throw new GatewayTimeoutException(
          `RPC upstream timed out after ${REQUEST_TIMEOUT_MS}ms`
        );
      }

      this.events.emit(RPC_UPSTREAM_ERROR, {
        network,
        method,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      throw new BadGatewayException("Failed to proxy RPC request");
    } finally {
      clearTimeout(timeout);
    }
  }
}
