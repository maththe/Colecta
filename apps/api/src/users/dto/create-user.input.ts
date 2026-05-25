import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserInput {
  @IsEmail({}, { message: 'E-mail inválido.' })
  email!: string;

  @IsString()
  @MinLength(2, { message: 'Nome deve ter ao menos 2 caracteres.' })
  name!: string;

  @IsString()
  @MinLength(6, { message: 'Senha deve ter ao menos 6 caracteres.' })
  senha!: string;
}
