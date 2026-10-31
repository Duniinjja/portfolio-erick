import { createApp } from 'vue'
import App from './App.vue'

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// As entradas animadas só escondem o conteúdo quando o movimento está liberado.
if (!reduced) {
    document.documentElement.classList.add('js-motion')
}

// Rolagem suave só nos links internos; o foco do teclado continua instantâneo.
document.addEventListener('click', (event) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]')
    const target = link && document.getElementById(link.hash.slice(1))
    if (!target) return
    event.preventDefault()
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })
    history.replaceState(null, '', link.hash)
})

createApp(App).mount('#app')
