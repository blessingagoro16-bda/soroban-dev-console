import { Prisma } from "@prisma/client";
import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { SharesRepository } from "./shares.repository.js";
import { WorkspacesRepository } from "../workspaces/workspaces.repository.js";
import { MapDbErrors } from "../../lib/db-error.mapper.js";
import { DomainEventBus } from "../../lib/domain-event-bus.js";
import {
  SHARE_CREATED,
  SHARE_RESOLVED,
  SHARE_REVOKED,
} from "../../lib/domain-events.js";
import { randomBytes } from "crypto";

import { IsString, IsOptional, IsObject } from "class-validator";

export class CreateShareDto {
  @IsString()
  workspaceId!: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsObject()
  snapshotJson!: Prisma.InputJsonValue;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}

@Injectable()
export class SharesService {
  constructor(
    private readonly repository: SharesRepository,
    private readonly workspacesRepository: WorkspacesRepository,
    private readonly events: DomainEventBus,
  ) {}

  @MapDbErrors()
  async create(dto: CreateShareDto) {
    const workspace = await this.workspacesRepository.findUnique({
      where: { id: dto.workspaceId },
    });
    if (!workspace) throw new NotFoundException("Workspace not found");

    const token = randomBytes(24).toString("base64url");

    const share = await this.repository.create({
      data: {
        workspaceId: dto.workspaceId,
        token,
        label: dto.label,
        snapshotJson: dto.snapshotJson,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
    this.events.emit(SHARE_CREATED, {
      shareId: share.id,
      workspaceId: dto.workspaceId,
      // Emit only a hint — never log the raw token
      tokenHint: token.slice(0, 6) + "…",
    });
    return share;
  }

  @MapDbErrors()
  async resolve(token: string) {
    const share = await this.repository.findUnique({ where: { token } });
    if (!share) throw new NotFoundException("Share link not found");
    if (share.revokedAt) throw new ForbiddenException("Share link has been revoked");
    if (share.expiresAt && share.expiresAt < new Date()) {
      throw new ForbiddenException("Share link has expired");
    }
    this.events.emit(SHARE_RESOLVED, {
      shareId: share.id,
      workspaceId: share.workspaceId,
    });
    return share;
  }

  @MapDbErrors()
  async revoke(token: string) {
    const share = await this.repository.findUnique({ where: { token } });
    if (!share) throw new NotFoundException("Share link not found");
    const updated = await this.repository.update({
      where: { token },
      data: { revokedAt: new Date() },
    });
    this.events.emit(SHARE_REVOKED, {
      shareId: share.id,
      workspaceId: share.workspaceId,
    });
    return updated;
  }

  @MapDbErrors()
  async listForWorkspace(workspaceId: string) {
    return this.repository.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        token: true,
        label: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }
}
