import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { FlightInstance } from '../../database/entities/flight-instance.entity';
import { FlightReview } from '../../database/entities/flight-review.entity';
import { FarePricingProposal } from '../../database/entities/fare-pricing-proposal.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import {
  FlightDefinitionStatus,
  FlightReviewDecision,
  FlightReviewStage,
} from '../../database/enums';
import { ErrorCode } from '../../common/errors';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { FlightDefinitionService } from './flight-definition.service';
import { toFlightUiStatus, toPublishStatus } from './definition-sellability';

const SUBMITTABLE: FlightDefinitionStatus[] = [
  FlightDefinitionStatus.DRAFT,
  FlightDefinitionStatus.OPERATIONS_REJECTED,
  FlightDefinitionStatus.REJECTED,
  FlightDefinitionStatus.PENDING_REVISION,
];

@Injectable()
export class FlightWorkflowService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(FlightInstance)
    private readonly instanceRepo: Repository<FlightInstance>,
    @InjectRepository(FlightReview)
    private readonly reviewRepo: Repository<FlightReview>,
    @InjectRepository(FarePricingProposal)
    private readonly proposalRepo: Repository<FarePricingProposal>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly definitions: FlightDefinitionService,
  ) {}

  private assertVersion(instance: FlightInstance, expectedVersion?: number) {
    if (expectedVersion == null) return;
    if (instance.version !== expectedVersion) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message:
          'نسخه پرواز تغییر کرده است. صفحه را تازه کنید و دوباره تلاش کنید.',
      });
    }
  }

  async submitOperations(
    actor: AuthenticatedUser,
    id: string,
    expectedVersion?: number,
  ) {
    const updatedId = await this.dataSource.transaction(async (manager) => {
      const instance = await manager.findOne(FlightInstance, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!instance) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'پرواز یافت نشد.',
        });
      }
      this.assertVersion(instance, expectedVersion);
      if (!SUBMITTABLE.includes(instance.definitionStatus)) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'این پرواز در وضعیت فعلی قابل ارسال به عملیات نیست.',
        });
      }

      const proposal = await manager.findOne(FarePricingProposal, {
        where: { flightInstanceId: id },
        order: { updatedAt: 'DESC' },
      });
      if (!proposal) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'قبل از ارسال به عملیات، پیشنهاد قیمت را ثبت کنید.',
        });
      }

      const fromStatus = instance.definitionStatus;
      instance.definitionStatus = FlightDefinitionStatus.PENDING_OPERATIONS;
      instance.rejectionReason = null;
      instance.version += 1;
      await manager.save(instance);

      await manager.save(
        manager.create(AuditLog, {
          actorId: actor.id,
          actorRole: actor.role,
          category: 'SYSTEM',
          action: 'ارسال تعریف پرواز به عملیات',
          detail: `پرواز برای بررسی مدیر عملیات ارسال شد (${fromStatus} → PENDING_OPERATIONS).`,
          entityType: 'FlightInstance',
          entityId: id,
          metadata: {
            fromStatus,
            toStatus: FlightDefinitionStatus.PENDING_OPERATIONS,
            version: instance.version,
          },
        }),
      );

      return instance.id;
    });

    return this.definitions.getDefinition(updatedId);
  }

  async listOperationsQueue(status?: string) {
    const definitionStatus =
      status === 'OPERATIONS_REJECTED'
        ? FlightDefinitionStatus.OPERATIONS_REJECTED
        : FlightDefinitionStatus.PENDING_OPERATIONS;

    const rows = await this.instanceRepo.find({
      where: { definitionStatus },
      relations: { flight: { route: true } },
      order: { departureAt: 'ASC' },
      take: 100,
    });

    return this.shapeOperationsRows(rows);
  }

  async operationsOverview() {
    const trackedStatuses = [
      FlightDefinitionStatus.PENDING_OPERATIONS,
      FlightDefinitionStatus.OPERATIONS_REJECTED,
      FlightDefinitionStatus.REJECTED,
      FlightDefinitionStatus.PENDING_CEO,
      FlightDefinitionStatus.PUBLISHED,
    ];
    const [
      pendingRows,
      recentRows,
      pendingOperations,
      pendingCeo,
      opsRejected,
      ceoRejected,
      published,
    ] = await Promise.all([
      this.instanceRepo.find({
        where: {
          definitionStatus: FlightDefinitionStatus.PENDING_OPERATIONS,
        },
        relations: { flight: { route: true } },
        order: { departureAt: 'ASC' },
        take: 100,
      }),
      this.instanceRepo.find({
        where: {
          definitionStatus: In(
            trackedStatuses.filter(
              (status) => status !== FlightDefinitionStatus.PENDING_OPERATIONS,
            ),
          ),
        },
        relations: { flight: { route: true } },
        order: { departureAt: 'DESC' },
        take: 100,
      }),
      this.countByDefinitionStatus(FlightDefinitionStatus.PENDING_OPERATIONS),
      this.countByDefinitionStatus(FlightDefinitionStatus.PENDING_CEO),
      this.countByDefinitionStatus(FlightDefinitionStatus.OPERATIONS_REJECTED),
      this.countByDefinitionStatus(FlightDefinitionStatus.REJECTED),
      this.countByDefinitionStatus(FlightDefinitionStatus.PUBLISHED),
    ]);
    const rows = [...pendingRows, ...recentRows];
    const shaped = await this.shapeOperationsRows(rows);

    return {
      counts: {
        pendingOperations,
        pendingCeo,
        operationsRejected: opsRejected + ceoRejected,
        published,
      },
      pending: shaped.filter(
        (row) =>
          row.definitionStatus === FlightDefinitionStatus.PENDING_OPERATIONS,
      ),
      rows: shaped,
    };
  }

  private async shapeOperationsRows(rows: FlightInstance[]) {
    const proposals = rows.length
      ? await this.proposalRepo.find({
          where: { flightInstanceId: In(rows.map((row) => row.id)) },
          relations: { proposedBy: true },
        })
      : [];
    const proposalByFlight = new Map(
      proposals.map((proposal) => [proposal.flightInstanceId, proposal]),
    );

    return rows.map((inst) => {
      const proposal = proposalByFlight.get(inst.id);
      return {
        id: inst.id,
        flightNo: inst.flight.flightNo,
        originCode: inst.flight.route.originCode,
        destCode: inst.flight.route.destCode,
        departureAt: inst.departureAt.toISOString(),
        capacity: inst.capacity,
        charterSeats: inst.charterSeats,
        aircraftType:
          inst.aircraftTypeOverride ?? inst.flight.aircraftType ?? '—',
        basePriceIrr:
          proposal?.basePriceIrr?.toString() ??
          inst.basePriceIrr?.toString() ??
          null,
        competitorPriceIrr:
          proposal?.competitorPriceIrr?.toString() ??
          inst.competitorPriceIrr?.toString() ??
          null,
        proposal: proposal
          ? {
              id: proposal.id,
              proposedPriceIrr: proposal.proposedPriceIrr.toString(),
              legalRateIrr: proposal.legalRateIrr?.toString() ?? null,
              note: proposal.note,
              status: proposal.status,
              proposedBy: proposal.proposedBy
                ? {
                    id: proposal.proposedBy.id,
                    fullName: proposal.proposedBy.fullName,
                  }
                : null,
            }
          : null,
        definitionStatus: inst.definitionStatus,
        publishStatus: toPublishStatus(
          inst.definitionStatus,
          inst.approvedSnapshot != null,
        ),
        uiStatus: toFlightUiStatus(
          inst.definitionStatus,
          inst.approvedSnapshot != null,
        ),
        version: inst.version,
        rejectionReason: inst.rejectionReason,
      };
    });
  }

  private countByDefinitionStatus(status: FlightDefinitionStatus) {
    return this.instanceRepo
      .createQueryBuilder('instance')
      .where('instance.definitionStatus = :status', { status })
      .getCount();
  }

  async operationsDecision(
    actor: AuthenticatedUser,
    id: string,
    dto: {
      decision: 'APPROVED' | 'REJECTED';
      comment: string;
      expectedVersion?: number;
    },
  ) {
    const comment = (dto.comment ?? '').trim();
    if (!comment) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'ثبت نظر مدیر عملیات الزامی است.',
      });
    }

    const updatedId = await this.dataSource.transaction(async (manager) => {
      const instance = await manager.findOne(FlightInstance, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!instance) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'پرواز یافت نشد.',
        });
      }
      this.assertVersion(instance, dto.expectedVersion);
      if (
        instance.definitionStatus !== FlightDefinitionStatus.PENDING_OPERATIONS
      ) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'فقط پروازهای در انتظار عملیات قابل تصمیم‌گیری هستند.',
        });
      }

      const fromStatus = instance.definitionStatus;
      const approved = dto.decision === 'APPROVED';
      instance.definitionStatus = approved
        ? FlightDefinitionStatus.PENDING_CEO
        : FlightDefinitionStatus.OPERATIONS_REJECTED;
      instance.rejectionReason = approved ? null : comment;
      instance.version += 1;
      await manager.save(instance);

      const review = manager.create(FlightReview, {
        flightInstanceId: id,
        stage: FlightReviewStage.OPERATIONS,
        decision: approved
          ? FlightReviewDecision.APPROVED
          : FlightReviewDecision.REJECTED,
        comment,
        reviewedByUserId: actor.id,
        reviewedAt: new Date(),
        expectedVersion: dto.expectedVersion ?? null,
      });
      await manager.save(review);

      await manager.save(
        manager.create(AuditLog, {
          actorId: actor.id,
          actorRole: actor.role,
          category: 'SYSTEM',
          action: approved
            ? 'تأیید تعریف پرواز توسط عملیات'
            : 'رد تعریف پرواز توسط عملیات',
          detail: comment,
          entityType: 'FlightInstance',
          entityId: id,
          metadata: {
            fromStatus,
            toStatus: instance.definitionStatus,
            decision: dto.decision,
            version: instance.version,
            reviewId: review.id,
          },
        }),
      );

      return instance.id;
    });

    return this.definitions.getDefinition(updatedId);
  }

  async history(id: string) {
    const instance = await this.instanceRepo.findOne({ where: { id } });
    if (!instance) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پرواز یافت نشد.',
      });
    }

    const reviews = await this.reviewRepo.find({
      where: { flightInstanceId: id },
      order: { reviewedAt: 'DESC' },
    });

    const proposal = await this.proposalRepo.findOne({
      where: { flightInstanceId: id },
      select: { id: true },
    });
    const entityIds = proposal ? [id, proposal.id] : [id];

    const audits = await this.auditLogRepo.find({
      where: {
        entityType: In(['FlightInstance', 'FarePricingProposal']),
        entityId: In(entityIds),
      },
      order: { createdAt: 'DESC' },
      take: 100,
    });

    return {
      id,
      definitionStatus: instance.definitionStatus,
      publishStatus: toPublishStatus(
        instance.definitionStatus,
        instance.approvedSnapshot != null,
      ),
      uiStatus: toFlightUiStatus(
        instance.definitionStatus,
        instance.approvedSnapshot != null,
      ),
      version: instance.version,
      reviews: reviews.map((r) => ({
        id: r.id,
        stage: r.stage,
        decision: r.decision,
        comment: r.comment,
        reviewedByUserId: r.reviewedByUserId,
        reviewedAt: r.reviewedAt.toISOString(),
        expectedVersion: r.expectedVersion,
      })),
      audit: audits.map((a) => ({
        id: a.id,
        category: a.category,
        action: a.action,
        detail: a.detail,
        entityType: a.entityType,
        entityId: a.entityId,
        actorRole: a.actorRole,
        createdAt: a.createdAt.toISOString(),
        metadata: a.metadata,
      })),
    };
  }
}
