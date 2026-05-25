import { PartialType } from '@nestjs/mapped-types';
import { CreateTrashBinDto } from './create-trash-bin.dto';

export class UpdateTrashBinDto extends PartialType(CreateTrashBinDto) {}
