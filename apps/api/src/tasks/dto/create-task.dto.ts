import {
  IsDateString,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { TaskPriority, TaskStatus, UserRole } from '@prisma/client';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

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

  // Coordenadas para tarefa posicionada livremente no mapa. As duas precisam vir
  // juntas: se uma for informada, a outra passa a ser obrigatória.
  @ValidateIf((o: CreateTaskDto) => o.longitude !== undefined && o.longitude !== null)
  @IsLatitude()
  latitude?: number | null;

  @ValidateIf((o: CreateTaskDto) => o.latitude !== undefined && o.latitude !== null)
  @IsLongitude()
  longitude?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  assigneeName?: string | null;

  @IsEnum(UserRole)
  assigneeRole!: UserRole;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;
}
