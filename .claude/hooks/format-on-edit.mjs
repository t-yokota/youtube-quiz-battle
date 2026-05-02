#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

let raw = ''
for await (const chunk of process.stdin) raw += chunk

let file = ''
try {
  file = JSON.parse(raw).tool_input?.file_path ?? ''
} catch {
  process.exit(0)
}

if (!/\.(vue|ts|tsx)$/.test(file)) process.exit(0)

spawnSync('npx', ['prettier', '--write', file], { stdio: 'ignore' })
spawnSync('npx', ['eslint', '--fix', file], { stdio: 'ignore' })
