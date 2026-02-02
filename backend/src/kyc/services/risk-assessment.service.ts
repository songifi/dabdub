import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KycVerification, RiskLevel } from '../entities/kyc-verification.entity';
import { KycDocument } from '../entities/kyc-document.entity';

export interface RiskAssessmentResult {
  riskLevel: RiskLevel;
  riskScore: number;
  factors: RiskFactor[];
  recommendations: string[];
  requiresManualReview: boolean;
}

export interface RiskFactor {
  category: string;
  factor: string;
  impact: 'low' | 'medium' | 'high';
  score: number;
  description: string;
}

@Injectable()
export class RiskAssessmentService {
  private readonly logger = new Logger(RiskAssessmentService.name);

  constructor(private readonly configService: ConfigService) {}

  async assessRisk(
    verification: KycVerification,
    documents: KycDocument[],
    sanctionsResult?: any,
    businessVerificationResult?: any,
  ): Promise<RiskAssessmentResult> {
    try {
      const factors: RiskFactor[] = [];
      let totalScore = 0;

      // Geographic risk assessment
      const geoRisk = this.assessGeographicRisk(verification);
      factors.push(...geoRisk.factors);
      totalScore += geoRisk.score;

      // Document quality risk assessment
      const docRisk = this.assessDocumentRisk(documents);
      factors.push(...docRisk.factors);
      totalScore += docRisk.score;

      // Identity verification risk assessment
      const identityRisk = this.assessIdentityRisk(verification);
      factors.push(...identityRisk.factors);
      totalScore += identityRisk.score;

      // Business risk assessment (if applicable)
      if (verification.verificationType === 'business') {
        const businessRisk = this.assessBusinessRisk(verification, businessVerificationResult);
        factors.push(...businessRisk.factors);
        totalScore += businessRisk.score;
      }

      // Sanctions risk assessment
      if (sanctionsResult) {
        const sanctionsRisk = this.assessSanctionsRisk(sanctionsResult);
        factors.push(...sanctionsRisk.factors);
        totalScore += sanctionsRisk.score;
      }

      // Behavioral risk assessment
      const behavioralRisk = this.assessBehavioralRisk(verification);
      factors.push(...behavioralRisk.factors);
      totalScore += behavioralRisk.score;

      // Calculate final risk level and score
      const riskLevel = this.calculateRiskLevel(totalScore);
      const requiresManualReview = this.requiresManualReview(riskLevel, factors);
      const recommendations = this.generateRecommendations(riskLevel, factors);

      this.logger.log(
        `Risk assessment completed for verification ${verification.id}: ${riskLevel} (${totalScore})`,
      );

      return {
        riskLevel,
        riskScore: Math.min(100, Math.max(0, totalScore)),
        factors,
        recommendations,
        requiresManualReview,
      };
    } catch (error) {
      this.logger.error(`Risk assessment failed: ${error.message}`, error.stack);
      
      // Return high risk as fallback
      return {
        riskLevel: RiskLevel.HIGH,
        riskScore: 80,
        factors: [{
          category: 'system',
          factor: 'assessment_error',
          impact: 'high',
          score: 80,
          description: 'Risk assessment failed, manual review required',
        }],
        recommendations: ['Manual review required due to assessment error'],
        requiresManualReview: true,
      };
    }
  }

  private assessGeographicRisk(verification: KycVerification): { factors: RiskFactor[]; score: number } {
    const factors: RiskFactor[] = [];
    let score = 0;

    // High-risk countries (simplified list)
    const highRiskCountries = [
      'Afghanistan', 'Iran', 'North Korea', 'Syria', 'Yemen',
      'Somalia', 'Libya', 'Iraq', 'Sudan', 'Venezuela',
    ];

    // Medium-risk countries
    const mediumRiskCountries = [
      'Russia', 'China', 'Pakistan', 'Nigeria', 'Myanmar',
      'Belarus', 'Cuba', 'Lebanon', 'Turkey',
    ];

    const country = verification.country || verification.businessCountry;
    const nationality = verification.nationality;

    if (country && highRiskCountries.includes(country)) {
      factors.push({
        category: 'geographic',
        factor: 'high_risk_country',
        impact: 'high',
        score: 30,
        description: `Country ${country} is classified as high-risk`,
      });
      score += 30;
    } else if (country && mediumRiskCountries.includes(country)) {
      factors.push({
        category: 'geographic',
        factor: 'medium_risk_country',
        impact: 'medium',
        score: 15,
        description: `Country ${country} is classified as medium-risk`,
      });
      score += 15;
    }

    if (nationality && highRiskCountries.includes(nationality)) {
      factors.push({
        category: 'geographic',
        factor: 'high_risk_nationality',
        impact: 'high',
        score: 25,
        description: `Nationality ${nationality} is classified as high-risk`,
      });
      score += 25;
    }

    // Check for country mismatch
    if (country && nationality && country !== nationality) {
      factors.push({
        category: 'geographic',
        factor: 'country_nationality_mismatch',
        impact: 'low',
        score: 5,
        description: 'Country of residence differs from nationality',
      });
      score += 5;
    }

    return { factors, score };
  }

