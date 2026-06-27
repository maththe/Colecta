import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateZoneDto {
  @IsUUID()
  siteId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string | null;

  // Cor de exibição da zona (ex.: hex "#16a34a"). Validação leve.
  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string | null;

  // Polígono da zona em GeoJSON (Polygon/MultiPolygon). A forma (type/coordinates)
  // é checada no service; aqui só garantimos que é objeto.
  @IsObject()
  polygon!: Record<string, unknown>;
}
