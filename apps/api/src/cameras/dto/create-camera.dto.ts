import {
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CameraStatus } from '@prisma/client';

// Cadastro simplificado de câmera (página "Adicionar no mapa"): só código, nome
// e coordenada são obrigatórios. Os campos técnicos (modelo, IP, resolução, fps)
// são opcionais e recebem valores padrão no serviço quando omitidos.
export class CreateCameraDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ipAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  resolution?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
  fps?: number;

  @IsOptional()
  @IsEnum(CameraStatus)
  status?: CameraStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string | null;

  @IsOptional()
  @IsUUID()
  trashBinId?: string | null;
}
