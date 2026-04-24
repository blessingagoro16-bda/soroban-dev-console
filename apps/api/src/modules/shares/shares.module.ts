import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { DomainEventBus } from "../../lib/domain-event-bus.js";
import { SharesController } from "./shares.controller.js";
import { SharesService } from "./shares.service.js";
import { SharesRepository } from "./shares.repository.js";

@Module({
  controllers: [SharesController],
  providers: [SharesService, SharesRepository, PrismaService, DomainEventBus],
  exports: [SharesService, SharesRepository],
})
export class SharesModule {}
