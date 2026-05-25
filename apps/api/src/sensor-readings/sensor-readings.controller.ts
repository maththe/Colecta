import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { SensorReadingsService } from './sensor-readings.service';
import { CreateSensorReadingDto } from './dto/create-sensor-reading.dto';

@Controller('sensor-readings')
export class SensorReadingsController {
  constructor(private readonly service: SensorReadingsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('trash-bin/:trashBinId')
  findByTrashBin(@Param('trashBinId', new ParseUUIDPipe()) trashBinId: string) {
    return this.service.findByTrashBin(trashBinId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSensorReadingDto) {
    return this.service.create(dto);
  }
}
