import { Injectable } from '@nestjs/common';
import { User } from './user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, UpdateResult } from 'typeorm';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}

  async checkUserExists(email: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { email: email } });
    console.log('checkUserExists', user);
    return Boolean(user);
  }

  async findOne(email: string): Promise<User | undefined> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByEmail(email: string): Promise<User> {
    const result = await this.userRepository.findOne({
      where: {
        email: email,
      },
    });
    return result;
  }

  async findById(id: number): Promise<User> {
    return await this.userRepository.findOne({
      where: {
        id: id,
      },
    });
  }

  async create(user: User): Promise<User> {
    return await this.userRepository.save(user);
  }

  async save(user: User): Promise<User> {
    return await this.userRepository.save(user);
  }

  async update(contact: User): Promise<UpdateResult> {
    return await this.userRepository.update(contact.id, contact);
  }

  async getStatistic(): Promise<any> {
    return await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.logs', 'log')
      .where('user.id = :id', { id: 3 })
      .getOne();
  }

  async getUsers(): Promise<any> {
    return await this.userRepository.find({});
  }
}
