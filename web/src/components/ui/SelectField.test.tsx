import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SelectField } from './SelectField'

describe('SelectField', () => {
  it('renders the selected option label, not the raw value', () => {
    render(
      <SelectField
        label="window"
        value="86400000"
        onChange={() => undefined}
        options={[
          { value: '86400000', label: '24h' },
          { value: '604800000', label: '7d' },
          { value: '', label: 'all' },
        ]}
      />,
    )
    const trigger = screen.getByRole('combobox')
    expect(trigger.textContent).toContain('24h')
    expect(trigger.textContent).not.toContain('86400000')
  })

  it('renders the label for an empty-string value (all/none option)', () => {
    render(
      <SelectField
        label="server"
        value=""
        onChange={() => undefined}
        options={[
          { value: '', label: 'all' },
          { value: 'server-1', label: 'remote' },
        ]}
      />,
    )
    const trigger = screen.getByRole('combobox')
    expect(trigger.textContent).toContain('all')
  })
})
