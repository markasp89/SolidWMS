import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/core/ui/misc'
import { ActivityReport } from '../components/ActivityReport'
import { OccupancyReport } from '../components/OccupancyReport'
import { RotationReport } from '../components/RotationReport'
import { defaultPeriod } from '../dates'
import type { Period } from '../types'

const TABS = [
  ['occupancy', 'Zajętość sektorów'],
  ['rotation', 'Rotacja towaru'],
  ['activity', 'Aktywność pracowników'],
] as const

type Tab = (typeof TABS)[number][0]

const isTab = (value: string | null): value is Tab => TABS.some(([key]) => key === value)

export function ReportsPage() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: Tab = isTab(requested) ? requested : 'occupancy'
  // Shared by the rotation and activity tabs.
  const [period, setPeriod] = useState<Period>(defaultPeriod)

  return (
    <>
      <PageHeader title="Raporty" subtitle="Zajętość magazynu, rotacja towaru i aktywność zespołu." />
      <div className="tabs rp-tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'is-active' : ''}
            onClick={() => setParams(key === 'occupancy' ? {} : { tab: key }, { replace: true })}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="rp-panel">
        {tab === 'occupancy' && <OccupancyReport />}
        {tab === 'rotation' && <RotationReport period={period} onPeriodChange={setPeriod} />}
        {tab === 'activity' && <ActivityReport period={period} onPeriodChange={setPeriod} />}
      </div>
    </>
  )
}
