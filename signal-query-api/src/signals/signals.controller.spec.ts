import { Test, TestingModule } from '@nestjs/testing';
import { SignalsController } from './signals.controller';
import { SignalsService } from './signals.service';
import { GetSignalsQueryDto } from '../models/signal.dto';
import { NotFoundException } from '@nestjs/common';

// Mock SignalsService
const mockSignalsService = {
  findByName: jest.fn(),
  findLatestByName: jest.fn(),
  getDistinctSignalNames: jest.fn(),
  getDistinctSignalSources: jest.fn(),
};

describe('SignalsController', () => {
  let controller: SignalsController;
  let service: SignalsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SignalsController],
      providers: [
        {
          provide: SignalsService,
          useValue: mockSignalsService,
        },
      ],
    }).compile();

    controller = module.get<SignalsController>(SignalsController);
    service = module.get<SignalsService>(SignalsService);

    // Reset mocks before each test
    mockSignalsService.findByName.mockReset();
    mockSignalsService.findLatestByName.mockReset();
    mockSignalsService.getDistinctSignalNames.mockReset();
    mockSignalsService.getDistinctSignalSources.mockReset();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDistinctSignalNames', () => {
    it('should call signalsService.getDistinctSignalNames once', async () => {
      const mockNames = ['name1', 'name2'];
      mockSignalsService.getDistinctSignalNames.mockResolvedValueOnce(
        mockNames,
      );
      await controller.getDistinctSignalNames();
      expect(service.getDistinctSignalNames).toHaveBeenCalledTimes(1);
    });

    it('should return the result from the service call', async () => {
      const mockNames = ['name1', 'name2'];
      mockSignalsService.getDistinctSignalNames.mockResolvedValueOnce(
        mockNames,
      );
      const result = await controller.getDistinctSignalNames();
      expect(result).toEqual(mockNames);
    });
  });

  describe('getDistinctSignalSources', () => {
    it('should call signalsService.getDistinctSignalSources once', async () => {
      const mockSources = ['source1', 'source2'];
      mockSignalsService.getDistinctSignalSources.mockResolvedValueOnce(
        mockSources,
      );
      await controller.getDistinctSignalSources();
      expect(service.getDistinctSignalSources).toHaveBeenCalledTimes(1);
    });

    it('should return the result from the service call', async () => {
      const mockSources = ['source1', 'source2'];
      mockSignalsService.getDistinctSignalSources.mockResolvedValueOnce(
        mockSources,
      );
      const result = await controller.getDistinctSignalSources();
      expect(result).toEqual(mockSources);
    });
  });

  describe('getSignalByName', () => {
    const signalName = 'test_signal';

    it('should call signalsService.findByName with signalName and queryParams (including source)', async () => {
      const queryParamsDto = new GetSignalsQueryDto();
      queryParamsDto.source = 'test_source';
      queryParamsDto.limit = 50;

      mockSignalsService.findByName.mockResolvedValueOnce([]);
      await controller.getSignalByName(signalName, queryParamsDto);

      expect(service.findByName).toHaveBeenCalledWith(
        signalName,
        queryParamsDto,
      );
    });

    it('should call signalsService.findByName with signalName and queryParams (without source)', async () => {
      const queryParamsDto = new GetSignalsQueryDto();
      queryParamsDto.limit = 20;
      // queryParamsDto.source is undefined

      mockSignalsService.findByName.mockResolvedValueOnce([]);
      await controller.getSignalByName(signalName, queryParamsDto);

      expect(service.findByName).toHaveBeenCalledWith(
        signalName,
        queryParamsDto,
      );
    });

    it('should return the result from signalsService.findByName', async () => {
      const mockSignalData = [
        { time: new Date(), name: signalName, value: 1, source: 's' },
      ];
      const queryParamsDto = new GetSignalsQueryDto();
      mockSignalsService.findByName.mockResolvedValueOnce(mockSignalData);

      const result = await controller.getSignalByName(
        signalName,
        queryParamsDto,
      );
      expect(result).toEqual(mockSignalData);
    });
  });

  describe('getLatestSignalByName', () => {
    const signalName = 'test_latest_signal';

    it('should call signalsService.findLatestByName with the signalName', async () => {
      const mockSignal = {
        time: new Date(),
        name: signalName,
        value: 123,
        source: 'test',
      };
      mockSignalsService.findLatestByName.mockResolvedValueOnce(mockSignal);
      await controller.getLatestSignalByName(signalName);
      expect(service.findLatestByName).toHaveBeenCalledWith(signalName);
    });

    it('should return the signal if found', async () => {
      const mockSignal = {
        time: new Date(),
        name: signalName,
        value: 123,
        source: 'test',
      };
      mockSignalsService.findLatestByName.mockResolvedValueOnce(mockSignal);
      const result = await controller.getLatestSignalByName(signalName);
      expect(result).toEqual(mockSignal);
    });

    it('should throw NotFoundException if signal is not found', async () => {
      mockSignalsService.findLatestByName.mockResolvedValueOnce(null);
      await expect(
        controller.getLatestSignalByName(signalName),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
