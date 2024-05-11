import { User } from 'src/users/user.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';

@Entity()
export class EmailVerification {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  @Column('int')
  token: number;

  @Column()
  timestamp: Date;

  @Column({ nullable: true })
  emailToken: number;

  @Column({ nullable: true })
  email: string;
}
