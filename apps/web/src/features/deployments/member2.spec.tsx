import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Member2Page } from './pages/Member2Pages'
import { createMember2Preview } from './mocks/member2Preview'
import { parameterError } from './parameterValidation'
import { Member2Toolbar } from './components/Member2Chrome'
import { member2Api } from './services/member2Api'
import type { Member2Mode } from './pages/Member2Pages'
import type { Member2Service } from './types/member2'

beforeEach(() => sessionStorage.clear())
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
function mount(
  mode: Member2Mode,
  path: string,
  service = createMember2Preview()
) {
  const patterns = {
    wizard: 'deployments/new',
    history: 'deployments',
    outcome: 'deployments/:deploymentId',
    transaction: 'deployments/:deploymentId/transaction',
    registry: 'contracts',
    register: 'contracts/register',
    contract: 'contracts/:contractId',
    abi: 'artifacts/:artifactId/abi'
  }
  render(
    <MemoryRouter initialEntries={[`/preview/member-2/${path}`]}>
      <Routes>
        {(Object.entries(patterns) as [Member2Mode, string][]).map(
          ([m, pattern]) => (
            <Route
              key={m}
              path={`/preview/member-2/${pattern}`}
              element={
                <Member2Page
                  mode={m}
                  service={service}
                  base="/preview/member-2"
                />
              }
            />
          )
        )}
      </Routes>
    </MemoryRouter>
  )
  return { mode, service }
}
async function click(label: string) {
  fireEvent.click(await screen.findByRole('button', { name: label }))
}
async function review() {
  await click('Continue to Network →')
  await click('Continue to Parameters →')
  await click('Continue to Review →')
  await screen.findByText('Security & policy checks')
}

