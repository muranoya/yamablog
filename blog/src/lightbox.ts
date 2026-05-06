export function initLightbox(): void {
  const triggers = Array.from(
    document.querySelectorAll<HTMLImageElement>('img.lightbox-trigger'),
  )
  if (triggers.length === 0) return

  const overlay = document.createElement('div')
  overlay.id = 'lightbox'

  const backdrop = document.createElement('div')
  backdrop.className = 'lb-backdrop'

  const lbImg = document.createElement('img')
  lbImg.className = 'lb-img'
  lbImg.alt = ''

  const lbScroll = document.createElement('div')
  lbScroll.className = 'lb-scroll'
  const lbImgOrig = document.createElement('img')
  lbImgOrig.className = 'lb-img-orig'
  lbImgOrig.alt = ''
  lbScroll.appendChild(lbImgOrig)

  const closeBtn = document.createElement('button')
  closeBtn.className = 'lb-close'
  closeBtn.setAttribute('aria-label', '閉じる')
  closeBtn.textContent = '×'

  const zoomBtn = document.createElement('button')
  zoomBtn.className = 'lb-zoom'
  zoomBtn.setAttribute('aria-label', '原寸表示')
  zoomBtn.textContent = '⊕'

  const prevBtn = document.createElement('button')
  prevBtn.className = 'lb-prev'
  prevBtn.setAttribute('aria-label', '前の画像')
  prevBtn.textContent = '‹'

  const nextBtn = document.createElement('button')
  nextBtn.className = 'lb-next'
  nextBtn.setAttribute('aria-label', '次の画像')
  nextBtn.textContent = '›'

  overlay.appendChild(backdrop)
  overlay.appendChild(closeBtn)
  overlay.appendChild(zoomBtn)
  overlay.appendChild(prevBtn)
  overlay.appendChild(lbImg)
  overlay.appendChild(lbScroll)
  overlay.appendChild(nextBtn)
  document.body.appendChild(overlay)

  let currentIdx = 0
  let isZoomed = false
  let dragActive = false
  let dragStartX = 0
  let dragStartY = 0
  let dragScrollLeft = 0
  let dragScrollTop = 0

  lbScroll.addEventListener('mousedown', e => {
    if (e.button !== 0) return
    dragActive = true
    dragStartX = e.clientX
    dragStartY = e.clientY
    dragScrollLeft = lbScroll.scrollLeft
    dragScrollTop = lbScroll.scrollTop
    lbScroll.style.cursor = 'grabbing'
    e.preventDefault()
  })
  document.addEventListener('mousemove', e => {
    if (!dragActive) return
    lbScroll.scrollLeft = dragScrollLeft - (e.clientX - dragStartX)
    lbScroll.scrollTop = dragScrollTop - (e.clientY - dragStartY)
  })
  document.addEventListener('mouseup', () => {
    if (!dragActive) return
    dragActive = false
    lbScroll.style.cursor = 'grab'
  })

  function setMode(zoomed: boolean): void {
    isZoomed = zoomed
    lbImg.style.display = zoomed ? 'none' : 'block'
    lbScroll.style.display = zoomed ? 'block' : 'none'
    zoomBtn.textContent = zoomed ? '⊖' : '⊕'
    zoomBtn.setAttribute('aria-label', zoomed ? '画面に合わせる' : '原寸表示')
  }

  function show(idx: number): void {
    currentIdx = idx
    const src = triggers[idx].dataset.originalSrc ?? triggers[idx].src
    const alt = triggers[idx].alt
    lbImg.src = src
    lbImg.alt = alt
    lbImgOrig.src = src
    lbImgOrig.alt = alt
    setMode(false)
    overlay.classList.add('active')
    document.body.style.overflow = 'hidden'
    prevBtn.style.visibility = idx > 0 ? 'visible' : 'hidden'
    nextBtn.style.visibility = idx < triggers.length - 1 ? 'visible' : 'hidden'
  }

  function close(): void {
    overlay.classList.remove('active')
    document.body.style.overflow = ''
  }

  function showSrc(src: string, alt: string): void {
    lbImg.src = src
    lbImg.alt = alt
    lbImgOrig.src = src
    lbImgOrig.alt = alt
    setMode(false)
    overlay.classList.add('active')
    document.body.style.overflow = 'hidden'
    prevBtn.style.visibility = 'hidden'
    nextBtn.style.visibility = 'hidden'
    currentIdx = -1
  }

  triggers.forEach((t, i) => t.addEventListener('click', () => show(i)))
  backdrop.addEventListener('click', close)
  closeBtn.addEventListener('click', close)
  zoomBtn.addEventListener('click', () => setMode(!isZoomed))
  prevBtn.addEventListener('click', () => {
    if (currentIdx > 0) show(currentIdx - 1)
  })
  nextBtn.addEventListener('click', () => {
    if (currentIdx < triggers.length - 1) show(currentIdx + 1)
  })
  document.addEventListener('keydown', e => {
    if (!overlay.classList.contains('active')) return
    if (e.key === 'Escape') close()
    if (e.key === 'ArrowLeft' && currentIdx > 0) show(currentIdx - 1)
    if (e.key === 'ArrowRight' && currentIdx < triggers.length - 1) show(currentIdx + 1)
  })

  document.addEventListener('click', e => {
    const t = e.target
    if (!(t instanceof HTMLImageElement) || !t.classList.contains('pin-popup-thumb')) return
    const src = t.dataset.lightboxSrc ?? t.src
    showSrc(src, t.alt)
  })
}
