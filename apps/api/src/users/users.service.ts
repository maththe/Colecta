import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { PrismaService } from 'src/prisma/prisma.service';
import { User, UserRole } from '@prisma/client';
import { matchesSearch } from 'src/common/search.util';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserInput: CreateUserInput, tenantUuid?: string): Promise<User> {
    const password = await bcrypt.hash(createUserInput.senha, 10);

    return this.prisma.user.create({
      data: {
        email: createUserInput.email,
        name: createUserInput.name,
        password,
        role: createUserInput.role || UserRole.LIMPEZA,
        ...(tenantUuid ? { tenantUuid } : {}),
      },
    });
  }

  async findAll(tenantUuid?: string, search?: string): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: tenantUuid ? { tenantUuid } : undefined,
      orderBy: { name: 'asc' },
    });

    return users.filter((user) => matchesSearch([user.name, user.email], search));
  }

  async findOne(id: string, tenantUuid?: string): Promise<User | null> {
    const where: any = { id };
    if (tenantUuid) where.tenantUuid = tenantUuid;

    return this.prisma.user.findFirst({ where });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findMe(id: string, tenantUuid: string): Promise<User | null> {
    return this.findOne(id, tenantUuid);
  }

  async update(
    id: string,
    updateUserInput: UpdateUserInput,
    tenantUuid?: string,
  ): Promise<User> {
    const existing = await this.findOne(id, tenantUuid);
    if (!existing) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const data: any = { ...updateUserInput };

    if (updateUserInput.senha) {
      data.password = await bcrypt.hash(updateUserInput.senha, 10);
      delete data.senha;
    }

    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, tenantUuid?: string): Promise<User> {
    const existing = await this.findOne(id, tenantUuid);
    if (!existing) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    return this.prisma.user.delete({
      where: { id },
    });
  }
}
