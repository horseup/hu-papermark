import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canEnterRoom,
  canReadRoomDocument,
  canAccessRoomDiscussion,
} from './access-policy.ts';

const stages = [
  { id: 'intro', teamId: 'horseup', position: 0 },
  { id: 'diligence', teamId: 'horseup', position: 1 },
];
const context = {
  userId: 'investor-a', emailVerified: true,
  room: { id: 'room-a', teamId: 'horseup', stageId: 'intro', archived: false },
  membership: { roomId: 'room-a', userId: 'investor-a', accepted: true, revoked: false },
  stages,
};
const document = { id: 'financials', teamId: 'horseup', minimumStageId: 'diligence' };
const selection = { roomId: 'room-a', documentId: 'financials' };
const promoted = { ...context, room: { ...context.room, stageId: 'diligence' } };

test('promotion reveals selected documents; moving back removes access', () => {
  assert.equal(canReadRoomDocument(context, document, selection), false);
  assert.equal(canReadRoomDocument(promoted, document, selection), true);
  assert.equal(canReadRoomDocument(context, document, selection), false);
});

test('promotion never shares unselected or foreign-room documents', () => {
  assert.equal(canReadRoomDocument(promoted, document, null), false);
  assert.equal(canReadRoomDocument(promoted, document, { ...selection, roomId: 'room-b' }), false);
  assert.equal(canReadRoomDocument(promoted, document, { ...selection, documentId: 'other' }), false);
});

test('cross-team documents and stages cannot grant access', () => {
  assert.equal(canReadRoomDocument(promoted, { ...document, teamId: 'other' }, selection), false);
  assert.equal(canReadRoomDocument({ ...promoted, stages: stages.map(s => ({ ...s, teamId: 'other' })) }, document, selection), false);
});

test('pending, revoked, missing, and mismatched membership deny access', () => {
  for (const membership of [null,
    { ...context.membership, accepted: false },
    { ...context.membership, revoked: true },
    { ...context.membership, roomId: 'room-b' },
    { ...context.membership, userId: 'investor-b' },
  ]) {
    const invalid = { ...promoted, membership };
    assert.equal(canEnterRoom(invalid), false);
    assert.equal(canReadRoomDocument(invalid, document, selection), false);
    assert.equal(canAccessRoomDiscussion(invalid, { roomId: 'room-a', documentId: null }), false);
  }
});

test('unverified sessions and archived rooms deny investor access', () => {
  assert.equal(canEnterRoom({ ...context, userId: null }), false);
  assert.equal(canEnterRoom({ ...context, emailVerified: false }), false);
  assert.equal(canEnterRoom({ ...context, room: { ...context.room, archived: true } }), false);
});

test('missing, invalid, and ambiguous stage settings fail closed', () => {
  assert.equal(canReadRoomDocument(promoted, { ...document, minimumStageId: null }, selection), false);
  assert.equal(canReadRoomDocument(promoted, { ...document, minimumStageId: 'missing' }, selection), false);
  for (const invalidStages of [[], [...stages, stages[1]],
    [...stages, { id: 'duplicate-position', teamId: 'horseup', position: 1 }],
    stages.map(s => ({ ...s, position: NaN })),
    stages.map(s => ({ ...s, position: -1 })),
  ]) assert.equal(canReadRoomDocument({ ...promoted, stages: invalidStages }, document, selection), false);
});

test('room-wide questions are shared with another accepted member of that room', () => {
  const second = { ...context, userId: 'investor-b', membership: { ...context.membership, userId: 'investor-b' } };
  const discussion = { roomId: 'room-a', documentId: null };
  assert.equal(canAccessRoomDiscussion(context, discussion), true);
  assert.equal(canAccessRoomDiscussion(second, discussion), true);
  assert.equal(canAccessRoomDiscussion(second, { ...discussion, roomId: 'room-b' }), false);
});

test('document discussions inherit document visibility and room isolation', () => {
  const discussion = { roomId: 'room-a', documentId: 'financials' };
  assert.equal(canAccessRoomDiscussion(context, discussion, document, selection), false);
  assert.equal(canAccessRoomDiscussion(promoted, discussion, document, selection), true);
  assert.equal(canAccessRoomDiscussion(promoted, discussion), false);
  assert.equal(canAccessRoomDiscussion(promoted, discussion, { ...document, id: 'other' }, selection), false);
  assert.equal(canAccessRoomDiscussion(promoted, { ...discussion, roomId: 'room-b' }, document, selection), false);
});
