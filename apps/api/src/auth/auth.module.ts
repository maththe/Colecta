import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { getJwtSecret } from './jwt-secret';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: getJwtSecret(),
      signOptions: { expiresIn: '1h' },
    }),
    UsersModule,
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}