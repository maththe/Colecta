import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserInput {
  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido.' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Nome deve ter ao menos 2 caracteres.' })
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Senha deve ter ao menos 6 caracteres.' })
  senha?: string;
}
