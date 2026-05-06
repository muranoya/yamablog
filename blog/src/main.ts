import './style.css'
import 'leaflet/dist/leaflet.css'
import 'uplot/dist/uPlot.min.css'
import { initArticleGpxMap } from './articleGpxMap'
import { initElevationChart } from './elevationChart'
import { initLightbox } from './lightbox'
import { initMapModal } from './mapModal'
import { initScrollToTop } from './scrollToTop'
import { getSidebarMapData, initSidebarMap } from './sidebarMap'

document.addEventListener('DOMContentLoaded', () => {
  const sidebarMap = document.querySelector<HTMLElement>('#gpx-map[data-map-data-url]')
  if (sidebarMap) {
    const openMapModal = initMapModal(getSidebarMapData)
    initSidebarMap(sidebarMap, openMapModal)
  }

  document
    .querySelectorAll<HTMLElement>('.gpx-map[data-polyline]')
    .forEach(initArticleGpxMap)

  document
    .querySelectorAll<HTMLElement>('.elevation-chart[data-distances]')
    .forEach(initElevationChart)

  initLightbox()
  initScrollToTop()
})
