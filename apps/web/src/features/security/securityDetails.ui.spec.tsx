// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { SecurityFindingDetailsPage } from './pages/SecurityFindingDetailsPage'
import { SecurityFindingDetailsView } from './components/SecurityFindingDetailsView'
import { createSecurityFixtures, mockProjectId } from './mocks/securityFixtures'
import { createMockSecurityService } from './services/mockSecurityService'
import type { SecurityService } from './types/security'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const [blockedScan, passedScan, reviewScan] = createSecurityFixtures()
const primary = blockedScan.findings[0]
const sparse = passedScan.findings[0]

function renderView(scan = blockedScan, finding = primary) {
  const onNavigate = vi.fn()
  render(<SecurityFindingDetailsView scan={scan} finding={finding} onNavigate={onNavigate} />)
  return onNavigate
}

function renderPage(scanId = 'scan-130', findingId?: string, service: SecurityService = createMockSecurityService()) {
  const onNavigate = vi.fn()
  render(<SecurityFindingDetailsPage projectId={mockProjectId} scanId={scanId} findingId={findingId} service={service} onNavigate={onNavigate} />)
  return onNavigate
}

describe('security finding detail view', () => {
  it('renders the selected finding, source location and highlighted code line', () => {
    renderView()
    expect(screen.getByRole('heading', { name: 'Reentrancy vulnerability' })).toBeTruthy()
    expect(screen.getByText(/SLT-001 detected by Slither/)).toBeTruthy()
    expect(screen.getByText('Line 128')).toBeTruthy()
    const context = screen.getByRole('region', { name: 'Affected source context' })
    expect(within(context).getByText('128').closest('.security-detail-source-line')?.classList.contains('security-detail-source-line-highlight')).toBe(true)
    expect(screen.getByText('Commit b74a1d0')).toBeTruthy()
    expect(screen.queryByLabelText('Development scenario')).toBeNull()
    expect(document.querySelector('aside, header')).toBeNull()
  })

  it('switches tabs, including keyboard tabs, and expands source evidence', () => {
    renderView()
    const overview = screen.getByRole('tab', { name: 'Overview' })
    const remediation = screen.getByRole('tab', { name: 'Remediation' })
    const evidence = screen.getByRole('tab', { name: 'Evidence' })
    expect(overview.getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /View remediation/ }))
    expect(remediation.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel', { name: 'Remediation' }).textContent).toContain('Update the withdrawal balance')
    fireEvent.keyDown(remediation, { key: 'ArrowRight' })
    expect(evidence.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel', { name: 'Evidence' }).textContent).toContain('value transfer')
    const details = screen.getByText('Source context').closest('details')!
    fireEvent.click(screen.getByText('Source context'))
    expect(details.open).toBe(true)
  })

  it('keeps severity and policy separate and exposes both navigation contracts', () => {
    const onNavigate = renderView()
    expect(screen.getByText('High severity')).toBeTruthy()
    expect(within(screen.getByLabelText('Release policy result')).getByText('Blocked')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Security' }))
    fireEvent.click(screen.getByRole('button', { name: 'Linked run #130' }))
    expect(onNavigate.mock.calls).toEqual([
      ['/projects/chainvault/security'],
      ['/projects/chainvault/pipelines/130'],
    ])
    cleanup()
    renderView(reviewScan, reviewScan.findings[0])
    expect(within(screen.getByLabelText('Release policy result')).getByText('Requires Review')).toBeTruthy()
  })

  it('acknowledges only in local UI and handles sparse optional data', () => {
    renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge' }))
    expect(screen.getByRole('button', { name: 'Acknowledged' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('status').textContent).toContain('not saved')
    expect(primary.status).toBe('open')
    cleanup()
    renderView(passedScan, sparse)
    expect(screen.getByText('Source context is unavailable for this finding.')).toBeTruthy()
    expect(within(screen.getByLabelText('Release policy result')).getByText('Passed')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /View remediation/ })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Remediation' }))
    expect(screen.getByRole('tabpanel', { name: 'Remediation' }).textContent).toContain('No remediation guidance')
    fireEvent.click(screen.getByRole('tab', { name: 'Evidence' }))
    expect(screen.getByRole('tabpanel', { name: 'Evidence' }).textContent).toContain('No additional evidence')
  })
})

describe('security finding detail page states', () => {
  it('loads the requested finding and defaults to the first when the hash is absent', async () => {
    renderPage('scan-130', 'SLT-002')
    expect(screen.getByRole('heading', { name: 'Loading finding' })).toBeTruthy()
    expect(await screen.findByRole('heading', { name: 'Untrusted external call' })).toBeTruthy()
    cleanup()
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Reentrancy vulnerability' })).toBeTruthy()
  })

  it('distinguishes missing scans, missing findings and empty scans', async () => {
    const onNavigate = renderPage('scan-missing')
    expect(await screen.findByRole('heading', { name: 'Scan not found' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Security Findings' }))
    expect(onNavigate).toHaveBeenCalledWith('/projects/chainvault/security')
    cleanup()
    renderPage('scan-130', 'SLT-missing')
    expect(await screen.findByRole('heading', { name: 'Finding not found' })).toBeTruthy()
    cleanup()
    renderPage('scan-130', undefined, createMockSecurityService('clean'))
    expect(await screen.findByRole('heading', { name: 'Finding not found' })).toBeTruthy()
  })

  it('shows load errors with Retry and preserves the loading state until resolved', async () => {
    const getFindingDetail = vi.fn().mockRejectedValueOnce(new Error('Temporary failure')).mockResolvedValueOnce({ status: 'found', scan: blockedScan, finding: primary })
    const service = { ...createMockSecurityService(), getFindingDetail }
    renderPage('scan-130', 'SLT-001', service)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Temporary failure')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Reentrancy vulnerability' })).toBeTruthy())
    expect(getFindingDetail).toHaveBeenCalledTimes(2)
    cleanup()
    renderPage('scan-130', 'SLT-001', createMockSecurityService('loading'))
    expect(screen.getByRole('heading', { name: 'Loading finding' })).toBeTruthy()
  })

  it('does not display a previous finding while the route selection changes', async () => {
    const service = createMockSecurityService()
    const onNavigate = vi.fn()
    const page = render(<SecurityFindingDetailsPage projectId={mockProjectId} scanId="scan-130" findingId="SLT-001" service={service} onNavigate={onNavigate} />)
    expect(await screen.findByRole('heading', { name: 'Reentrancy vulnerability' })).toBeTruthy()
    page.rerender(<SecurityFindingDetailsPage projectId={mockProjectId} scanId="scan-129" findingId="SLT-009" service={service} onNavigate={onNavigate} />)
    expect(screen.queryByRole('heading', { name: 'Reentrancy vulnerability' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Loading finding' })).toBeTruthy()
    expect(await screen.findByRole('heading', { name: 'Compiler version information' })).toBeTruthy()
  })
})
