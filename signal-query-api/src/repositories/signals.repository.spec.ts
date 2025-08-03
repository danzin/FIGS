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

  describe('getMetricChange', () => {
    it('should return current and previous metric values as numbers', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ value: '123.45' }] }) // today
        .mockResolvedValueOnce({ rows: [{ value: '120.00' }] }); // yesterday

      const result = await repo.getMetricChange('bitcoin_dominance');
      expect(pool.query).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ current: 123.45, previous: 120.0 });
    });

    it('should return nulls if no values found', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // today
        .mockResolvedValueOnce({ rows: [] }); // yesterday

      const result = await repo.getMetricChange('bitcoin_dominance');
      expect(result).toEqual({ current: null, previous: null });
    });
  });

  describe('getLatestNewsWithSentiment', () => {
    it('should return news articles with sentiment', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            title: 'Test News',
            source: 'CoinDesk',
            url: 'https://coindesk.com/test',
            published_at: new Date(),
            sentiment_label: 'bullish',
            sentiment_score: 0.8,
          },
        ],
      });

      const result = await repo.getLatestNewsWithSentiment(1);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [1]);
      expect(result[0]).toMatchObject({
        title: 'Test News',
        source: 'CoinDesk',
        url: 'https://coindesk.com/test',
        sentiment: 'bullish',
        sentiment_score: 0.8,
      });
    });

    it('should default sentiment to neutral if sentiment_label is missing', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            title: 'No Sentiment',
            source: 'CryptoSlate',
            url: 'https://cryptoslate.com/test',
            published_at: new Date(),
            sentiment_label: null,
            sentiment_score: null,
          },
        ],
      });

      const result = await repo.getLatestNewsWithSentiment(1);
      expect(result[0].sentiment).toBe('neutral');
    });
  });
});
