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
  HttpStatus,
  Response,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from 'src/users/users.service';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { User } from 'src/users/user.entity';
import * as bcrypt from 'bcrypt';
import { AuthGuard } from '@nestjs/passport';
import { EventType, Log } from '../log/log.entity';
import { GoogleOAuthGuard } from './google-oauth.guard';
import { ConfigService } from '@nestjs/config';
import { UpdatePasswordDto } from 'src/users/dto/update-password.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private usersService: UsersService,
    private configService: ConfigService,
  ) {}

  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(
    @Request() req,
    @Body() body?: { email: string; password: string },
  ) {
    console.log('body', body);
    const user = await this.usersService.findByEmail(body.email);
    console.log('user login', user);
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

  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  async logout(@Req() req) {
    const user = await this.usersService.findByEmail(req.user.email);
    console.log('logout user', user);
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

  @UseGuards(AuthGuard('jwt'))
  @UsePipes(new ValidationPipe())
  @Post('change-password')
  async changePassword(
    @Request() req,
    @Body() updatePassword: UpdatePasswordDto,
  ) {
    const user = await this.usersService.findByEmail(req.user.email);
    if (!user) return { statusCode: 500, msg: 'Cannot find existing user' };
    if (!updatePassword.current_password)
      return { statusCode: 500, msg: 'Missing current password' };
    if (!updatePassword.password)
      return { statusCode: 500, msg: 'Missing password' };
    const isValidCurrentPassword = bcrypt.compareSync(
      updatePassword.current_password,
      user.password,
    );
    if (!isValidCurrentPassword)
      return { statusCode: 500, msg: 'Incorrect old password' };
    user.password = bcrypt.hashSync(
      updatePassword.password,
      bcrypt.genSaltSync(8),
      null,
    );
    this.usersService.update(user);
    return { statusCode: 200, msg: 'Success change password' };
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
  async getLoggedUser(@Request() req) {
    console.log('req.user', req.user);
    return await this.usersService.findByEmail(req.user.email);
  }

  @Get('/facebook')
  @UseGuards(AuthGuard('facebook'))
  async facebookLogin(): Promise<any> {
    return HttpStatus.OK;
  }

  @Get('/facebook/redirect')
  @UseGuards(AuthGuard('facebook'))
  async facebookLoginRedirect(@Req() req): Promise<any> {
    return {
      statusCode: HttpStatus.OK,
      data: req.user,
    };
  }

  @Get('google/:from')
  @UseGuards(GoogleOAuthGuard)
  async googleAuth() {}

  @Get('google-redirect')
  @UseGuards(GoogleOAuthGuard)
  async googleAuthRedirect(@Request() req, @Response() res) {
    console.log('from', req.user);
    if (req.params.from === 'register') {
      const entity = Object.assign(new User(), req.user);
      const randomPassword = await this.authService.generateRandomPassword();
      entity.name = `${req.user.firstName} ${req.user.lastName}`;
      entity.password = randomPassword;
      entity.is_verified = true;

      // check user exist
      const isUserExists = await this.usersService.checkUserExists(
        entity.email,
      );
      console.log('isUserExists', isUserExists);
      if (isUserExists) {
        res.redirect(`${this.configService.get('DOMAIN')}/error/user exist`);
      }

      // create a new user
      try {
        const user = await this.usersService.create(entity);
        if (user) {
          const auth = await this.login(req);
          const { data } = auth;
          res.redirect(
            `${this.configService.get('DOMAIN')}/google-oauth-success-redirect/${data.accessToken}/${req.params.from}`,
          );
        } else {
          res.redirect(
            `${this.configService.get('DOMAIN')}/error/Create user from google account failed`,
          );
        }
      } catch (error) {
        res.redirect(
          `${this.configService.get('DOMAIN')}/error/Create user from google account failed, Register failure`,
        );
      }
    } else {
      const auth = await this.login(req);
      const { data } = auth;
      console.log('token', data.accessToken);
      res.redirect(
        `${this.configService.get('DOMAIN')}/google-oauth-success-redirect/${data.accessToken}/${req.params.from}`,
      );
    }
  }
}
