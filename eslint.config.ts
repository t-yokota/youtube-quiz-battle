import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**', '.claude/**']),

  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  skipFormatting,

  // no-console: src配下のプロダクションコードでconsole直接使用を禁止
  {
    name: 'app/no-console',
    files: ['src/**/*.{ts,mts,tsx,vue}'],
    rules: {
      'no-console': 'error',
    },
  },

  // logger.ts自身はconsoleを使用するため許可
  {
    name: 'app/logger-allow-console',
    files: ['src/utils/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },
)
