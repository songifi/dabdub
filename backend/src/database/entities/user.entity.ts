import { Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Minimal `users` row for blockchain wallet FK (see migrations). */
@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
}