  private assessDocumentRisk(documents: KycDocument[]): { factors: RiskFactor[]; score: number } {
    const factors: RiskFactor[] = [];
    let score = 0;

    if (documents.length === 0) {
      factors.push({
        category: 'documents',
        factor: 'no_documents',
        impact: 'high',
        score: 50,
        description: 'No documents uploaded',
      });
      return { factors, score: 50 };
    }

    // Check document quality
    const poorQualityDocs = documents.filter(doc => doc.qualityRating === 'poor');
    if (poorQualityDocs.length > 0) {
      factors.push({
        category: 'documents',
        factor: 'poor_quality_documents',
        impact: 'medium',
        score: 20,
        description: `${poorQualityDocs.length} document(s) have poor quality`,
      });
      score += 20;
    }

    // Check for expired documents
    const expiredDocs = documents.filter(doc => doc.isExpired);
    if (expiredDocs.length > 0) {
      factors.push({
        category: 'documents',
        factor: 'expired_documents',
        impact: 'high',
        score: 25,
        description: `${expiredDocs.length} document(s) are expired`,
      });
      score += 25;
    }

    // Check OCR confidence
    const lowConfidenceDocs = documents.filter(doc => doc.ocrConfidence && doc.ocrConfidence < 70);
    if (lowConfidenceDocs.length > 0) {
      factors.push({
        category: 'documents',
        factor: 'low_ocr_confidence',
        impact: 'medium',
        score: 15,
        description: `${lowConfidenceDocs.length} document(s) have low OCR confidence`,
      });
      score += 15;
    }

    // Check for document authenticity issues
    const inauthenticDocs = documents.filter(doc => doc.isAuthentic === false);
    if (inauthenticDocs.length > 0) {
      factors.push({
        category: 'documents',
        factor: 'inauthentic_documents',
        impact: 'high',
        score: 40,
        description: `${inauthenticDocs.length} document(s) failed authenticity check`,
      });
      score += 40;
    }

    return { factors, score };
  }

  private assessIdentityRisk(verification: KycVerification): { factors: RiskFactor[]; score: number } {
    const factors: RiskFactor[] = [];
    let score = 0;

    // Check for missing personal information
    const requiredFields = ['firstName', 'lastName', 'dateOfBirth'];
    const missingFields = requiredFields.filter(field => !verification[field]);
    
    if (missingFields.length > 0) {
      factors.push({
        category: 'identity',
        factor: 'incomplete_personal_info',
        impact: 'medium',
        score: 10,
        description: `Missing personal information: ${missingFields.join(', ')}`,
      });
      score += 10;
    }

    // Check age (minors require special handling)
    if (verification.dateOfBirth) {
      const age = this.calculateAge(verification.dateOfBirth);
      if (age < 18) {
        factors.push({
          category: 'identity',
          factor: 'minor_applicant',
          impact: 'high',
          score: 30,
          description: 'Applicant is under 18 years old',
        });
        score += 30;
      } else if (age > 100) {
        factors.push({
          category: 'identity',
          factor: 'unusual_age',
          impact: 'medium',
          score: 15,
          description: 'Applicant age appears unusual',
        });
        score += 15;
      }
    }

    // Check for common fraud patterns in names
    if (this.hasCommonFraudPatterns(verification.firstName, verification.lastName)) {
      factors.push({
        category: 'identity',
        factor: 'suspicious_name_pattern',
        impact: 'medium',
        score: 20,
        description: 'Name contains patterns commonly associated with fraud',
      });
      score += 20;
    }

    return { factors, score };
  }

  private assessBusinessRisk(
    verification: KycVerification,
    businessVerificationResult?: any,
  ): { factors: RiskFactor[]; score: number } {
    const factors: RiskFactor[] = [];
    let score = 0;

    // Check for missing business information
    if (!verification.businessName || !verification.businessRegistrationNumber) {
      factors.push({
        category: 'business',
        factor: 'incomplete_business_info',
        impact: 'high',
        score: 25,
        description: 'Missing required business information',
      });
      score += 25;
    }

    // Check business verification result
    if (businessVerificationResult && !businessVerificationResult.success) {
      factors.push({
        category: 'business',
        factor: 'business_verification_failed',
        impact: 'high',
        score: 35,
        description: 'Business could not be verified in official registries',
      });
      score += 35;
    }

    // Check for high-risk business types
    const highRiskBusinessTypes = [
      'money_service_business',
      'cryptocurrency',
      'gambling',
      'adult_entertainment',
      'weapons',
      'tobacco',
    ];

    if (verification.businessType && 
        highRiskBusinessTypes.some(type => 
          verification.businessType.toLowerCase().includes(type))) {
      factors.push({
        category: 'business',
        factor: 'high_risk_business_type',
        impact: 'high',
        score: 30,
        description: `Business type ${verification.businessType} is high-risk`,
      });
      score += 30;
    }

    return { factors, score };
  }

