import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  // Injetamos o JwtService para podermos verificar o token
  // e o Reflector para suportar rotas públicas (com @Public)
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Se a rota for pública (decorator @Public()), pulamos o guard
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Pega o objeto da requisição HTTP
    const request = context.switchToHttp().getRequest();
    
    // Extrai o token do cabeçalho
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new UnauthorizedException('Token de acesso não encontrado.');
    }
    
    try {
      // Tenta verificar e decodificar o token.
      // IMPORTANTE: Use a mesma secret que você usou na hora de gerar o token no login!
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'chave_super_secreta_aqui' // Recomendo usar .env
      });
      
      // Se deu certo, injetamos os dados do usuário (payload) na requisição.
      // Assim, seus controllers saberão QUEM está logado.
      request['user'] = payload;
      
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
    
    // Retorna true, liberando o acesso à rota!
    return true;
  }

  // Função auxiliar para pegar o token do padrão "Bearer <token>"
  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}