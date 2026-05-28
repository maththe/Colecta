import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { SensorReadingsService } from './sensor-readings.service';
import { CreateSensorReadingDto } from './dto/create-sensor-reading.dto';
import { getTenantUuid } from '../common/tenant.util';

@Controller('sensor-readings')
export class SensorReadingsController {
  constructor(private readonly service: SensorReadingsService) {}

  @Get()
  findAll(@Req() req: Request) {
    return this.service.findAll(getTenantUuid(req));
  }

  @Get('trash-bin/:trashBinId')
  findByTrashBin(
    @Param('trashBinId', new ParseUUIDPipe()) trashBinId: string,
    @Req() req: Request,
  ) {
    return this.service.findByTrashBin(trashBinId, getTenantUuid(req));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSensorReadingDto, @Req() req: Request) {
    return this.service.create(dto, getTenantUuid(req));
  }
}
