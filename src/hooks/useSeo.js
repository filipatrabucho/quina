import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { seoFor, SITE_URL } from '../data/seo.js'

function setMeta(selector, attr, value) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement(selector.startsWith('link') ? 'link' : 'meta')
    const [, key, name] = selector.match(/\[(\w+)="([^"]+)"\]/)
    el.setAttribute(key, name)
    document.head.appendChild(el)
  }
  el.setAttribute(attr, value)
}

// Atualiza o título, a descrição e o canonical quando se muda de página.
export function useSeo() {
  const { pathname } = useLocation()
  useEffect(() => {
    const s = seoFor(pathname)
    document.title = s.title
    setMeta('meta[name="description"]', 'content', s.description)
    setMeta('link[rel="canonical"]', 'href', SITE_URL + (s.path === '/' ? '/' : s.path))
    setMeta('meta[property="og:title"]', 'content', s.title)
    setMeta('meta[property="og:description"]', 'content', s.description)
    setMeta('meta[property="og:url"]', 'content', SITE_URL + s.path)
    setMeta('meta[name="robots"]', 'content', s.noindex ? 'noindex, follow' : 'index, follow')
  }, [pathname])
}
