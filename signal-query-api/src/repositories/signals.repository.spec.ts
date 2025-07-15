import { BadRequestException } from '@nestjs/common';
import { SignalsRepository } from './signals.repository';
import { Pool } from 'pg';

describe('SignalsRepository', () => {
  let repo: SignalsRepository;
  let pool: jest.Mocked<Pool>;

  beforeEach(() => {
    pool = {
      query: jest.fn(),
    } as any;
    repo = new SignalsRepository(pool);
  });

  describe('listCryptoNames', () => {
    it('should return crypto asset names', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ name: 'BTC' }, { name: 'ETH' }],
      });

      const result = await repo.listCryptoNames();

      expect(pool.query).toHaveBeenCalledWith(expect.any(String));
      expect(result).toEqual([{ name: 'BTC' }, { name: 'ETH' }]);
    });
  });

  describe('getOhlcData', () => {
    it('should return parsed OHLC data', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { open: '1', high: '2', low: '0.5', close: '1.5', volume: '1000' },
        ],
      });

      const result = await repo.getOhlcData('BTC', {
        interval: '1h',
        limit: 1,
      });

      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
        'BTC',
        '1h',
        1,
      ]);

      expect(result).toEqual([
        { open: 1, high: 2, low: 0.5, close: 1.5, volume: 1000 },
      ]);
    });

    it('should throw BadRequestException on invalid interval error', async () => {
      (pool.query as jest.Mock).mockRejectedValueOnce(
        new Error('Invalid interval'),
      );

      await expect(repo.getOhlcData('BTC', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should rethrow other errors', async () => {
      (pool.query as jest.Mock).mockRejectedValueOnce(
        new Error('Database error'),
      );

      await expect(repo.getOhlcData('BTC', {})).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('getLatestIndicators', () => {
    it('should return indicators filtered by names', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ name: 'SMA', value: '123.45' }],
      } as any);

      const result = await repo.getLatestIndicators(['SMA']);

      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('ANY'), [
        ['SMA'],
      ]);
      expect(result).toEqual([{ name: 'SMA', value: 123.45 }]);
    });

    it('should return all indicators if names not provided', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ name: 'SMA', value: '123.45' }],
      });

      const result = await repo.getLatestIndicators();

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('get_latest_indicators();'),
      );
      expect(result).toEqual([{ name: 'SMA', value: 123.45 }]);
    });
  });
});
