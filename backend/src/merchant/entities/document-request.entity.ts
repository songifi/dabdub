import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../database/entities/base.entity';
import { Merchant } from '../../database/entities/merchant.entity';
import { DocumentType } from '../enums/merchant-document.enums';

@Entity('merchant_document_requests')
@Index(['merchantId'])
@Index(['documentType'])
@Index(['status'])
export class DocumentRequest extends BaseEntity {
  @Column({ name: 'merchant_id' })
  merchantId: string;

  @Column({
    name: 'document_type',
    type: 'enum',
    enum: DocumentType,
  })
  documentType: DocumentType;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'deadline', type: 'timestamptz', nullable: true })
  deadline: Date | null;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'FULFILLED', 'CANCELLED'],
    default: 'PENDING',
  })
  status: string;

  @ManyToOne(() => Merchant, (merchant) => merchant.documentRequests)
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;
}
