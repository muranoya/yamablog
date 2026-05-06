import uPlot from 'uplot'

export function initElevationChart(el: HTMLElement): void {
  const dJson = el.dataset.distances
  const eJson = el.dataset.elevations
  if (!dJson || !eJson) return

  const distances: number[] = JSON.parse(dJson)
  const elevations: number[] = JSON.parse(eJson)
  if (distances.length === 0) return

  const width = el.clientWidth || 600

  new uPlot(
    {
      width,
      height: 200,
      series: [
        { label: '距離(m)' },
        {
          label: '標高(m)',
          stroke: '#2d6a4f',
          fill: 'rgba(45,106,79,0.15)',
          width: 1.5,
        },
      ],
      axes: [
        { label: '距離 (m)' },
        { label: '標高 (m)' },
      ],
      scales: {
        x: { time: false },
      },
      cursor: {
        drag: { x: false, y: false },
      },
    },
    [distances, elevations],
    el,
  )
}
