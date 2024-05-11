import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersModule } from 'src/users/users.module';
import { PassportModule } from '@nestjs/passport';
import { LocalStrategy } from './local.strategy';
import { SessionSerializer } from './session.serializer';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ForgotPassword } from './forgotpassword.entity';
import { EmailVerification } from './emailVerification.entity';
// import { Log } from './log.entity';
import { AuthController } from './auth.controller';
import { ConfigModule } from 'src/config/config.module';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './constants';
import { JwtStrategy } from './jwt.strategy';
import { Log } from './log.entity';

@Module({
  imports: [
    UsersModule,
    ConfigModule,
    PassportModule.register({ session: true }),
    TypeOrmModule.forFeature([ForgotPassword]),
    TypeOrmModule.forFeature([EmailVerification]),
    TypeOrmModule.forFeature([Log]),
    JwtModule.register({
      secret: jwtConstants.secret,
    }),
  ],
  providers: [AuthService, LocalStrategy, SessionSerializer, JwtStrategy],
  exports: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
