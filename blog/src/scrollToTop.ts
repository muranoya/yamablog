export function initScrollToTop(): void {
  if (!document.querySelector('article')) return

  const btn = document.createElement('button')
  btn.id = 'scroll-to-top'
  btn.setAttribute('aria-label', 'ページトップへ戻る')
  btn.textContent = '↑'
  document.body.appendChild(btn)

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400)
  }, { passive: true })

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })
}
