import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, MoreThanOrEqual, Repository } from 'typeorm';
import { ErrorCode } from '../../common/errors';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AgencyApiKey } from '../../database/entities/agency-api-key.entity';
import { AgencyProfile } from '../../database/entities/agency-profile.entity';
import { AgencyWebserviceRequest } from '../../database/entities/agency-webservice-request.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import type { AgencyApiScope, AgencyApiKeyStatus } from '../../database/enums';
import { AgenciesService } from '../agencies/agencies.service';
import type { DecideWebserviceRequestDto } from '../agencies/dto/decide-webservice-request.dto';

type ClientUpdate = {
  status?: AgencyApiKeyStatus;
  regenerate?: boolean;
  stepUpChallengeId?: string;
  stepUpCode?: string;
};

@Injectable()
export class ItWebservicesService {
  constructor(
    @InjectRepository(AgencyWebserviceRequest)
    private readonly requestRepo: Repository<AgencyWebserviceRequest>,
    @InjectRepository(AgencyApiKey)
    private readonly keyRepo: Repository<AgencyApiKey>,
    @InjectRepository(AgencyProfile)
    private readonly agencyRepo: Repository<AgencyProfile>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly agencies: AgenciesService,
  ) {}

  async overview() {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const [
      requests,
      keys,
      eligibleAgencies,
      events,
      issuedKeys,
      activeWithoutExpiry,
      activeWithFutureExpiry,
      pendingRequests,
      securityEventsToday,
    ] = await Promise.all([
      this.requestRepo.find({
        relations: { agency: { user: true } },
        order: { createdAt: 'DESC' },
        take: 100,
      }),
      this.keyRepo.find({
        relations: { agency: { user: true } },
        order: { activatedAt: 'DESC' },
        take: 200,
      }),
      this.agencyRepo
        .createQueryBuilder('agency')
        .leftJoinAndSelect('agency.user', 'user')
        .where('agency.suspendedAt IS NULL')
        .andWhere('user.isActive = true')
        .andWhere('user.deletedAt IS NULL')
        .orderBy('user.fullName', 'ASC')
        .getMany(),
      this.auditRepo
        .createQueryBuilder('event')
        .leftJoinAndSelect('event.actor', 'actor')
        .where('event.entityType IN (:...types)', {
          types: ['AgencyApiKey', 'AgencyWebserviceRequest'],
        })
        .orWhere('event.action ILIKE :webservice', { webservice: '%وب‌سرویس%' })
        .orWhere('event.action ILIKE :api', { api: '%API%' })
        .orderBy('event.createdAt', 'DESC')
        .take(100)
        .getMany(),
      this.keyRepo.count(),
      this.keyRepo.count({
        where: { status: 'ACTIVE', expiresAt: IsNull() },
      }),
      this.keyRepo.count({
        where: { status: 'ACTIVE', expiresAt: MoreThan(now) },
      }),
      this.requestRepo.countBy({ status: 'PENDING' }),
      this.auditRepo.count({
        where: {
          category: 'SECURITY',
          createdAt: MoreThanOrEqual(today),
        },
      }),
    ]);

    return {
      kpis: {
        activeClients: activeWithoutExpiry + activeWithFutureExpiry,
        issuedKeys,
        pendingRequests,
        securityEventsToday,
      },
      requests: requests.map((request) => ({
        id: request.id,
        agencyId: request.agencyId,
        agency: request.agency.user.fullName,
        scope: request.scope,
        months: request.months,
        priceIrr: request.priceIrr.toString(),
        note: request.note,
        status: request.status,
        createdAt: request.createdAt,
        decidedAt: request.decidedAt,
      })),
      clients: keys.map((key) => ({
        id: key.id,
        agencyId: key.agencyId,
        agency: key.agency.user.fullName,
        keyHint: `bjk_••••${key.id.replace(/-/g, '').slice(0, 4)}`,
        scope: key.scope,
        status: key.status,
        activatedAt: key.activatedAt,
        expiresAt: key.expiresAt,
        lastUsedAt: key.lastUsedAt,
        callCount: key.callCount,
      })),
      eligibleAgencies: eligibleAgencies.map((agency) => ({
        id: agency.userId,
        name: agency.user.fullName,
        licenseNo: agency.licenseNo,
      })),
      events: events.map((event) => ({
        id: event.id,
        actor: event.actor?.fullName ?? 'سامانه',
        action: event.action,
        detail: event.detail,
        category: event.category,
        type: event.category === 'SECURITY' ? 'SECURITY' : 'AUDIT',
        level:
          event.category === 'SECURITY'
            ? 'ERROR'
            : /رد|تعلیق|مجدد/.test(event.action)
              ? 'WARN'
              : 'INFO',
        createdAt: event.createdAt,
      })),
    };
  }

  async decideRequest(
    actor: AuthenticatedUser,
    requestId: string,
    dto: DecideWebserviceRequestDto,
  ) {
    const request = await this.requestRepo.findOneBy({ id: requestId });
    if (!request) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'درخواست وب‌سرویس یافت نشد.',
      });
    }
    return this.agencies.decideWebserviceRequest(
      actor,
      request.agencyId,
      request.id,
      dto.approve,
      dto.stepUpChallengeId,
      dto.stepUpCode,
    );
  }

  issueClient(
    actor: AuthenticatedUser,
    agencyId: string,
    scope: AgencyApiScope,
    stepUpChallengeId: string,
    stepUpCode: string,
  ) {
    return this.agencies.issueApiKey(
      actor,
      agencyId,
      scope,
      stepUpChallengeId,
      stepUpCode,
    );
  }

  async updateClient(
    actor: AuthenticatedUser,
    keyId: string,
    dto: ClientUpdate,
  ) {
    const key = await this.keyRepo.findOneBy({ id: keyId });
    if (!key) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'کلاینت API یافت نشد.',
      });
    }
    return this.agencies.updateApiKey(actor, key.agencyId, key.id, dto);
  }
}
