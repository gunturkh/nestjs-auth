import {
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  UsePipes,
  ValidationPipe,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from 'src/users/users.service';
import { localAuthGuard } from './local-auth.guard';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { User } from 'src/users/user.entity';
import * as bcrypt from 'bcrypt';
import { AuthGuard } from '@nestjs/passport';
import { EventType, Log } from './log.entity';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private usersService: UsersService,
  ) {}

  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Request() req) {
    const user = await this.usersService.findByEmail(req.user.email);
    user.updated_time = new Date();
    user.login_count += 1;

    await this.usersService.save(user);
    const newLog = new Log();
    newLog.user = user;
    newLog.timestamp = new Date();
    newLog.type = EventType.LOGIN;
    await this.authService.saveLog(newLog);
    const data = await this.authService.login(req.user);
    return { msg: 'Login success', data };
  }

  @UseGuards(localAuthGuard)
  @Post('logout')
  async logout(@Req() req) {
    const user = await this.usersService.findByEmail(req.user.email);
    user.logout_time = new Date();
    const newLog = new Log();
    newLog.user = user;
    newLog.timestamp = new Date();
    newLog.type = EventType.LOGOUT;
    await this.authService.saveLog(newLog);
    await this.usersService.save(user);
    return { msg: 'Logout success' };
  }

  @UsePipes(new ValidationPipe())
  @Post('register')
  async register(@Body() userData: CreateUserDto) {
    const entity = Object.assign(new User(), userData);

    // check user exist
    const isUserExists = await this.usersService.checkUserExists(entity.email);
    console.log('isUserExists', isUserExists);
    if (isUserExists) {
      return {
        msg: 'This user is exists',
      };
    }

    // create a new user
    try {
      const user = await this.usersService.create(entity);
      const token = await this.authService.createEmailToken(user.email);
      const sent = await this.authService.sendVerifyEmail(user.email, token);
      console.log('sent', sent);

      if (sent) {
        return { msg: 'Create user success' };
      } else {
        return { msg: 'Create user failed, Email not sent' };
      }
    } catch (error) {
      return { msg: 'Create user failed, Register failure' };
    }
  }

  @Get('email/verify/:token')
  async verifyEmail(@Param('token') token: number): Promise<object> {
    try {
      const isEmailVerified = await this.authService.verifyEmail(token);
      return { msg: 'Email verified', isEmailVerified };
    } catch (error) {
      return { msg: 'Email verification failed', error };
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('email/resend-verification')
  async sendEmailVerification(@Request() req): Promise<object> {
    try {
      const user = await this.usersService.findById(req.user.id);
      const token = await this.authService.recreateEmailToken(user);
      if (token < 0) {
        return { msg: 'Email has not been sent' };
      }

      const isEmailSent = await this.authService.sendVerifyEmail(
        user.email,
        token,
      );
      if (isEmailSent) {
        return { msg: 'Email sent' };
      } else {
        return { msg: 'Email has not been sent' };
      }
    } catch (error) {
      return { msg: 'Error when sending email' };
    }
  }

  @Get('email/forgot-password/:email')
  async sendEmailForgotPassword(
    @Param('email') email: string,
  ): Promise<object> {
    try {
      console.log('email', email);
      const isEmailSent = await this.authService.sendEmailForgotPassword(email);
      if (isEmailSent) {
        return { msg: 'Email for forgot password sent' };
      } else {
        return {
          msg: 'Email for forgot password has not been sent',
        };
      }
    } catch (error) {
      return { msg: 'Error when sending email forgot password' };
    }
  }

  @Get('email/reset-password/:token')
  async resetPasswordFromToken(@Param('token') token) {
    try {
      const user = await this.authService.checkVerificationCode(token);
      const randomPassword = await this.authService.generateRandomPassword();
      // change password
      user.password = bcrypt.hashSync(
        randomPassword,
        bcrypt.genSaltSync(8),
        null,
      );
      await this.usersService.update(user);
      // send email the new password
      const isEmailSent = await this.authService.emailResetedPassword(
        user.email,
        randomPassword,
      );
      if (isEmailSent) {
        return { msg: 'Email for reset password sent' };
      } else {
        return { msg: 'Email for reset has not been sent' };
      }
    } catch (error) {
      return { msg: 'Unexpected error happen' };
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('protected')
  getHello(@Request() req): string {
    return req.user;
  }
}