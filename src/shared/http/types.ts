import type { Request } from 'express';
import type { AccessIdentity } from '../../modules/identity/domain/models.js';
export interface ApiRequest extends Request { requestId: string; identity?: AccessIdentity }
