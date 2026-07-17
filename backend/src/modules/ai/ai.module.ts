import { Module } from '@nestjs/common';
import {
  MlPriceSuggestionProvider,
  PRICE_SUGGESTION_PROVIDER,
} from './price-suggestion.provider';

/** All AI/ML vendor calls live behind provider interfaces here, per
 * CLAUDE.md's AI rules — swappable without touching business logic. */
@Module({
  providers: [
    { provide: PRICE_SUGGESTION_PROVIDER, useClass: MlPriceSuggestionProvider },
  ],
  exports: [PRICE_SUGGESTION_PROVIDER],
})
export class AiModule {}
