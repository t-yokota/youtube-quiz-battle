#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const result = spawnSync('npm', ['run', 'type-check'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf8',
})

if (result.status === 0) process.exit(0)

const stderr = (result.stderr || '') + (result.stdout || '')
process.stderr.write(stderr)
process.exit(2)
