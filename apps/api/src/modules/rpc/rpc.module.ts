import { Module } from "@nestjs/common";
import { RpcController } from "./rpc.controller.js";
import { RpcRateLimitGuard } from "./rpc-rate-limit.guard.js";
import { RpcService } from "./rpc.service.js";

@Module({
  controllers: [RpcController],
  providers: [RpcService, RpcRateLimitGuard],
  exports: [RpcService]
})
export class RpcModule {}
