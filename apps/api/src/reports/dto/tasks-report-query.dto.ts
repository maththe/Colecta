import { IsOptional, IsUUID } from 'class-validator';
import { RangeQueryDto } from '../../common/dto/range-query.dto';

export class TasksReportQueryDto extends RangeQueryDto {
  @IsOptional()
  @IsUUID()
  trashBinId?: string;

  @IsOptional()
  @IsUUID()
  startedById?: string;
}
