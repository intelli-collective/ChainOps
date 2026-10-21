import type { PipelineRun } from '../types/pipelineRun'

export const MOCK_PROJECT_ID = 'chainvault'

/** Development fixtures mirroring the approved Pipeline Runs Figma frame. */
export const pipelineRuns: PipelineRun[] = [
  { id: 'run-129', projectId: MOCK_PROJECT_ID, runNumber: 129, commitSha: 'b72e4d19c5a3f8e0d6b2a9c4f1e7d3b5a8c0e6f2', branch: 'main', trigger: 'manual', status: 'running', author: 'Daniel Kim', startedAt: '2026-10-29T09:12:00', durationSeconds: null },
  { id: 'run-128', projectId: MOCK_PROJECT_ID, runNumber: 128, commitSha: 'a3f9c2e8b1d4f6a0c9e2b7d5a1f3c8e6b4d2a0f9', branch: 'main', trigger: 'push', status: 'success', author: 'Daniel Kim', startedAt: '2026-10-28T14:32:00', durationSeconds: 272 },
  { id: 'run-127', projectId: MOCK_PROJECT_ID, runNumber: 127, commitSha: '98bd4f1c2a7e5d3b9f0c6a8e1d4b7f2a5c3e9d0b', branch: 'main', trigger: 'push', status: 'failed', author: 'Alex Rivera', startedAt: '2026-10-28T14:32:00', durationSeconds: 271 },
  { id: 'run-126', projectId: MOCK_PROJECT_ID, runNumber: 126, commitSha: 'e7c1d0a4b9f2e6c3a8d5b1f7e0c4a9d2b6f3e8c1', branch: 'feature/fees', trigger: 'pull_request', status: 'success', author: 'Maya Chen', startedAt: '2026-10-27T14:32:00', durationSeconds: 270 },
  { id: 'run-125', projectId: MOCK_PROJECT_ID, runNumber: 125, commitSha: '4d2b9e8f1a6c3d7e0b5f9a2c8e4d1b6f3a7c0e9d', branch: 'main', trigger: 'manual', status: 'cancelled', author: 'James Park', startedAt: '2026-10-27T14:32:00', durationSeconds: 269 },
  { id: 'run-124', projectId: MOCK_PROJECT_ID, runNumber: 124, commitSha: 'c9f0a31e7b4d2f8a6c1e5b9d3f0a7c4e2b8d6f1a', branch: 'main', trigger: 'push', status: 'success', author: 'Daniel Kim', startedAt: '2026-10-26T14:32:00', durationSeconds: 268 },
  { id: 'run-123', projectId: MOCK_PROJECT_ID, runNumber: 123, commitSha: '1a5e7c9b3d0f6a2e8c4b1d7f5a9e3c0b6d2f8a4e', branch: 'main', trigger: 'push', status: 'success', author: 'Alex Rivera', startedAt: '2026-10-26T14:32:00', durationSeconds: 267 },
  { id: 'run-122', projectId: MOCK_PROJECT_ID, runNumber: 122, commitSha: '6b4d2e0a8f3c1b7e5d9a2f6c0e4b8d1a3f7c5e9b', branch: 'hotfix/123', trigger: 'pull_request', status: 'failed', author: 'Maya Chen', startedAt: '2026-10-25T14:32:00', durationSeconds: 266 },
  { id: 'run-121', projectId: MOCK_PROJECT_ID, runNumber: 121, commitSha: '0f8c9d1b5e2a7f4c3d6b0e9a1c8f5d2b7e4a6c3f', branch: 'main', trigger: 'push', status: 'success', author: 'James Park', startedAt: '2026-10-25T14:32:00', durationSeconds: 265 },
]
