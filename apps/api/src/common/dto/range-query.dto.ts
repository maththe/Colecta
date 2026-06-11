import { IsISO8601, IsOptional } from 'class-validator';

// Período opcional (?from=...&to=...) usado por analytics e relatórios.
export class RangeQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
