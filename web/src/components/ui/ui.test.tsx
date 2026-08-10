import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'
import { Badge, StatusDot } from './Badge'
import { CopyButton } from './CopyButton'
import { I18nProvider } from '../../i18n'

describe('Button', () => {
  it('renders children and fires click', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>save</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is disabled while loading', () => {
    render(<Button loading>save</Button>)
    expect(screen.getByRole('button', { name: 'save' })).toBeDisabled()
  })

  it('renders primary variant', () => {
    render(<Button variant="primary">go</Button>)
    expect(screen.getByRole('button', { name: 'go' }).className).toContain('bg-accent')
  })
})

describe('Badge', () => {
  it('renders tone class', () => {
    render(<Badge tone="success">ok</Badge>)
    expect(screen.getByText('ok').className).toContain('text-success')
  })
})

describe('StatusDot', () => {
  it('renders a colored dot', () => {
    const { container } = render(<StatusDot tone="accent" pulse />)
    const dot = container.querySelector('[aria-hidden]')
    expect(dot).not.toBeNull()
    expect(dot?.className).toContain('animate-pulse')
  })
})

describe('CopyButton', () => {
  it('copies text to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(
      <I18nProvider>
        <CopyButton text="secret" />
      </I18nProvider>,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(writeText).toHaveBeenCalledWith('secret')
  })
})
