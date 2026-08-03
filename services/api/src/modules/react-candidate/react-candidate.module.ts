import { Module } from '@nestjs/common';
import { DevicesCandidateController } from './devices-candidate.controller';
import { DevicesCandidateService } from './devices-candidate.service';
import { ProjectsCandidateController } from './projects-candidate.controller';
import { ProjectsCandidateService } from './projects-candidate.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DevicesCandidateController, ProjectsCandidateController],
  providers: [DevicesCandidateService, ProjectsCandidateService],
})
export class ReactCandidateModule {}
