import { Module } from '@nestjs/common';
import {
  MlPriceSuggestionProvider,
  PRICE_SUGGESTION_PROVIDER,
} from './price-suggestion.provider';
import {
  AnthropicSurveySummaryProvider,
  SURVEY_SUMMARY_PROVIDER,
} from './survey-summary.provider';

/** All AI/ML vendor calls live behind provider interfaces here, per
 * CLAUDE.md's AI rules — swappable without touching business logic. */
@Module({
  providers: [
    { provide: PRICE_SUGGESTION_PROVIDER, useClass: MlPriceSuggestionProvider },
    {
      provide: SURVEY_SUMMARY_PROVIDER,
      useClass: AnthropicSurveySummaryProvider,
    },
  ],
  exports: [PRICE_SUGGESTION_PROVIDER, SURVEY_SUMMARY_PROVIDER],
})
export class AiModule {}
