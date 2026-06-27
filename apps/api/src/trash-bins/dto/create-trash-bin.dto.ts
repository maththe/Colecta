import {
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
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

  @IsOptional()
  @IsUUID()
  locationId?: string | null;

  // Recinto (Site). Opcional: indoor herda da construção; outdoor resolve pela
  // coordenada (Turf) caindo no Site default. Ver geo.util.resolveSiteId.
  @IsOptional()
  @IsUUID()
  siteId?: string | null;

  // Zona (override manual do ADMIN). Opcional: normalmente o zoneId é recalculado
  // pela coordenada (Turf). Um valor explícito sobrescreve até o próximo recálculo
  // disparado por edição de zona.
  @IsOptional()
  @IsUUID()
  zoneId?: string | null;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

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

  @IsOptional()
  @IsString()
  @MaxLength(200)
  mqttTopic?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  distanceEmptyCm?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  distanceFullCm?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  floor?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  posX?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  posY?: number | null;
}
