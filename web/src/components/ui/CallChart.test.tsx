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

  it('builds well-formed points attributes (coordinate pairs, not path commands)', () => {
    const { container } = render(
      <I18nProvider>
        <CallChart
          points={[
            { bucket: '2026-08-11T10:00:00.000Z', total: 4, success: 3, error: 1 },
            { bucket: '2026-08-11T11:00:00.000Z', total: 8, success: 6, error: 2 },
          ]}
          bucketSeconds={3600}
        />
      </I18nProvider>,
    )
    for (const element of Array.from(container.querySelectorAll('polyline, polygon'))) {
      const points = element.getAttribute('points') ?? ''
      expect(points).not.toContain('M')
      expect(points).not.toContain('L')
      expect(points).not.toContain('Z')
      const pairs = points.trim().split(/\s+/)
      expect(pairs.length).toBeGreaterThan(0)
      for (const pair of pairs) {
        expect(pair).toMatch(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
      }
    }
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
