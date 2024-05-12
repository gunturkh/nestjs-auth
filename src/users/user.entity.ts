//user.entity.ts
import {
  BaseEntity,
  PrimaryGeneratedColumn,
  Entity,
  Column,
  Unique,
  BeforeInsert,
  OneToMany,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { Log } from 'src/auth/log.entity';

@Entity()
@Unique(['email'])
export class User extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255, default: 'New User' })
  name: string;

  @Column({ length: 255 })
  @IsEmail()
  email: string;

  @BeforeInsert()
  hashPassword() {
    this.password = bcrypt.hashSync(this.password, bcrypt.genSaltSync(8), null);
  }
  @Column()
  @IsNotEmpty()
  password: string;

  @Column({
    default: new Date().toISOString().slice(0, 19).replace('T', ' '),
  })
  created_time: Date;

  @Column({
    default: new Date().toISOString().slice(0, 19).replace('T', ' '),
  })
  updated_time: Date;

  @Column({
    default: new Date().toISOString().slice(0, 19).replace('T', ' '),
  })
  logout_time: Date;

  @Column({ default: 0 })
  login_count: number;

  @Column({ default: false })
  is_verified: boolean;

  @OneToMany(() => Log, (log) => log.user)
  logs: Log[];
}
