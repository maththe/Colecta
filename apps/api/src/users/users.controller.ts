import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  Query,
} from '@nestjs/common';
import type { Request } from 'express';
import crypto from 'crypto';
import { Public } from '../auth/public.decorator';
import { UsersService } from './users.service';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private sanitize(user: any) {
    if (!user) return null;
    const { password, tenantUuid, ...rest } = user;
    return rest;
  }

  @Public()
  @Post()
  async create(@Body() createUserDto: CreateUserInput) {
    const tenantUuid = crypto.randomUUID();
    const user = await this.usersService.create(createUserDto, tenantUuid);
    return this.sanitize(user);
  }

  @Post('tenant')
  async createForTenant(@Body() createUserDto: CreateUserInput, @Req() req: Request) {
    const user = (req as any).user;
    const created = await this.usersService.create(createUserDto, user?.tenantUuid);
    return this.sanitize(created);
  }

  @Get("lista")
  async findAll(@Req() req: Request, @Query('search') search?: string) {
    const user = (req as any).user;
    const users = await this.usersService.findAll(user?.tenantUuid, search);
    return users.map((user) => this.sanitize(user));
  }

  @Get('me')
  async me(@Req() req: Request) {
    const user = (req as any).user;
    const found = await this.usersService.findMe(user.sub, user.tenantUuid);
    return this.sanitize(found);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const user = (req as any).user;
    const found = await this.usersService.findOne(id, user?.tenantUuid);
    return this.sanitize(found);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserInput,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const updated = await this.usersService.update(
      id,
      updateUserDto,
      user?.tenantUuid,
    );
    return this.sanitize(updated);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = (req as any).user;
    const removed = await this.usersService.remove(id, user?.tenantUuid);
    return this.sanitize(removed);
  }
}

