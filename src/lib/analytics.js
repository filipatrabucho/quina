// Google Analytics 4. O script é posto no <head> pelo build (só em produção);
// aqui só se enviam as páginas vistas e os eventos dos jogos.
export const GA_ID = 'G-W28QZ5ZBHF'

export function track(event, params = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  try {
    window.gtag('event', event, params)
  } catch {
    // nunca deixa as estatísticas partir o site
  }
}

export function trackPageView(path, title) {
  track('page_view', { page_location: window.location.origin + path, page_path: path, page_title: title })
}
