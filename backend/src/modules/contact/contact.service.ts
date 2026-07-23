import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { SubmitContactMessageDto } from './dto/contact.dtos';

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(dto: SubmitContactMessageDto) {
    return this.prisma.contactMessage.create({ data: dto });
  }

  /** Recent inbox for SiteAdminDashboardPage's third section — see
   * docs/DB_SCHEMA.md's Phase 20 notes for why there is no dedicated
   * review UI (no design admin tab exists specifically for this). */
  async listRecent() {
    return this.prisma.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
