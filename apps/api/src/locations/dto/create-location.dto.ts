import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  // Recinto (Site) ao qual a construção pertence. Opcional: resolvido pela
  // coordenada (Turf) caindo no Site default quando omitido.
  @IsOptional()
  @IsUUID()
  siteId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  floorsCount?: number | null;

  // Mapa "andar -> data URL da imagem da planta". Validamos só que é objeto;
  // os valores (data URLs) podem ser grandes, então não impomos tamanho aqui.
  @IsOptional()
  @IsObject()
  floorPlans?: Record<string, string> | null;
}
