import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getDisplayRole, getPermissions, hasModerationPermission } from '../src/shared/utils/permissions.js';

describe('permissions', () => {
  it('moves legacy moderation roles into permission badges', () => {
    const profile = { role: 'Administrator', permissions: ['owner', 'mod'] };

    assert.deepEqual(getPermissions(profile), ['owner', 'admin', 'moderator']);
    assert.equal(getDisplayRole(profile), 'Member');
  });

  it('keeps normal profile titles separate from permission badges', () => {
    const profile = { role: 'Designer', permissions: ['creator'] };

    assert.deepEqual(getPermissions(profile), ['creator']);
    assert.equal(getDisplayRole(profile), 'Designer');
  });

  it('grants moderation access only through known permission badges', () => {
    assert.equal(hasModerationPermission({ permissions: ['admin'] }), true);
    assert.equal(hasModerationPermission({ permissions: ['creator'] }), true);
    assert.equal(hasModerationPermission({ role: 'Designer' }), false);
  });
});
