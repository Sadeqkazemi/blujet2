import { Inject, Injectable } from '@nestjs/common';
import {
  PRICE_ADVISORY_PROVIDER,
  type PriceAdvisoryInput,
  type PriceAdvisoryProvider,
  type PriceAdvisoryResult,
} from '../ai/price-advisory.provider';

@Injectable()
export class PriceAdvisoryService {
  constructor(
    @Inject(PRICE_ADVISORY_PROVIDER)
    private readonly provider: PriceAdvisoryProvider,
  ) {}

  advise(input: PriceAdvisoryInput, requestId?: string): Promise<PriceAdvisoryResult> {
    return this.provider.advise(input, requestId);
  }
}
