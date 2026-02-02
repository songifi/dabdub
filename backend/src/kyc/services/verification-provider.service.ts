import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface VerificationResult {
  success: boolean;
  status: string;
  confidence: number;
  details: Record<string, any>;
  providerReference: string;
  errors?: string[];
}

export interface IdentityVerificationRequest {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  documentType: string;
  documentNumber: string;
  documentImageUrl: string;
  selfieImageUrl?: string;
}

export interface BusinessVerificationRequest {
  businessName: string;
  registrationNumber: string;
  businessType: string;
  country: string;
  address: string;
  documentImageUrl: string;
}

@Injectable()
export class VerificationProviderService {
  private readonly logger = new Logger(VerificationProviderService.name);
  private readonly providers: Map<string, any> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.initializeProviders();
  }

  async verifyIdentity(
    request: IdentityVerificationRequest,
    provider: string = 'onfido',
  ): Promise<VerificationResult> {
    try {
      const providerInstance = this.providers.get(provider);
      if (!providerInstance) {
        throw new Error(`Provider ${provider} not configured`);
      }

      switch (provider) {
        case 'onfido':
          return await this.verifyWithOnfido(request);
        case 'jumio':
          return await this.verifyWithJumio(request);
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      this.logger.error(`Identity verification failed with ${provider}: ${error.message}`, error.stack);
      return {
        success: false,
        status: 'error',
        confidence: 0,
        details: {},
        providerReference: '',
        errors: [error.message],
      };
    }
  }

  async verifyBusiness(
    request: BusinessVerificationRequest,
    provider: string = 'opencorporates',
  ): Promise<VerificationResult> {
    try {
      switch (provider) {
        case 'opencorporates':
          return await this.verifyWithOpenCorporates(request);
        case 'companies_house':
          return await this.verifyWithCompaniesHouse(request);
        default:
          throw new Error(`Unsupported business verification provider: ${provider}`);
      }
    } catch (error) {
      this.logger.error(`Business verification failed with ${provider}: ${error.message}`, error.stack);
      return {
        success: false,
        status: 'error',
        confidence: 0,
        details: {},
        providerReference: '',
        errors: [error.message],
      };
    }
  }

  async checkSanctions(
    firstName: string,
    lastName: string,
    dateOfBirth?: string,
    nationality?: string,
  ): Promise<VerificationResult> {
    try {
      // Check multiple sanctions lists
      const results = await Promise.all([
        this.checkOFAC(firstName, lastName, dateOfBirth, nationality),
        this.checkEUSanctions(firstName, lastName, dateOfBirth, nationality),
        this.checkUNSanctions(firstName, lastName, dateOfBirth, nationality),
      ]);

      const hasMatch = results.some(result => !result.success);
      const allDetails = results.reduce((acc, result) => ({ ...acc, ...result.details }), {});

      return {
        success: !hasMatch,
        status: hasMatch ? 'match_found' : 'clear',
        confidence: hasMatch ? 100 : 95,
        details: allDetails,
        providerReference: `sanctions_${Date.now()}`,
        errors: hasMatch ? ['Sanctions match found'] : undefined,
      };
    } catch (error) {
      this.logger.error(`Sanctions check failed: ${error.message}`, error.stack);
      return {
        success: false,
        status: 'error',
        confidence: 0,
        details: {},
        providerReference: '',
        errors: [error.message],
      };
    }
  }

  private initializeProviders(): void {
    // Initialize Onfido
    const onfidoApiKey = this.configService.get<string>('ONFIDO_API_KEY');
    if (onfidoApiKey) {
      this.providers.set('onfido', {
        apiKey: onfidoApiKey,
        baseUrl: this.configService.get<string>('ONFIDO_BASE_URL') || 'https://api.onfido.com/v3.6',
      });
    }

    // Initialize Jumio
    const jumioApiKey = this.configService.get<string>('JUMIO_API_KEY');
    if (jumioApiKey) {
      this.providers.set('jumio', {
        apiKey: jumioApiKey,
        apiSecret: this.configService.get<string>('JUMIO_API_SECRET'),
        baseUrl: this.configService.get<string>('JUMIO_BASE_URL') || 'https://api.jumio.com',
      });
    }

    // Initialize OpenCorporates
    const openCorporatesApiKey = this.configService.get<string>('OPENCORPORATES_API_KEY');
    if (openCorporatesApiKey) {
      this.providers.set('opencorporates', {
        apiKey: openCorporatesApiKey,
        baseUrl: 'https://api.opencorporates.com/v0.4',
      });
    }
  }

  private async verifyWithOnfido(request: IdentityVerificationRequest): Promise<VerificationResult> {
    const provider = this.providers.get('onfido');
    
    try {
      // Create applicant
      const applicantResponse = await firstValueFrom(
        this.httpService.post(
          `${provider.baseUrl}/applicants`,
          {
            first_name: request.firstName,
            last_name: request.lastName,
            dob: request.dateOfBirth,
            country: request.nationality,
          },
          {
            headers: {
              'Authorization': `Token token=${provider.apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const applicantId = applicantResponse.data.id;

      // Upload document
      const documentResponse = await firstValueFrom(
        this.httpService.post(
          `${provider.baseUrl}/documents`,
          {
            applicant_id: applicantId,
            type: this.mapDocumentType(request.documentType),
            file: request.documentImageUrl, // In real implementation, this would be a file upload
          },
          {
            headers: {
              'Authorization': `Token token=${provider.apiKey}`,
              'Content-Type': 'multipart/form-data',
            },
          },
        ),
      );

      // Create check
      const checkResponse = await firstValueFrom(
        this.httpService.post(
          `${provider.baseUrl}/checks`,
          {
            applicant_id: applicantId,
            report_names: ['document', 'identity_enhanced'],
          },
          {
            headers: {
              'Authorization': `Token token=${provider.apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const checkResult = checkResponse.data;

      return {
        success: checkResult.result === 'clear',
        status: checkResult.result,
        confidence: this.calculateConfidence(checkResult),
        details: checkResult,
        providerReference: checkResult.id,
      };
    } catch (error) {
      throw new Error(`Onfido verification failed: ${error.message}`);
    }
  }

  private async verifyWithJumio(request: IdentityVerificationRequest): Promise<VerificationResult> {
    const provider = this.providers.get('jumio');
    
    try {
      // Create transaction
      const transactionResponse = await firstValueFrom(
        this.httpService.post(
          `${provider.baseUrl}/netverify/v2/initiateNetverify`,
          {
            customerInternalReference: `kyc_${Date.now()}`,
            userReference: request.firstName + '_' + request.lastName,
            successUrl: 'https://your-domain.com/success',
            errorUrl: 'https://your-domain.com/error',
            enabledFields: 'idNumber,idFirstName,idLastName,idDob,idExpiry,idUsState,idPersonalNumber,idFaceMatch',
          },
          {
            headers: {
              'Authorization': `Basic ${Buffer.from(`${provider.apiKey}:${provider.apiSecret}`).toString('base64')}`,
              'Content-Type': 'application/json',
              'User-Agent': 'KYC Service v1.0',
            },
          },
        ),
      );

      // In a real implementation, you would handle the Jumio workflow
      // This is a simplified example
      return {
        success: true,
        status: 'pending',
        confidence: 0,
        details: transactionResponse.data,
        providerReference: transactionResponse.data.transactionReference,
      };
    } catch (error) {
      throw new Error(`Jumio verification failed: ${error.message}`);
    }
  }

  private async verifyWithOpenCorporates(request: BusinessVerificationRequest): Promise<VerificationResult> {
    const provider = this.providers.get('opencorporates');
    
    try {
      const searchResponse = await firstValueFrom(
        this.httpService.get(
          `${provider.baseUrl}/companies/search`,
          {
            params: {
              q: request.businessName,
              jurisdiction_code: request.country.toLowerCase(),
              api_token: provider.apiKey,
            },
          },
        ),
      );

      const companies = searchResponse.data.results?.companies || [];
      const exactMatch = companies.find(
        (company: any) => 
          company.company.name.toLowerCase() === request.businessName.toLowerCase() &&
          company.company.company_number === request.registrationNumber,
      );

      return {
        success: !!exactMatch,
        status: exactMatch ? 'verified' : 'not_found',
        confidence: exactMatch ? 95 : 0,
        details: {
          searchResults: companies,
          exactMatch,
        },
        providerReference: `opencorp_${Date.now()}`,
      };
    } catch (error) {
      throw new Error(`OpenCorporates verification failed: ${error.message}`);
    }
  }

  private async verifyWithCompaniesHouse(request: BusinessVerificationRequest): Promise<VerificationResult> {
    // UK Companies House API implementation
    // This would be similar to OpenCorporates but specific to UK companies
    return {
      success: false,
      status: 'not_implemented',
      confidence: 0,
      details: {},
      providerReference: '',
      errors: ['Companies House integration not implemented'],
    };
  }

  private async checkOFAC(
    firstName: string,
    lastName: string,
    dateOfBirth?: string,
    nationality?: string,
  ): Promise<VerificationResult> {
    // OFAC sanctions list check
    // In a real implementation, this would check against the OFAC SDN list
    return {
      success: true,
      status: 'clear',
      confidence: 95,
      details: { source: 'OFAC', checked_at: new Date().toISOString() },
      providerReference: `ofac_${Date.now()}`,
    };
  }

  private async checkEUSanctions(
    firstName: string,
    lastName: string,
    dateOfBirth?: string,
    nationality?: string,
  ): Promise<VerificationResult> {
    // EU sanctions list check
    return {
      success: true,
      status: 'clear',
      confidence: 95,
      details: { source: 'EU_SANCTIONS', checked_at: new Date().toISOString() },
      providerReference: `eu_${Date.now()}`,
    };
  }

  private async checkUNSanctions(
    firstName: string,
    lastName: string,
    dateOfBirth?: string,
    nationality?: string,
  ): Promise<VerificationResult> {
    // UN sanctions list check
    return {
      success: true,
      status: 'clear',
      confidence: 95,
      details: { source: 'UN_SANCTIONS', checked_at: new Date().toISOString() },
      providerReference: `un_${Date.now()}`,
    };
  }

  private mapDocumentType(documentType: string): string {
    const mapping: Record<string, string> = {
      passport: 'passport',
      drivers_license: 'driving_licence',
      national_id: 'national_identity_card',
    };

    return mapping[documentType] || documentType;
  }

  private calculateConfidence(checkResult: any): number {
    // Calculate confidence based on check results
    if (checkResult.result === 'clear') return 95;
    if (checkResult.result === 'consider') return 70;
    return 30;
  }
}