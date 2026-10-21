import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockProjectId } from './mocks/securityFixtures'
import { createMockSecurityService } from './services/mockSecurityService'

afterEach(() => { vi.useRealTimers() })

describe('security finding detail foundation', () => {
  it('looks up the Figma finding by project, scan and finding ID', async () => {
    vi.useFakeTimers()
    const pending = createMockSecurityService().getFindingDetail(mockProjectId, 'scan-130', 'SLT-001')
    await vi.runAllTimersAsync()
    const result = await pending
    expect(result.status).toBe('found')
    if (result.status !== 'found') return
    expect(result.scan.pipelineRunId).toBe('130')
    expect(result.scan.policy?.decision).toBe('blocked')
    expect(result.finding).toMatchObject({
      detector: 'Slither',
      sourceLocation: { file: 'Vault.sol', line: 128 },
      sourceContext: { highlightedLine: 128 },
    })
    expect(result.finding.sourceContext?.lines.find(line => line.number === 128)?.text).toContain('require(success')
    expect(result.finding.remediation?.summary).toContain('Update state before external calls')
  })

  it('selects the first finding when the route has no finding hash', async () => {
    vi.useFakeTimers()
    const pending = createMockSecurityService().getFindingDetail(mockProjectId, 'scan-130')
    await vi.runAllTimersAsync()
    const result = await pending
    expect(result.status === 'found' ? result.finding.id : null).toBe('SLT-001')
  })

  it('distinguishes missing scan, missing finding and empty completed scan', async () => {
    vi.useFakeTimers()
    const service = createMockSecurityService()
    const missingProject = service.getFindingDetail('other-project', 'scan-130')
    const missingScan = service.getFindingDetail(mockProjectId, 'scan-missing')
    const missingFinding = service.getFindingDetail(mockProjectId, 'scan-130', 'SLT-missing')
    const emptyScan = createMockSecurityService('clean').getFindingDetail(mockProjectId, 'scan-130')
    await vi.runAllTimersAsync()
    expect(await missingProject).toEqual({ status: 'scan-not-found' })
    expect(await missingScan).toEqual({ status: 'scan-not-found' })
    expect((await missingFinding).status).toBe('finding-not-found')
    const empty = await emptyScan
    expect(empty.status).toBe('finding-not-found')
    if (empty.status === 'finding-not-found') expect(empty.scan.status).toBe('completed')
  })

  it('allows older sparse findings and returns independent snapshots', async () => {
    vi.useFakeTimers()
    const service = createMockSecurityService()
    const first = service.getFindingDetail(mockProjectId, 'scan-129', 'SLT-009')
    await vi.runAllTimersAsync()
    const result = await first
    expect(result.status).toBe('found')
    if (result.status !== 'found') return
    expect(result.finding.sourceLocation).toBeUndefined()
    expect(result.finding.remediation).toBeUndefined()
    result.finding.title = 'changed locally'
    const second = service.getFindingDetail(mockProjectId, 'scan-129', 'SLT-009')
    await vi.runAllTimersAsync()
    const next = await second
    expect(next.status === 'found' ? next.finding.title : null).toBe('Compiler version information')
  })

  it('cancels a detail lookup with the shared service abort contract', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const pending = createMockSecurityService().getFindingDetail(mockProjectId, 'scan-130', 'SLT-001', controller.signal)
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await rejected
  })
})
