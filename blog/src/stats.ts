import type { GpxStats } from './types'

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}時間${m}分` : `${m}分`
}

function formatDistance(m: number): string {
  return (m / 1000).toFixed(2) + 'km'
}

export function renderStats(stats: GpxStats): HTMLElement {
  const el = document.createElement('div')
  el.className = 'gpx-stats'

  const row1 = document.createElement('div')
  row1.className = 'gpx-stats-row'

  if (stats.elapsed_seconds != null) {
    const t = document.createElement('span')
    t.className = 'gpx-stat'
    const label = document.createElement('span')
    label.className = 'gpx-stat-label'
    label.textContent = '時間'
    const val = document.createElement('span')
    val.className = 'gpx-stat-value'
    val.textContent = formatElapsed(stats.elapsed_seconds)
    t.appendChild(label)
    t.appendChild(val)
    row1.appendChild(t)
  }

  const dist = document.createElement('span')
  dist.className = 'gpx-stat'
  const distLabel = document.createElement('span')
  distLabel.className = 'gpx-stat-label'
  distLabel.textContent = '距離'
  const distVal = document.createElement('span')
  distVal.className = 'gpx-stat-value'
  distVal.textContent = formatDistance(stats.distance_m)
  dist.appendChild(distLabel)
  dist.appendChild(distVal)
  row1.appendChild(dist)
  el.appendChild(row1)

  const row2 = document.createElement('div')
  row2.className = 'gpx-stats-row'

  const statDefs: [string, number, string][] = [
    ['累積登り', stats.cum_climb_m, 'm'],
    ['累積下り', stats.cum_down_m, 'm'],
    ['最大標高', stats.max_elevation_m, 'm'],
    ['最低標高', stats.min_elevation_m, 'm'],
  ]
  for (const [label, value, unit] of statDefs) {
    const s = document.createElement('span')
    s.className = 'gpx-stat'
    const l = document.createElement('span')
    l.className = 'gpx-stat-label'
    l.textContent = label
    const v = document.createElement('span')
    v.className = 'gpx-stat-value'
    v.textContent = Math.round(value) + unit
    s.appendChild(l)
    s.appendChild(v)
    row2.appendChild(s)
  }
  el.appendChild(row2)

  return el
}
