import { Test, TestingModule } from '@nestjs/testing';
import { NodemailerService } from './nodemailer.service';
import { emailConfig } from '../config/email.config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';

jest.mock('nodemailer');
jest.mock('fs');

const mockSendMail = jest.fn();
const mockCfg = {
  host: 'smtp.sendgrid.net',
  port: 587,
  secure: false,
  user: 'apikey',
  pass: 'SG.test',
  from: 'noreply@cheesepay.xyz',
  fromName: 'CheesePay',
};

const LAYOUT = `<!DOCTYPE html><html><body>{{{body}}}</body></html>`;
const HTML_BODY = `<p>Hi {{merchantName}}, ref {{reference}}</p>`;
const TEXT_BODY = `Hi {{merchantName}}, ref {{reference}}`;

describe('NodemailerService', () => {
  let service: NodemailerService;

  beforeEach(async () => {
    jest.clearAllMocks();

    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: mockSendMail,
    });

    // Map readFileSync calls to the right fixture content
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
      if (String(filePath).endsWith('layout.hbs')) return LAYOUT;
      if (String(filePath).endsWith('.html.hbs')) return HTML_BODY;
      if (String(filePath).endsWith('.text.hbs')) return TEXT_BODY;
      throw new Error(`Unexpected readFileSync: ${filePath}`);
    });
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NodemailerService,
        { provide: emailConfig.KEY, useValue: mockCfg },
      ],
    }).compile();

    service = module.get(NodemailerService);
    service.onModuleInit();
  });

  it('creates transporter with config values on init', () => {
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: mockCfg.host,
      port: mockCfg.port,
      secure: mockCfg.secure,
      auth: { user: mockCfg.user, pass: mockCfg.pass },
    });
  });

  it('send() calls sendMail with rendered html, text, and resolved subject', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg-xyz' });

    const result = await service.send('merchant@example.com', 'payment-confirmed', {
      merchantName: 'Acme',
      reference: 'REF-001',
      amount: '100',
      currency: 'USDC',
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'merchant@example.com',
        subject: 'Payment Confirmed',
        html: expect.stringContaining('Acme'),
        text: expect.stringContaining('REF-001'),
      }),
    );
    expect(result).toEqual({ messageId: 'msg-xyz' });
  });

  it('send() uses mergeData.subject when provided', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg-custom' });

    await service.send('m@example.com', 'welcome', {
      merchantName: 'Bob',
      subject: 'Custom Subject',
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Custom Subject' }),
    );
  });

  it('send() throws when template file is missing', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    await expect(
      service.send('m@example.com', 'nonexistent-template', {}),
    ).rejects.toThrow('Email template not found');
  });

  it('send() propagates SMTP errors', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP auth failed'));

    await expect(
      service.send('m@example.com', 'welcome', { merchantName: 'Alice' }),
    ).rejects.toThrow('SMTP auth failed');
  });
});
