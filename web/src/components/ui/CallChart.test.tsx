import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { CallChart } from './CallChart'
import { I18nProvider } from '../../i18n'

describe('CallChart', () => {
  it('renders an svg area chart with total and error polylines', () => {
    const { container } = render(
      <I18nProvider>
        <CallChart
          points={[
            { bucket: '2026-08-11T10:00:00.000Z', total: 2, success: 1, error: 1 },
            { bucket: '2026-08-11T11:00:00.000Z', total: 5, success: 4, error: 1 },
            { bucket: '2026-08-11T12:00:00.000Z', total: 3, success: 3, error: 0 },
          ]}
          bucketSeconds={3600}
        />
      </I18nProvider>,
    )
    const polylines = container.querySelectorAll('polyline')
    expect(polylines).toHaveLength(2) // total + error
    expect(container.querySelector('polygon')).not.toBeNull() // area fill
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('renders a placeholder for empty data', () => {
    const { container } = render(
      <I18nProvider>
        <CallChart points={[]} bucketSeconds={3600} />
      </I18nProvider>,
    )
    expect(container.textContent).toContain('—')
  })
})
