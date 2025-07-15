import { NotFoundException } from '@nestjs/common';
import { SignalsService } from './signals.service';
import { SignalsRepository } from '../repositories/signals.repository';

describe('SignalsService', () => {
  let service: SignalsService;
  let repo: jest.Mocked<SignalsRepository>;

  beforeEach(() => {
    repo = {
      listCryptoNames: jest.fn(),
      getOhlcData: jest.fn(),
      getLatestIndicators: jest.fn(),
    } as any;

    service = new SignalsService(repo);
  });

  describe('listAssetNames', () => {
    it('should return list of asset names', async () => {
      const mockAssets = [{ name: 'BTC' }, { name: 'ETH' }];
      repo.listCryptoNames.mockResolvedValueOnce(mockAssets);

      const result = await service.listAssetNames();

      expect(result).toEqual(mockAssets);
      expect(repo.listCryptoNames).toHaveBeenCalled();
    });
  });

  describe('getOhlcData', () => {
    it('should return OHLC data if found', async () => {
      const mockData = [{ open: 1, high: 2, low: 0.5, close: 1.5 }];
      repo.getOhlcData.mockResolvedValueOnce(mockData as any);

      const result = await service.getOhlcData('BTC', {
        interval: '1h',
        limit: 1,
      });

      expect(result).toEqual(mockData);
      expect(repo.getOhlcData).toHaveBeenCalledWith('BTC', {
        interval: '1h',
        limit: 1,
      });
    });

    it('should throw NotFoundException if no OHLC data is found', async () => {
      repo.getOhlcData.mockResolvedValueOnce([]);

      await expect(service.getOhlcData('BTC', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getLatestIndicators', () => {
    it('should return indicators mapped by name', async () => {
      const mockIndicators = [
        { name: 'SMA', value: 100 },
        { name: 'EMA', value: 200 },
      ];
      repo.getLatestIndicators.mockResolvedValueOnce(mockIndicators as any);

      const result = await service.getLatestIndicators(['SMA', 'EMA']);

      expect(result).toEqual({
        SMA: { name: 'SMA', value: 100 },
        EMA: { name: 'EMA', value: 200 },
      });
      expect(repo.getLatestIndicators).toHaveBeenCalledWith(['SMA', 'EMA']);
    });
  });
});
