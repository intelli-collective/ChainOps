import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSecurityFixtures, mockProjectId } from './mocks/securityFixtures'
import { createMockSecurityService } from './services/mockSecurityService'
import { countSeverities, emptyFilters, filterFindings, scanDetailsPath } from './securityUtils'

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe('security findings', () => {
  it('keeps completed scan status, findings, and blocked policy separate', () => {
    const scan = createSecurityFixtures()[0]
    expect(scan.status).toBe('completed')
    expect(scan.policy?.decision).toBe('blocked')
    expect(countSeverities(scan.findings)).toEqual({ critical: 0, high: 1, medium: 2, low: 5, informational: 0 })
    expect(countSeverities(createSecurityFixtures()[1].findings).informational).toBe(1)
  })
  it('combines search, severity, finding status, and contract filters', () => {
    const findings = createSecurityFixtures()[0].findings
    expect(filterFindings(findings, { search: '  SLT-00 ', severity: 'low', status: 'open', contract: 'Token.sol' }).map(item => item.id)).toEqual(['SLT-004', 'SLT-006'])
    expect(filterFindings(findings, { ...emptyFilters, search: 'REENTRANCY' }).map(item => item.id)).toEqual(['SLT-001'])
    expect(filterFindings(findings, { ...emptyFilters, severity: 'informational' })).toEqual([])
    expect(filterFindings(findings, emptyFilters)).toHaveLength(8)
  })
  it('encodes route parameters without allowing path injection', () => {
    expect(scanDetailsPath('project/a', 'scan?b')).toBe('/projects/project%2Fa/security/scans/scan%3Fb')
  })
})

describe('development mock adapter', () => {
  it('isolates projects and returns independent snapshots', async () => {
    vi.useFakeTimers()
    const service = createMockSecurityService()
    const first = service.listScans(mockProjectId)
    await vi.runAllTimersAsync()
    const scans = await first
    scans[0].findings.splice(0)
    const second = service.listScans(mockProjectId)
    const other = service.listScans('another-project')
    await vi.runAllTimersAsync()
    expect((await second)[0].findings).toHaveLength(8)
    expect(await other).toEqual([])
  })
  it('prepends a mock analysis without changing its linked pipeline or mutating history', async () => {
    vi.useFakeTimers()
    const service = createMockSecurityService()
    const run = service.runAnalysis(mockProjectId)
    await vi.runAllTimersAsync()
    const result = await run
    expect(result.id).toBe('mock-scan-131')
    expect(result.number).toBe(131)
    expect(result.pipelineRunId).toBe('130')
    const history = service.listScans(mockProjectId)
    await vi.runAllTimersAsync()
    expect((await history).map(scan => scan.id)).toEqual(['mock-scan-131', 'scan-130', 'scan-129', 'scan-128', 'scan-127'])
  })
  it('does not turn an analyzer failure into a passed policy', async () => {
    vi.useFakeTimers()
    const pending = createMockSecurityService('failed').listScans(mockProjectId)
    await vi.runAllTimersAsync()
    const [scan] = await pending
    expect(scan.status).toBe('failed')
    expect(scan.findings).toEqual([])
    expect(scan.policy).toBeNull()
  })
  it('cancels pending analysis without creating a scan', async () => {
    vi.useFakeTimers()
    const service = createMockSecurityService()
    const controller = new AbortController()
    const pending = service.runAnalysis(mockProjectId, controller.signal)
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await rejected
    const history = service.listScans(mockProjectId)
    await vi.runAllTimersAsync()
    expect(await history).toHaveLength(4)
  })
  it('retains history when a simulated analysis fails', async () => {
    vi.useFakeTimers()
    const service = createMockSecurityService('run-error')
    const rejected = expect(service.runAnalysis(mockProjectId)).rejects.toThrow('Simulated analyzer failure')
    await vi.runAllTimersAsync()
    await rejected
    const history = service.listScans(mockProjectId)
    await vi.runAllTimersAsync()
    expect(await history).toHaveLength(4)
  })
  it('rejects mock reads and writes outside development', async () => {
    vi.stubEnv('DEV', false)
    const service = createMockSecurityService()
    await expect(service.listScans(mockProjectId)).rejects.toThrow('only available in development')
    await expect(service.runAnalysis(mockProjectId)).rejects.toThrow('only available in development')
  })
  it('provides empty, clean, and running states without inventing policy results', async () => {
    vi.useFakeTimers()
    const empty = createMockSecurityService('empty').listScans(mockProjectId)
    const clean = createMockSecurityService('clean').listScans(mockProjectId)
    const running = createMockSecurityService('running').listScans(mockProjectId)
    await vi.runAllTimersAsync()
    expect(await empty).toEqual([])
    expect((await clean)[0]).toMatchObject({ status: 'completed', findings: [], policy: { decision: 'passed' } })
    expect((await running)[0]).toMatchObject({ status: 'running', findings: [], policy: null })
  })
  it('surfaces a load error and allows slow loads to be cancelled', async () => {
    vi.useFakeTimers()
    const error = expect(createMockSecurityService('error').listScans(mockProjectId)).rejects.toThrow('Unable to load mock scans')
    await vi.runAllTimersAsync()
    await error
    const controller = new AbortController()
    const loading = createMockSecurityService('loading').listScans(mockProjectId, controller.signal)
    const cancelled = expect(loading).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await cancelled
  })
})
