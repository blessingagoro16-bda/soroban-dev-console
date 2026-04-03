import { Prisma } from "@prisma/client";
import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
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
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateShareDto) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: dto.workspaceId },
    });
    if (!workspace) throw new NotFoundException("Workspace not found");

    const token = randomBytes(24).toString("base64url");

    return this.prisma.shareLink.create({
      data: {
        workspaceId: dto.workspaceId,
        token,
        label: dto.label,
        snapshotJson: dto.snapshotJson,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
  }

  async resolve(token: string) {
    const share = await this.prisma.shareLink.findUnique({ where: { token } });
    if (!share) throw new NotFoundException("Share link not found");
    if (share.revokedAt) throw new ForbiddenException("Share link has been revoked");
    if (share.expiresAt && share.expiresAt < new Date()) {
      throw new ForbiddenException("Share link has expired");
    }
    return share;
  }

  async revoke(token: string) {
    const share = await this.prisma.shareLink.findUnique({ where: { token } });
    if (!share) throw new NotFoundException("Share link not found");
    return this.prisma.shareLink.update({
      where: { token },
      data: { revokedAt: new Date() },
    });
  }

  async listForWorkspace(workspaceId: string) {
    return this.prisma.shareLink.findMany({
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
