import {
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SiteBaseMode } from '@prisma/client';

export class CreateSiteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  // Contorno do recinto em GeoJSON (Polygon/MultiPolygon). Validamos só que é
  // objeto aqui; a forma (type/coordinates) é checada no service.
  @IsOptional()
  @IsObject()
  boundary?: Record<string, unknown> | null;

  @IsOptional()
  @IsEnum(SiteBaseMode)
  baseMode?: SiteBaseMode;

  @IsOptional()
  @IsLatitude()
  centerLat?: number | null;

  @IsOptional()
  @IsLongitude()
  centerLng?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(22)
  defaultZoom?: number | null;
}
