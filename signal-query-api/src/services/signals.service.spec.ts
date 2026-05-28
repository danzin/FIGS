import { AppError } from '../errors/errors';
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
      const mockData = [
        {
          timestamp: new Date('2024-01-01T00:00:00Z'),
          open: 1,
          high: 2,
          low: 0.5,
          close: 1.5,
        },
      ];
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

    it('should throw a not found AppError if no OHLC data is found', async () => {
      repo.getOhlcData.mockResolvedValueOnce([]);
      const resultPromise = service.getOhlcData('BTC', {});

      await expect(resultPromise).rejects.toBeInstanceOf(AppError);
      await expect(resultPromise).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
      });
    });
  });

  describe('getLatestIndicators', () => {
    it('should return indicators mapped by name', async () => {
      const mockIndicators = [
        {
          name: 'bitcoin_dominance',
          value: 60,
          source: 'timescaledb',
          time: new Date('2024-01-01T00:00:00Z'),
        },
        {
          name: 'fear_greed',
          value: 60,
          source: 'timescaledb',
          time: new Date('2024-01-01T00:00:00Z'),
        },
      ];
      repo.getLatestIndicators.mockResolvedValueOnce(mockIndicators as any);

      const result = await service.getLatestIndicators([
        'bitcoin_dominance',
        'fear_greed',
      ]);

      expect(result).toEqual({
        bitcoin_dominance: {
          name: 'bitcoin_dominance',
          value: 60,
          source: 'timescaledb',
          time: new Date('2024-01-01T00:00:00Z'),
        },
        fear_greed: {
          name: 'fear_greed',
          value: 60,
          source: 'timescaledb',
          time: new Date('2024-01-01T00:00:00Z'),
        },
      });
      expect(repo.getLatestIndicators).toHaveBeenCalledWith([
        'bitcoin_dominance',
        'fear_greed',
      ]);
    });
  });
  describe('getMetricChange', () => {
    it('should return metric change values from repo', async () => {
      repo.getMetricChange = jest
        .fn()
        .mockResolvedValue({ current: 100, previous: 80 });
      const result = await service.getMetricWithChange('bitcoin_dominance');
      expect(result).toStrictEqual({
        current: 100,
        previous: 80,
        change: 25,
        changeType: 'percent',
        name: 'bitcoin_dominance',
      });
      expect(repo.getMetricChange).toHaveBeenCalledWith('bitcoin_dominance');
    });

    it('should return nulls if repo returns nulls', async () => {
      repo.getMetricChange = jest
        .fn()
        .mockResolvedValue({ current: null, previous: null });
      const result = await service.getMetricWithChange('bitcoin_dominance');
      expect(result).toEqual({
        current: null,
        previous: null,
        change: null,
        changeType: 'percent',
        name: 'bitcoin_dominance',
      });
    });
  });

  describe('getLatestNewsWithSentiment', () => {
    it('should return news articles with sentiment from repo', async () => {
      const mockNews = [
        {
          title: 'Test News',
          source: 'CoinDesk',
          url: 'https://coindesk.com/test',
          published_at: new Date(),
          summary: 'Summary',
          image_url: 'https://coindesk.com/image.png',
          sentiment: 'bullish',
          sentiment_score: 0.8,
        },
      ];
      repo.getLatestNewsWithSentiment = jest.fn().mockResolvedValue(mockNews);
      const result = await service.getLatestNewsWithSentiment(1, 0);
      expect(result).toEqual(mockNews);
      expect(repo.getLatestNewsWithSentiment).toHaveBeenCalledWith(1, 0);
    });

    it('should pass through repository news payloads unchanged', async () => {
      const mockNews = [
        {
          title: 'No Sentiment',
          source: 'CryptoSlate',
          url: 'https://cryptoslate.com/test',
          published_at: new Date(),
          summary: null,
          image_url: null,
          sentiment: 'neutral',
          sentiment_score: null,
        },
      ];
      repo.getLatestNewsWithSentiment = jest.fn().mockResolvedValue(mockNews);
      const result = await service.getLatestNewsWithSentiment(1);
      expect(result[0].sentiment).toBe('neutral');
    });
  });
});
