import * as dotenv from 'dotenv';
import * as path from 'node:path';

dotenv.config({ path: path.join(__dirname, '..', '.env.test') });
