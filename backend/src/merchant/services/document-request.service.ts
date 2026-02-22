import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentRequest } from '../entities/document-request.entity';
import { DocumentType } from '../enums/merchant-document.enums';
import { NotificationService } from '../../notification/notification.service';

@Injectable()
export class DocumentRequestService {
  private readonly logger = new Logger(DocumentRequestService.name);

  constructor(
    @InjectRepository(DocumentRequest)
    private readonly requestRepository: Repository<DocumentRequest>,
    private readonly notificationService: NotificationService,
  ) {}

  async createRequest(merchantId: string, documentType: DocumentType, message: string, deadline?: string) {
    const request = this.requestRepository.create({
      merchantId,
      documentType,
      message,
      deadline: deadline ? new Date(deadline) : null,
      status: 'PENDING',
    });

    await this.requestRepository.save(request);

    // Notify merchant
    await this.notificationService.sendNotification({
        userId: merchantId,
        type: 'KYC_DOCUMENT_REQUESTED',
        payload: {
          documentType,
          message,
          deadline,
        },
    });

    return request;
  }

  async listRequests(merchantId: string) {
    return this.requestRepository.find({
      where: { merchantId },
      order: { createdAt: 'DESC' },
    });
  }
}
