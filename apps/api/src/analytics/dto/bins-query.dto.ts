import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { RangeQueryDto } from '../../common/dto/range-query.dto';

// Query do GET /analytics/bins: período (herdado) + agrupamento opcional por zona.
// Sem `groupBy`, devolve a atividade por lixeira (comportamento original).
export class BinsQueryDto extends RangeQueryDto {
  @IsOptional()
  @IsIn(['zone'])
  groupBy?: 'zone';

  @IsOptional()
  @IsUUID()
  siteId?: string;
}
