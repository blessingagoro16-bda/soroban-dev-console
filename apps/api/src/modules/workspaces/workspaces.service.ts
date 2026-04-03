import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import type {
  CreateWorkspaceDto,
  ImportWorkspaceDto,
  UpdateWorkspaceDto,
} from "./workspace.dto.js";

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  list(ownerKey: string) {
    return this.prisma.workspace.findMany({
      where: { ownerKey },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        selectedNetwork: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async get(id: string, ownerKey: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id, ownerKey },
      include: {
        savedContracts: true,
        savedInteractions: true,
        artifacts: true,
        shares: {
          select: {
            id: true,
            token: true,
            label: true,
            expiresAt: true,
            revokedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    return workspace;
  }

  create(ownerKey: string, dto: CreateWorkspaceDto) {
    return this.prisma.workspace.create({
      data: {
        ownerKey,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        selectedNetwork: dto.selectedNetwork ?? "testnet",
      },
    });
  }

  async update(id: string, ownerKey: string, dto: UpdateWorkspaceDto) {
    await this.get(id, ownerKey);

    return this.prisma.workspace.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() || null }
          : {}),
        ...(dto.selectedNetwork !== undefined
          ? { selectedNetwork: dto.selectedNetwork }
          : {}),
      },
    });
  }

  async remove(id: string, ownerKey: string) {
    await this.get(id, ownerKey);
    await this.prisma.workspace.delete({ where: { id } });
  }

  async import(ownerKey: string, dto: ImportWorkspaceDto) {
    if (dto.version !== 2) {
      throw new BadRequestException(
        `Unsupported workspace version: ${dto.version}. Only version 2 is accepted.`,
      );
    }

    const existing = await this.prisma.workspace.findUnique({
      where: { id: dto.id },
    });
    if (existing) {
      throw new ConflictException(
        `A workspace with id "${dto.id}" already exists.`,
      );
    }

    return this.prisma.workspace.create({
      data: {
        id: dto.id,
        ownerKey,
        name: dto.name.trim(),
        description: null,
        selectedNetwork: dto.selectedNetwork,
        savedContracts: {
          create: dto.contractIds.map((contractId) => ({
            contractId,
            network: dto.selectedNetwork,
          })),
        },
        artifacts: {
          create: dto.artifactRefs.map((artifact) => ({
            kind: artifact.kind,
            name: artifact.id,
            network: dto.selectedNetwork,
            hash: artifact.kind === "wasm" ? artifact.id : null,
            metadata: { sourceId: artifact.id },
          })),
        },
      },
    });
  }

  async export(id: string, ownerKey: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id, ownerKey },
      include: {
        savedContracts: true,
        savedInteractions: true,
        artifacts: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    return {
      version: 2,
      id: workspace.id,
      name: workspace.name,
      selectedNetwork: workspace.selectedNetwork,
      contractIds: workspace.savedContracts.map((contract) => contract.contractId),
      savedCallIds: workspace.savedInteractions.map((interaction) => interaction.id),
      artifactRefs: workspace.artifacts.map((artifact) => ({
        kind: artifact.kind,
        id: artifact.hash || artifact.name,
      })),
      createdAt: workspace.createdAt.getTime(),
      updatedAt: workspace.updatedAt.getTime(),
    };
  }
}
