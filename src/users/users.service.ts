import { Injectable } from '@nestjs/common';

export type User = {
  id: number;
  name: string;
  username: string;
  password: string;
};

@Injectable()
export class UsersService {
  private readonly users: User[] = [
    { id: 1, name: 'Guntur', username: 'guntur', password: 'password' },
    { id: 2, name: 'Dwi', username: 'dwi', password: 'password' },
    { id: 3, name: 'Arif', username: 'arif', password: 'password' },
  ];

  async findOne(username: string): Promise<User | undefined> {
    return this.users.find((user) => user.username === username);
  }
}
