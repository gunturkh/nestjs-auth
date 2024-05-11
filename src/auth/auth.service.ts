/* eslint-disable @typescript-eslint/no-this-alias */
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/user.entity';
import { UsersService } from 'src/users/users.service';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ForgotPassword } from './forgotpassword.entity';
import { EmailVerification } from './emailVerification.entity';
import { Log } from './log.entity';
import * as nodemailer from 'nodemailer';
import * as smtpTransport from 'nodemailer-smtp-transport';
import { ConfigService } from 'src/config/config.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  transport;
  constructor(
    private configService: ConfigService,
    private readonly usersService: UsersService,
    @InjectRepository(ForgotPassword)
    private readonly forgotPasswordRepository: Repository<ForgotPassword>,
    @InjectRepository(EmailVerification)
    private readonly emailVerificationRepository: Repository<EmailVerification>,
    @InjectRepository(Log)
    private readonly logRepository: Repository<Log>,
    private readonly jwtService: JwtService,
  ) {
    this.transport = nodemailer.createTransport(
      smtpTransport({
        host: this.configService.get('SMTP_HOST'),
        port: Number(this.configService.get('SMTP_PORT')),
        // secure: true,
        auth: {
          user: this.configService.get('SMTP_USER'),
          pass: this.configService.get('SMTP_PASSWORD'),
        },
      }),
    );
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && bcrypt.compareSync(password, user.password)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async createEmailToken(email: string): Promise<number> {
    const user = await this.usersService.findByEmail(email);
    const emailVerification = new EmailVerification();
    emailVerification.user = user;
    emailVerification.token = Math.floor(Math.random() * 9000000) + 1000000;
    emailVerification.timestamp = new Date();
    emailVerification.email = user.email;
    emailVerification.emailToken = emailVerification.token;
    await this.emailVerificationRepository.save(emailVerification);

    return emailVerification.token;
  }

  async recreateEmailToken(user: User): Promise<number> {
    const emailVerification = await this.emailVerificationRepository.findOne({
      where: { user: user },
    });

    if (!emailVerification) {
      return -1;
    } else {
      emailVerification.token = Math.floor(Math.random() * 9000000) + 1000000;
      emailVerification.timestamp = new Date();
      await this.emailVerificationRepository.update(
        emailVerification.id,
        emailVerification,
      );

      return emailVerification.token;
    }
  }

  async sendVerifyEmail(email: string, token: number): Promise<boolean> {
    const verifyUrl =
      this.configService.get('DOMAIN') + '/auth/email/verify/' + token;
    let htmlContent = '<p>Visit this link to verify your email address:</p>';
    htmlContent += '<a href=' + verifyUrl + '>' + verifyUrl + '</a>';
    htmlContent +=
      '<p>Please do not reply to this notification, this inbox is not monitored.</p>';
    htmlContent +=
      '<p>If you are having a problem with your account, please email ' +
      this.configService.get('CONTACT_EMAIL') +
      '</p>';
    htmlContent += '<p>Thanks for using the app</p>';

    console.log('verifyUrl', verifyUrl);

    const mailOptions = {
      from: 'PRODUCT_NAME <' + this.configService.get('CONTACT_EMAIL') + '>',
      to: email, // list of receivers
      subject: '[PRODUCT_NAME] verify your email address', // Subject line
      text: 'Hello world', // plaintext body
      html: htmlContent,
    };

    console.log('mailOptions', mailOptions);

    const authService = this;
    try {
      const sent = await new Promise<boolean>(async function (resolve, reject) {
        return await authService.transport.sendMail(
          mailOptions,
          async (error) => {
            if (error) {
              console.log('register send email error', error);
              return reject(false);
            }
            resolve(true);
          },
        );
      });
      return sent;
    } catch (error) {
      return false;
    }
  }

  async verifyEmail(token: number): Promise<boolean> {
    const emailVerification = await this.emailVerificationRepository.findOne({
      where: { token: token },
    });
    if (emailVerification && emailVerification.email) {
      const userData = await this.usersService.findByEmail(
        emailVerification.email,
      );
      if (userData) {
        userData.is_verified = true;
        const savedUser = await this.usersService.save(userData);
        await this.emailVerificationRepository.delete({ token: token });
        console.log(!!savedUser, !!savedUser.is_verified);
        return !!savedUser;
      }
    } else {
      throw new HttpException(
        'LOGIN.EMAIL_CODE_NOT_VALID',
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }

  async createForgottenPasswordToken(email: string): Promise<ForgotPassword> {
    const userData = await this.usersService.findByEmail(email);
    let forgotPassword = await this.forgotPasswordRepository.findOne({
      where: { user: userData },
    });
    if (
      forgotPassword &&
      (new Date().getTime() - forgotPassword.timestamp.getTime()) / 60000 < 15
    ) {
      throw new HttpException(
        'RESET_PASSWORD.EMAIL_SENDED_RECENTLY',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } else {
      if (!forgotPassword) {
        forgotPassword = new ForgotPassword();
        forgotPassword.user = userData;
      }

      forgotPassword.token = Math.floor(Math.random() * 9000000) + 1000000;
      forgotPassword.timestamp = new Date();

      const ret = await this.forgotPasswordRepository.save(forgotPassword);

      if (ret) {
        return ret;
      } else {
        throw new HttpException(
          'LOGIN.ERROR.GENERIC_ERROR',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  async sendEmailForgotPassword(email: string): Promise<boolean> {
    const userData = await this.usersService.findByEmail(email);
    console.log('userData sendEmailForgotPassword', userData);
    if (!userData)
      throw new HttpException('LOGIN.USER_NOT_FOUND', HttpStatus.NOT_FOUND);

    const tokenModel = await this.createForgottenPasswordToken(email);

    if (tokenModel && tokenModel.token) {
      const transporter = nodemailer.createTransport({
        host: this.configService.get('SMTP_HOST'),
        port: Number(this.configService.get('SMTP_PORT')),
        secure: true,
        auth: {
          user: this.configService.get('SMTP_USER'),
          pass: this.configService.get('SMTP_PASSWORD'),
        },
      });

      const url =
        this.configService.get('DOMAIN') +
        '/auth/email/reset-password/' +
        tokenModel.token;

      const mailOptions = {
        from: 'PRODUCT_NAME <' + this.configService.get('CONTACT_EMAIL') + '>',
        to: email, // list of receivers (separated by ,)
        subject: '[PRODUCT_NAME] Reset password code',
        text: 'Forgot Password',
        html:
          'Hello <br><br> We have received a request to reset your password for your account with email<br>' +
          email +
          '<br>' +
          "If you didn't make this request, please disregard this email or contact our support team at " +
          this.configService.get('CONTACT_EMAIL') +
          ' . Otherwise, you can reset your password using this link:' +
          '<a href=' +
          url +
          '>' +
          url +
          '</a>', // html body
      };

      const sended = await new Promise<boolean>(async function (
        resolve,
        reject,
      ) {
        return await transporter.sendMail(mailOptions, async (error, info) => {
          if (error) {
            console.log('Message sent: %s', error);
            return reject(false);
          }
          console.log('Message sent: %s', info.messageId);
          resolve(true);
        });
      });

      return sended;
    } else {
      throw new HttpException(
        'REGISTER.USER_NOT_REGISTERED',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }

  async checkVerificationCode(token: number): Promise<User> {
    const forgotPassword = await this.forgotPasswordRepository.findOne({
      relations: ['user'],
      where: { token: token },
    });
    return forgotPassword.user;
  }

  async generateRandomPassword() {
    const length = 8;
    const charset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let retVal = '';
    for (let i = 0, n = charset.length; i < length; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    return retVal;
  }

  async emailResetedPassword(
    email: string,
    password: string,
  ): Promise<boolean> {
    let htmlContent = '<p>Your new password is: ' + password + ' </p>';
    htmlContent +=
      '<p>Please do not reply to this notification, this inbox is not monitored.</p>';
    htmlContent +=
      '<p>If you are having a problem with your account, please email ' +
      this.configService.get('CONTACT_EMAIL') +
      '</p>';
    htmlContent += '<p>Thanks for using the app</p>';

    const mailOptions = {
      from: 'PRODUCT_NAME <' + this.configService.get('CONTACT_EMAIL') + '>',
      to: email,
      subject: '[PRODUCT_NAME] forgotten password confirmation',
      html: htmlContent,
    };

    const authService = this;
    try {
      const sent = await new Promise<boolean>(async function (resolve, reject) {
        return await authService.transport.sendMail(
          mailOptions,
          async (error) => {
            if (error) {
              console.log('email send error', error);
              return reject(false);
            }
            resolve(true);
          },
        );
      });
      return sent;
    } catch (error) {
      return false;
    }
  }

  async saveLog(log: Log): Promise<Log> {
    return await this.logRepository.save(log);
  }
}
