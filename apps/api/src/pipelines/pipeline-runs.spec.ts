import { plannedStages } from './pipeline-runs.service.js';

const snapshot = (stages: string[]) => ({ framework: 'hardhat' as const, buildCommand: 'b', testCommand: 't', slitherConfig: null, stages });

describe('pipeline run stage planning', () => {
  it('runs checkout, build and test in M1 and leaves Slither/Policy to the Security module (M4)', () => {
    const planned = plannedStages(snapshot(['checkout', 'build', 'test', 'slither', 'policy']));
    expect(planned.map((stage) => `${stage.key}:${stage.status}`)).toEqual(['checkout:pending', 'build:pending', 'test:pending', 'slither:skipped', 'policy:skipped']);
    expect(planned[3].skipReason).toMatch(/Security module \(M4\)/);
  });

  it('treats "compile" as build and skips stages disabled in the configuration', () => {
    const planned = plannedStages(snapshot(['checkout', 'compile']));
    expect(planned.map((stage) => `${stage.key}:${stage.status}`)).toEqual(['checkout:pending', 'build:pending', 'test:skipped', 'slither:skipped', 'policy:skipped']);
    expect(planned[2].skipReason).toMatch(/Disabled in the pipeline configuration/);
  });
});
