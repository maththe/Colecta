import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
} from 'class-validator';
import { TrashBinStatus } from '@prisma/client';

export class CreateTrashBinDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(60)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  locationDescription?: string | null;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  capacityLiters!: number;

  @IsOptional()
  @IsEnum(TrashBinStatus)
  status?: TrashBinStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  fillLevel?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  batteryLevel?: number | null;
}