describe('ABI constructor validation', () => {
  it('validates uint256 without JS number coercion', () => {
    const max = (2n ** 256n - 1n).toString()
    expect(
      parameterError({ name: 'supply', type: 'uint256' }, max)
    ).toBeUndefined()
    expect(
      parameterError(
        { name: 'supply', type: 'uint256' },
        (2n ** 256n).toString()
      )
    ).toContain('between')
    expect(parameterError({ name: 'supply', type: 'uint256' }, '-1')).toContain(
      'between'
    )
    expect(
      parameterError({ name: 'supply', type: 'uint256' }, '1e18')
    ).toContain('decimal')
    expect(parameterError({ name: '', type: 'int8' }, '-128')).toBeUndefined()
    expect(parameterError({ name: '', type: 'int8' }, '128')).toContain(
      'between'
    )
  })
  it('checks addresses, booleans, byte widths, arrays and unsupported types', () => {
    expect(parameterError({ name: '', type: 'address' }, '0x123')).toContain(
      '42-character'
    )
    expect(parameterError({ name: '', type: 'bool' }, 'yes')).toContain(
      'true or false'
    )
    expect(
      parameterError({ name: '', type: 'bytes2' }, '0xabcd')
    ).toBeUndefined()
    expect(parameterError({ name: '', type: 'bytes2' }, '0xabc')).toContain(
      'hexadecimal'
    )
    expect(
      parameterError({ name: '', type: 'uint8[2]' }, '[1, 256]')
    ).toContain('between')
    expect(parameterError({ name: '', type: 'uint8[2]' }, '[1]')).toContain(
      'exactly 2'
    )
    expect(
      parameterError({ name: '', type: 'uint256[]' }, '[9007199254740993]')
    ).toContain('Quote large integers')
    expect(
      parameterError({ name: '', type: 'uint256[]' }, '["9007199254740993"]')
    ).toBeUndefined()
    expect(parameterError({ name: '', type: 'tuple' }, '{}')).toContain(
      'not supported'
    )
  })
})
describe('Member 2 deployment flow', () => {
  it('retains invalid parameters and prevents progression', async () => {
    mount('wizard', 'deployments/new')
    await click('Continue to Network →')
    await click('Continue to Parameters →')
    const input = await screen.findByLabelText('owner (address) · Required')
    fireEvent.change(input, { target: { value: '0x123' } })
    await click('Continue to Review →')
    expect((input as HTMLInputElement).value).toBe('0x123')
    expect(
      screen.getByText('Enter a valid 42-character Ethereum address.')
    ).toBeTruthy()
    expect(screen.queryByText('Security & policy checks')).toBeNull()
  })
  it('blocks signing, submits once, and registers only after confirmations', async () => {
    const service = createMember2Preview(),
      submit = vi.spyOn(service, 'submit')
    mount('wizard', 'deployments/new', service)
    await review()
    await click('Review a blocked preflight')
    expect(
      (
        screen.getByRole('button', {
          name: 'Confirm deployment →'
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    await click('Return to deployment review')
    await click('Confirm deployment →')
    const sign = await screen.findByRole('button', {
      name: 'Sign & submit (demo)'
    })
    fireEvent.click(sign)
    fireEvent.click(sign)
    await screen.findByRole('heading', { name: 'Deployment submitted' })
    expect(submit).toHaveBeenCalledTimes(1)
    expect(await service.contracts('chainvault')).toHaveLength(4)
    await click('Refresh transaction status')
    await click('Refresh transaction status')
    expect(
      screen.queryByRole('heading', { name: 'Deployment confirmed' })
    ).toBeNull()
    await click('Refresh transaction status')
    await screen.findByRole('heading', { name: 'Deployment confirmed' })
    expect(await service.contracts('chainvault')).toHaveLength(5)
  })
  it('preserves ambiguous outcomes on reconciliation', async () => {
    const service = createMember2Preview()
    mount('outcome', 'deployments/deployment-4', service)
    await screen.findByRole('heading', { name: 'Deployment outcome unknown' })
    await click('Recheck transaction status')
    expect(screen.getByText('? Transaction outcome uncertain')).toBeTruthy()
    expect(
      (await service.deployment('chainvault', 'deployment-4')).status
    ).toBe('UNKNOWN')
  })
  it('shows authoritative preflight errors without signing', async () => {
    const service = createMember2Preview()
    service.preflight = async () => ({
      eligible: false,
      reason: 'Approval has been revoked.',
      checks: [{ label: 'Approval current', passed: false }]
    })
    mount('wizard', 'deployments/new', service)
    await review()
    expect(
      screen.getByText('Deployment blocked: Approval has been revoked.')
    ).toBeTruthy()
    expect(
      (
        screen.getByRole('button', {
          name: 'Confirm deployment →'
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })
})
describe('registry and data states', () => {
  it.each([
    ['history', 'deployments', 'Deployments'],
    ['registry', 'contracts', 'Contract Registry'],
    [
      'transaction',
      'deployments/deployment-1/transaction',
      'Transaction Details'
    ],
    ['outcome', 'deployments/deployment-1', 'Deployment confirmed'],
    ['outcome', 'deployments/deployment-3', 'Deployment failed'],
    ['contract', 'contracts/contract-vault', 'Vault v1.4'],
    ['abi', 'artifacts/artifact-vault/abi', 'Contract ABI']
  ] as const)('renders %s resource %s', async (mode, path, title) => {
    mount(mode, path)
    await screen.findByRole('heading', { name: title })
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('registers an external contract without fabricating release provenance', async () => {
    const { service } = mount('register', 'contracts/register')
    await screen.findByLabelText('Contract name *')
    fireEvent.change(screen.getByLabelText('Contract name *'), {
      target: { value: 'Imported contract' }
    })
    fireEvent.change(screen.getByLabelText('Network *'), {
      target: { value: 'sepolia' }
    })
    fireEvent.change(screen.getByLabelText('Contract address *'), {
      target: { value: `0x${'a'.repeat(40)}` }
    })
    await click('Register contract →')
    await screen.findByRole('heading', { name: 'Imported contract v1.0' })
    const record = (await service.contracts('chainvault')).find(
      (c) => c.name === 'Imported contract'
    )!
    expect(record.provenance).toBe('external')
    expect(record.artifact).toBeUndefined()
    expect(record.monitoring).toBe('Not enabled')
  })
  it('handles duplicate network addresses and keeps form input', async () => {
    const service = createMember2Preview(),
      existing = (await service.contracts('chainvault'))[0]
    mount('register', 'contracts/register', service)
    await screen.findByLabelText('Contract name *')
    fireEvent.change(screen.getByLabelText('Contract name *'), {
      target: { value: 'Duplicate' }
    })
    fireEvent.change(screen.getByLabelText('Network *'), {
      target: { value: 'sepolia' }
    })
    fireEvent.change(screen.getByLabelText('Contract address *'), {
      target: { value: existing.address }
    })
    await click('Register contract →')
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(
      (screen.getByLabelText('Contract name *') as HTMLInputElement).value
    ).toBe('Duplicate')
  })
  it('renders loading, permission errors, retries and an empty registry', async () => {
    const service = createMember2Preview()
    let reject: (error: Error) => void = () => {}
    service.contracts = () =>
      new Promise((_resolve, fail) => {
        reject = fail
      })
    mount('registry', 'contracts', service)
    expect(screen.getByRole('status').textContent).toBe('Loading…')
    reject(new Error('You do not have access to this project.'))
    await screen.findByRole('alert')
    service.contracts = async () => []
    await click('Try again')
    await waitFor(() =>
      expect(
        screen.getByText('No contracts are registered for this project.')
      ).toBeTruthy()
    )
  })
  it('does not leak contracts or deployments into a different project', async () => {
    const service: Member2Service = createMember2Preview()
    expect(await service.contracts('different-project')).toEqual([])
    expect(await service.deployments('different-project')).toEqual([])
    await expect(
      service.deployment('different-project', 'deployment-1')
    ).rejects.toThrow('not found')
  })
})

describe('shared toolbar integration', () => {
  it('closes popovers on Escape and outside click, restoring trigger focus', async () => {
    render(
      <MemoryRouter>
        <Member2Toolbar
          root="/preview/member-2"
          projectId="chainvault"
          preview
        />
      </MemoryRouter>
    )
    const bell = screen.getByRole('button', { name: 'Notifications' })
    fireEvent.click(bell)
    expect(screen.getByRole('region', { name: 'Notifications' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('region', { name: 'Notifications' })).toBeNull()
    expect(document.activeElement).toBe(bell)
    fireEvent.click(screen.getByRole('button', { name: /Dulmina Sithara/ }))
    expect(screen.getByRole('region', { name: 'Account' })).toBeTruthy()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('region', { name: 'Account' })).toBeNull()
  })
  it('makes search results navigable and shows an empty state', async () => {
    render(
      <MemoryRouter>
        <Member2Toolbar
          root="/preview/member-2"
          projectId="chainvault"
          preview
        />
      </MemoryRouter>
    )
    fireEvent.change(screen.getByRole('searchbox', { name: 'Global search' }), {
      target: { value: 'Registry' }
    })
    expect(
      (
        await screen.findByRole('link', { name: 'Contract Registry' })
      ).getAttribute('href')
    ).toBe('/preview/member-2/contracts')
    fireEvent.change(screen.getByRole('searchbox', { name: 'Global search' }), {
      target: { value: 'NoMatchingResource' }
    })
    expect(await screen.findByText('No matching resources.')).toBeTruthy()
  })
})
describe('live API boundary', () => {
  it('uses the cookie session, shared CSRF token and idempotency header for submission', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrfToken: 'token' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'server-result' })
      })
    vi.stubGlobal('fetch', fetch)
    const draft = { artifactId: 'a', networkId: 'n', parameters: [] }
    expect((await member2Api.submit('project', draft, 'unique-key')).id).toBe(
      'server-result'
    )
    expect(fetch.mock.calls[1][0]).toBe(
      '/api/projects/project/release/deployments'
    )
    expect(fetch.mock.calls[1][1]).toMatchObject({
      credentials: 'include',
      headers: { 'X-CSRF-Token': 'token', 'Idempotency-Key': 'unique-key' },
      body: JSON.stringify(draft)
    })
  })
  it('presents permission denial without falling back to sample data', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 403, json: async () => ({}) })
    )
    await expect(member2Api.contracts('another-project')).rejects.toThrow(
      'do not have access'
    )
  })
})
