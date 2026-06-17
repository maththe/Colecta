import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TaskPriority } from '@prisma/client';

export class CreateSecurityOccurrenceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsUUID()
  trashBinId?: string | null;

  @IsOptional()
  @IsUUID()
  locationId?: string | null;

  @IsOptional()
  @IsUUID()
  cameraId?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  cameraCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  cameraName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  locationName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  targetLabel?: string | null;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;
}
