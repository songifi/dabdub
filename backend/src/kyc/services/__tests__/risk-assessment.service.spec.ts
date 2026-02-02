import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RiskAssessmentService, RiskAssessmentResult, RiskFactor } from '../risk-assessment.service';
import { KycVerification, KycVerificationType, RiskLevel } from '../../entities/kyc-verification.entity';
import { KycDocument } from '../../entities/kyc-document.entity';

describe('RiskAssessmentService', () => {
  let service: RiskAssessmentService;
  let configService: jest.Mocked<ConfigService>;

  const mockVerification: Partial<KycVerification> = {
    id: 'verification-id',
    merchantId: 'merchant-id',
    verificationType: KycVerificationType.INDIVIDUAL,
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: new Date('1990-01-01'),
    nationality: 'United States',
    country: 'United States',
    submittedAt: new Date(),
  };

  const mockDocument: Partial<KycDocument> = {
    id: 'document-id',
    kycVerificationId: 'verification-id',
    documentType: 'passport' as any,
    qualityRating: 'good' as any,
    isExpired: false,
    ocrConfidence: 95,
    isAuthentic: true,
  };

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskAssessmentService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RiskAssessmentService>(RiskAssessmentService);
    configService = module.get(ConfigService);
  });

  describe('assessRisk', () => {
    it('should assess low risk for clean verification', async () => {
      const result = await service.assessRisk(
        mockVerification as KycVerification,
        [mockDocument as KycDocument],
      );

      expect(result.riskLevel).toBe(RiskLevel.LOW);
      expect(result.riskScore).toBeLessThan(25);
      expect(result.requiresManualReview).toBe(false);
      expect(result.factors).toBeInstanceOf(Array);
      expect(result.recommendations).toBeInstanceOf(Array);
    });

    it('should assess high risk for high-risk country', async () => {
      const highRiskVerification = {
        ...mockVerification,
        country: 'Afghanistan',
        nationality: 'Afghanistan',
      };

      const result = await service.assessRisk(
        highRiskVerification as KycVerification,
        [mockDocument as KycDocument],
      );

      expect(result.riskLevel).toBeOneOf([RiskLevel.HIGH, RiskLevel.VERY_HIGH]);
      expect(result.requiresManualReview).toBe(true);
      expect(result.factors.some(f => f.category === 'geographic')).toBe(true);
    });

    it('should assess high risk for poor quality documents', async () => {
      const poorDocument = {
        ...mockDocument,
        qualityRating: 'poor',
        ocrConfidence: 30,
      };

      const result = await service.assessRisk(
        mockVerification as KycVerification,
        [poorDocument as KycDocument],
      );

      expect(result.riskScore).toBeGreaterThan(20);
      expect(result.factors.some(f => f.category === 'documents')).toBe(true);
    });

    it('should assess very high risk for expired documents', async () => {
      const expiredDocument = {
        ...mockDocument,
        isExpired: true,
      };

      const result = await service.assessRisk(
        mockVerification as KycVerification,
        [expiredDocument as KycDocument],
      );

      expect(result.riskScore).toBeGreaterThan(25);
      expect(result.factors.some(f => f.factor === 'expired_documents')).toBe(true);
    });

    it('should assess very high risk for inauthentic documents', async () => {
      const inauthenticDocument = {
        ...mockDocument,
        isAuthentic: false,
      };

      const result = await service.assessRisk(
        mockVerification as KycVerification,
        [inauthenticDocument as KycDocument],
      );

      expect(result.riskLevel).toBeOneOf([RiskLevel.HIGH, RiskLevel.VERY_HIGH]);
      expect(result.requiresManualReview).toBe(true);
      expect(result.factors.some(f => f.factor === 'inauthentic_documents')).toBe(true);
    });

    it('should assess high risk for minor applicant', async () => {
      const minorVerification = {
        ...mockVerification,
        dateOfBirth: new Date('2010-01-01'), // 14 years old
      };

      const result = await service.assessRisk(
        minorVerification as KycVerification,
        [mockDocument as KycDocument],
      );

      expect(result.requiresManualReview).toBe(true);
      expect(result.factors.some(f => f.factor === 'minor_applicant')).toBe(true);
    });

    it('should assess business risk for business verification', async () => {
      const businessVerification = {
        ...mockVerification,
        verificationType: KycVerificationType.BUSINESS,
        businessName: 'Test Business',
        businessRegistrationNumber: '123456789',
        businessType: 'cryptocurrency',
      };

      const result = await service.assessRisk(
        businessVerification as KycVerification,
        [mockDocument as KycDocument],
      );

      expect(result.factors.some(f => f.category === 'business')).toBe(true);
      expect(result.factors.some(f => f.factor === 'high_risk_business_type')).toBe(true);
    });

    it('should assess sanctions risk when sanctions result provided', async () => {
      const sanctionsResult = {
        success: false,
        confidence: 98,
      };

      const result = await service.assessRisk(
        mockVerification as KycVerification,
        [mockDocument as KycDocument],
        sanctionsResult,
      );

      expect(result.riskLevel).toBe(RiskLevel.VERY_HIGH);
      expect(result.requiresManualReview).toBe(true);
      expect(result.factors.some(f => f.factor === 'sanctions_match')).toBe(true);
    });

    it('should handle assessment errors gracefully', async () => {
      // Mock an error by passing invalid data
      const result = await service.assessRisk(
        null as any,
        [mockDocument as KycDocument],
      );

      expect(result.riskLevel).toBe(RiskLevel.HIGH);
      expect(result.riskScore).toBe(80);
      expect(result.requiresManualReview).toBe(true);
      expect(result.factors.some(f => f.factor === 'assessment_error')).toBe(true);
    });

    it('should assess behavioral risk for unusual submission time', async () => {
      const lateNightVerification = {
        ...mockVerification,
        submittedAt: new Date('2024-01-01T02:00:00Z'), // 2 AM
      };

      const result = await service.assessRisk(
        lateNightVerification as KycVerification,
        [mockDocument as KycDocument],
      );

      expect(result.factors.some(f => f.category === 'behavioral')).toBe(true);
    });

    it('should detect suspicious name patterns', async () => {
      const suspiciousVerification = {
        ...mockVerification,
        firstName: 'Test',
        lastName: 'User',
      };

      const result = await service.assessRisk(
        suspiciousVerification as KycVerification,
        [mockDocument as KycDocument],
      );

      expect(result.factors.some(f => f.factor === 'suspicious_name_pattern')).toBe(true);
    });

    it('should handle missing documents', async () => {
      const result = await service.assessRisk(
        mockVerification as KycVerification,
        [],
      );

      expect(result.riskLevel).toBeOneOf([RiskLevel.HIGH, RiskLevel.VERY_HIGH]);
      expect(result.factors.some(f => f.factor === 'no_documents')).toBe(true);
    });

    it('should generate appropriate recommendations', async () => {
      const highRiskVerification = {
        ...mockVerification,
        country: 'Iran',
      };

      const result = await service.assessRisk(
        highRiskVerification as KycVerification,
        [mockDocument as KycDocument],
      );

      expect(result.recommendations).toContain('Require manual review by compliance team');
      expect(result.recommendations).toContain('Verify source of funds and business purpose');
    });

    it('should calculate risk scores correctly', async () => {
      const multipleRiskVerification = {
        ...mockVerification,
        country: 'Afghanistan', // High risk country (+30)
        nationality: 'Afghanistan', // High risk nationality (+25)
      };

      const poorDocument = {
        ...mockDocument,
        qualityRating: 'poor', // Poor quality (+20)
        isExpired: true, // Expired (+25)
      };

      const result = await service.assessRisk(
        multipleRiskVerification as KycVerification,
        [poorDocument as KycDocument],
      );

      // Should be at least 100 (30+25+20+25)
      expect(result.riskScore).toBeGreaterThanOrEqual(100);
      expect(result.riskLevel).toBe(RiskLevel.VERY_HIGH);
    });
  });
});