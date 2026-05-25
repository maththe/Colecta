import { Module } from '@nestjs/common';
import { TrashBinsService } from './trash-bins.service';
import { TrashBinsController } from './trash-bins.controller';

@Module({
  controllers: [TrashBinsController],
  providers: [TrashBinsService],
  exports: [TrashBinsService],
})
export class TrashBinsModule {}
