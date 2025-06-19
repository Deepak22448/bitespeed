import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Contact {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  linkedId?: number;

  @Column({ type: 'enum', enum: ['primary', 'secondary'] })
  linkPrecedence: 'primary' | 'secondary';

  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  deletedAt?: Date;
}
