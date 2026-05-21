import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateSensorReadingDto {
  @IsUUID()
  trashBinId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  fillLevel!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  batteryLevel?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  @Max(150)
  temperature?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @IsOptional()
  payload?: unknown;

  @IsOptional()
  @IsDateString()
  receivedAt?: string;
}
