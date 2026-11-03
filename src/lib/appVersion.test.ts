import { describe, expect, it } from 'vitest'
import { isNewerDeploy, readDeployedVersion } from './appVersion'

const file = { version: '1.43.0', commit: 'abc1234', builtAt: '2026-11-04T10:00:00.000Z' }

describe('newer deploy check', () => {
  it('reads a valid version file and ignores anything else (e.g. the app page served instead)', () => {
    expect(readDeployedVersion(file)).toEqual(file)
    expect(readDeployedVersion(null)).toBeNull()
    expect(readDeployedVersion('<!doctype html>')).toBeNull()
    expect(readDeployedVersion({ ...file, builtAt: 'yesterday' })).toBeNull()
  })

  it('says newer only when the deploy was built after this page', () => {
    expect(isNewerDeploy(file, '2026-11-03T10:00:00.000Z')).toBe(true)
    expect(isNewerDeploy(file, '2026-11-04T10:00:00.000Z')).toBe(false)
    // An older file served from a cache never asks for a refresh
    expect(isNewerDeploy(file, '2026-11-05T10:00:00.000Z')).toBe(false)
    expect(isNewerDeploy(null, '2026-11-03T10:00:00.000Z')).toBe(false)
  })
})
