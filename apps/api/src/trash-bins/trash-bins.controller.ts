import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { TrashBinsService } from './trash-bins.service';
import { CreateTrashBinDto } from './dto/create-trash-bin.dto';
import { UpdateTrashBinDto } from './dto/update-trash-bin.dto';
import { getTenantUuid } from '../common/tenant.util';

@Controller('trash-bins')
export class TrashBinsController {
  constructor(private readonly service: TrashBinsService) {}

  @Get()
  findAll(@Req() req: Request) {
    return this.service.findAll(getTenantUuid(req));
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.service.findOne(id, getTenantUuid(req));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTrashBinDto, @Req() req: Request) {
    return this.service.create(dto, getTenantUuid(req));
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTrashBinDto,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, getTenantUuid(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.service.remove(id, getTenantUuid(req));
  }
}
