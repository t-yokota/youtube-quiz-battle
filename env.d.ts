/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/vue" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_QUIZ_DEBUG?: string
  readonly VITE_GA_MEASUREMENT_ID?: string
}
