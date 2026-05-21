import { Module } from '@nestjs/common';
import { TrashBinsController } from './trash-bins.controller';
import { TrashBinsService } from './trash-bins.service';

@Module({
  controllers: [TrashBinsController],
  providers: [TrashBinsService],
  exports: [TrashBinsService],
})
export class TrashBinsModule {}
