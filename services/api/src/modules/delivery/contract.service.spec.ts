import { ContractService } from './contract.service';
import { EsignService } from './esign.service';
import { FileArtifactService } from '../file-artifact/file-artifact.service';

const mockDs = () => ({
  getRepository: jest.fn().mockReturnValue({
    findOneBy: jest.fn(),
    update: jest.fn(),
  }),
} as any);

const mockEsign = () => ({
  downloadSignedPdf: jest.fn(),
  verifyWebhookSignature: jest.fn().mockReturnValue(true),
} as any);

const mockFileArtifact = () => ({
  saveBase64: jest.fn().mockResolvedValue({
    success: true,
    data: { id: 'artifact-1', fileKey: 't1/delivery.contract/c1_signed.pdf' },
  }),
} as any);

describe('ContractService customer acceptance', () => {
  it('webhook handler should save signed PDF and create acceptance record', async () => {
    const ds = mockDs();
    const esign = mockEsign();
    const fileArtifact = mockFileArtifact();
    const svc = new ContractService(ds, esign, fileArtifact);

    ds.getRepository.mockImplementation((Entity: any) => {
      if (Entity.name === 'ContractEntity') {
        return {
          findOneBy: jest.fn().mockResolvedValue({
            id: 'c1', tenantId: 't1', dealerId: 'd1', customerId: 'cu1',
            contractNo: 'C2-T1-123', esignContractId: 'qys-1', status: 'sent',
          }),
          update: jest.fn().mockResolvedValue({}),
        };
      }
      if (Entity.name === 'DeliveryRecordEntity') {
        return {
          findOneBy: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockReturnValue({}),
          save: jest.fn().mockResolvedValue({ id: 'dr-1' }),
        };
      }
      return { findOneBy: jest.fn(), save: jest.fn() };
    });

    esign.downloadSignedPdf.mockResolvedValue('cGRmLWJ5dGVz');

    const rawBody = JSON.stringify({ type: 'CONTRACT_SIGN_FINISH', contractId: 'qys-1' });
    const result = await svc.handleWebhook(rawBody, 'sig');
    expect(result.ok).toBe(true);
    expect(fileArtifact.saveBase64).toHaveBeenCalled();
  });
});