  private assessSanctionsRisk(sanctionsResult: any): { factors: RiskFactor[]; score: number } {
    const factors: RiskFactor[] = [];
    let score = 0;

    if (!sanctionsResult.success) {
      factors.push({
        category: 'sanctions',
        factor: 'sanctions_match',
        impact: 'high',
        score: 100,
        description: 'Individual or entity found on sanctions lists',
      });
      score += 100;
    } else if (sanctionsResult.confidence < 95) {
      factors.push({
        category: 'sanctions',
        factor: 'sanctions_check_uncertainty',
        impact: 'medium',
        score: 15,
        description: 'Sanctions check completed with lower confidence',
      });
      score += 15;
    }

    return { factors, score };
  }

  private assessBehavioralRisk(verification: KycVerification): { factors: RiskFactor[]; score: number } {
    const factors: RiskFactor[] = [];
    let score = 0;

    // Check submission timing patterns
    const now = new Date();
    const submissionHour = verification.submittedAt?.getHours();
    
    if (submissionHour !== undefined && (submissionHour < 6 || submissionHour > 22)) {
      factors.push({
        category: 'behavioral',
        factor: 'unusual_submission_time',
        impact: 'low',
        score: 5,
        description: 'Verification submitted during unusual hours',
      });
      score += 5;
    }

    // Check for rapid resubmissions (would require additional data)
    // This would check if the same person has submitted multiple verifications recently

    return { factors, score };
  }

  private calculateRiskLevel(totalScore: number): RiskLevel {
    if (totalScore >= 70) return RiskLevel.VERY_HIGH;
    if (totalScore >= 50) return RiskLevel.HIGH;
    if (totalScore >= 25) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  private requiresManualReview(riskLevel: RiskLevel, factors: RiskFactor[]): boolean {
    // Always require manual review for very high risk
    if (riskLevel === RiskLevel.VERY_HIGH) return true;

    // Require manual review for high risk
    if (riskLevel === RiskLevel.HIGH) return true;

    // Check for specific factors that always require manual review
    const alwaysManualFactors = [
      'sanctions_match',
      'inauthentic_documents',
      'business_verification_failed',
      'minor_applicant',
    ];

    return factors.some(factor => alwaysManualFactors.includes(factor.factor));
  }

  private generateRecommendations(riskLevel: RiskLevel, factors: RiskFactor[]): string[] {
    const recommendations: string[] = [];

    if (riskLevel === RiskLevel.VERY_HIGH || riskLevel === RiskLevel.HIGH) {
      recommendations.push('Require manual review by compliance team');
      recommendations.push('Consider enhanced due diligence procedures');
    }

    // Specific recommendations based on risk factors
    factors.forEach(factor => {
      switch (factor.factor) {
        case 'high_risk_country':
        case 'high_risk_nationality':
          recommendations.push('Verify source of funds and business purpose');
          break;
        case 'poor_quality_documents':
          recommendations.push('Request higher quality document images');
          break;
        case 'expired_documents':
          recommendations.push('Request current, valid documents');
          break;
        case 'business_verification_failed':
          recommendations.push('Request additional business documentation');
          break;
        case 'sanctions_match':
          recommendations.push('Immediately escalate to compliance team');
          recommendations.push('Do not approve until sanctions cleared');
          break;
        case 'minor_applicant':
          recommendations.push('Verify parental consent and guardian information');
          break;
      }
    });

    // Remove duplicates
    return [...new Set(recommendations)];
  }

  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  private hasCommonFraudPatterns(firstName?: string, lastName?: string): boolean {
    if (!firstName || !lastName) return false;

    const fullName = `${firstName} ${lastName}`.toLowerCase();
    
    // Common fraud patterns
    const fraudPatterns = [
      /test\s*user/,
      /fake\s*name/,
      /john\s*doe/,
      /jane\s*doe/,
      /admin/,
      /null/,
      /undefined/,
      /\d{3,}/, // Names with many numbers
    ];

    return fraudPatterns.some(pattern => pattern.test(fullName));
  }
}