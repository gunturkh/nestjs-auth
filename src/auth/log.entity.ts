import { User } from 'src/users/user.entity';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';

export enum EventType {
  LOGIN = 'login',
  LOGOUT = 'logout',
}
@Entity()
export class Log {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.logs)
  user: User;

  @Column({
    type: 'enum',
    enum: EventType,
    default: EventType.LOGIN,
  })
  type: EventType;

  @Column()
  timestamp: Date;
}
