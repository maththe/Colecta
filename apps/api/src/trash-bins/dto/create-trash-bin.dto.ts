import {
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TrashBinStatus } from '@prisma/client';

export class CreateTrashBinDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  locationDescription?: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsInt()
  @Min(1)
  @Max(100000)
  capacityLiters!: number;

  @IsOptional()
  @IsEnum(TrashBinStatus)
  status?: TrashBinStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  fillLevel?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  batteryLevel?: number;
}
