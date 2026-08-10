import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { installViewportHeightSync } from './utils/viewportHeight'

const stopViewportHeightSync = installViewportHeightSync()

if (import.meta.hot) import.meta.hot.dispose(stopViewportHeightSync)

const app = createApp(App)

app.use(createPinia())

app.mount('#app')
