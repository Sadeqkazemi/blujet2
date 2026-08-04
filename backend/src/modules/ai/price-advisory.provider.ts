import { Injectable, Logger } from '@nestjs/common';

export type PriceAdvisoryRecommendation = 'BUY_NOW' | 'WAIT';

export type PriceAdvisoryUnavailable = {
  available: false;
  reason: 'ADVISORY_UNAVAILABLE';
};

export type PriceAdvisoryAvailable = {
  available: true;
  recommendation: PriceAdvisoryRecommendation;
  explanationFa: string;
  modelVersion: string;
  confidence: number;
};

export type PriceAdvisoryResult =
  | PriceAdvisoryUnavailable
  | PriceAdvisoryAvailable;

export interface PriceAdvisoryInput {
  origin: string;
  dest: string;
  date: string;
  cabin?: 'ECONOMY' | 'BUSINESS';
}

/** Wire format for ml-service when POST /internal/v1/recommendations lands. */
interface MlRecommendationWire {
  model_version: string;
  recommendation: PriceAdvisoryRecommendation;
  explanation_fa: string;
  confidence: number;
}

export const PRICE_ADVISORY_PROVIDER = Symbol('PRICE_ADVISORY_PROVIDER');

export interface PriceAdvisoryProvider {
  /** Always resolves — never throws. Returns unavailable when ML is not ready. */
  advise(
    input: PriceAdvisoryInput,
    requestId?: string,
  ): Promise<PriceAdvisoryResult>;
}

const ML_TIMEOUT_MS = 2000;

const UNAVAILABLE: PriceAdvisoryUnavailable = {
  available: false,
  reason: 'ADVISORY_UNAVAILABLE',
};

@Injectable()
export class MlPriceAdvisoryProvider implements PriceAdvisoryProvider {
  private readonly logger = new Logger(MlPriceAdvisoryProvider.name);

  async advise(
    input: PriceAdvisoryInput,
    requestId?: string,
  ): Promise<PriceAdvisoryResult> {
    const baseUrl = process.env.ML_SERVICE_URL;
    const token = process.env.ML_SERVICE_INTERNAL_TOKEN;
    if (!baseUrl || !token) return UNAVAILABLE;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);
    try {
      const res = await fetch(`${baseUrl}/internal/v1/recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': token,
          'X-Request-Id': requestId ?? '-',
        },
        body: JSON.stringify({
          origin_code: input.origin.toUpperCase(),
          dest_code: input.dest.toUpperCase(),
          date: input.date,
          cabin: input.cabin ?? 'ECONOMY',
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`ml-service recommendations returned ${res.status}`);
        return UNAVAILABLE;
      }
      const body = (await res.json()) as MlRecommendationWire;
      if (
        (body.recommendation !== 'BUY_NOW' && body.recommendation !== 'WAIT') ||
        !body.explanation_fa ||
        typeof body.confidence !== 'number'
      ) {
        this.logger.warn('ml-service recommendations payload incomplete or invalid');
        return UNAVAILABLE;
      }
      return {
        available: true,
        recommendation: body.recommendation,
        explanationFa: body.explanation_fa,
        modelVersion: body.model_version ?? 'unknown',
        confidence: body.confidence,
      };
    } catch (err) {
      this.logger.warn(
        `ml-service recommendations unavailable: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      return UNAVAILABLE;
    } finally {
      clearTimeout(timer);
    }
  }
}
