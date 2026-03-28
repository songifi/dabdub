import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum PasskeyDeviceType {
  SINGLE_DEVICE = 'singleDevice',
  MULTI_DEVICE = 'multiDevice',
}

@Entity('passkey_credentials')
@Index(['userId'])
@Index(['credentialId'], { unique: true })
export class PasskeyCredential extends BaseEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  /** Base64url-encoded credential identifier (unique per credential). */
  @Column({ name: 'credential_id', length: 512 })
  credentialId!: string;

  /** Raw public key bytes stored as bytea. */
  @Column({ name: 'public_key', type: 'bytea' })
  publicKey!: Buffer;

  /** Signature counter - used to detect cloned authenticators. */
  @Column({ name: 'counter', type: 'bigint' })
  counter!: number;

  /** Indicates if the credential is limited to a single device. */
  @Column({ name: 'device_type', type: 'enum', enum: PasskeyDeviceType })
  deviceType!: PasskeyDeviceType;

  /** Whether the credential is backed up (synced across devices). */
  @Column({ name: 'backed_up', type: 'boolean', default: false })
  backedUp!: boolean;

  /** Supported authenticator transports (e.g., 'internal', 'usb', 'nfc', 'ble'). */
  @Column({ name: 'transports', type: 'text', array: true, nullable: true })
  transports!: string[] | null;

  /** Optional user-friendly nickname for the credential. */
  @Column({ name: 'nickname', type: 'varchar', length: 255, nullable: true })
  nickname!: string | null;
}
