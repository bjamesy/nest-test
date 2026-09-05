import { Test, TestingModule } from '@nestjs/testing';
import { JobStatus } from '@prep-proj/shared';
import { JobsRepository } from '../jobs/jobs.repository.js';
import { IngestionProcessor } from './ingestion.processor.js';

describe('IngestionProcessor', () => {
  let processor: IngestionProcessor;
  let jobsRepository: { updateStatus: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    jobsRepository = {
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [IngestionProcessor, { provide: JobsRepository, useValue: jobsRepository }],
    }).compile();

    processor = module.get(IngestionProcessor);
  });

  it('marks the job running then completed', async () => {
    await processor.process({ id: '1', data: { jobId: 'job-1' } } as never);

    expect(jobsRepository.updateStatus).toHaveBeenNthCalledWith(1, 'job-1', JobStatus.Running, {
      stage: 'processing',
    });
    expect(jobsRepository.updateStatus).toHaveBeenNthCalledWith(2, 'job-1', JobStatus.Completed, {
      stage: 'done',
      progress: 100,
    });
  });
});
