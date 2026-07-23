import { Injectable, Logger } from '@nestjs/common';
import type {
  NiraManifestPassenger,
  NiraProvider,
  NiraSubmissionResult,
} from './nira-provider.interface';

/** Dev/test provider — logs the manifest instead of calling the real
 * سامانه نیرا system. Never used in production. Always reports success;
 * never fabricates a failure rate (same convention as MockSmsProvider). */
@Injectable()
export class MockNiraProvider implements NiraProvider {
  private readonly logger = new Logger(MockNiraProvider.name);

  submitManifest(
    flightNo: string,
    departureAt: Date,
    passengers: NiraManifestPassenger[],
  ): Promise<NiraSubmissionResult> {
    this.logger.log(
      `نیرا manifest for ${flightNo} (${departureAt.toISOString()}): ${passengers.length} passenger(s)`,
    );
    return Promise.resolve({ success: true });
  }
}
