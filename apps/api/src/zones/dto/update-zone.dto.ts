import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateZoneDto } from './create-zone.dto';

// O Site de uma zona não muda por PATCH (ela nasce dentro de um recinto). Logo o
// update aceita name/category/color/polygon, mas não siteId.
export class UpdateZoneDto extends PartialType(OmitType(CreateZoneDto, ['siteId'] as const)) {}
