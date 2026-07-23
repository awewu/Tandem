import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/auth.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ExpressGovernanceService = require('../../../../../server/modules/governance/governance.service');

@Injectable()
export class GovernanceService {
  private readonly svc = new ExpressGovernanceService();

  getAgentProgress(user: JwtPayload) {
    const scope = {
      tenantId: user.tenantId,
      dealerId: user.dealerId,
      storeId: user.storeId,
      userId: user.userId,
      role: user.role,
    };
    return this.svc.getAgentProgress(scope);
  }
}
