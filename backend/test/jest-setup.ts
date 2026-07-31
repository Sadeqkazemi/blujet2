import * as dotenv from 'dotenv';
import * as path from 'node:path';
import '../src/common/bigint-json';

dotenv.config({ path: path.join(__dirname, '..', '.env.test') });
