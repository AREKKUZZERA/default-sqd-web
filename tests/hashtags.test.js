import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildHashtagTrends, extractHashtags, normalizeHashtag } from '../src/shared/utils/hashtags.js';

describe('hashtags', () => {
  it('extracts unicode hashtags and normalizes case', () => {
    assert.deepEqual(extractHashtags('Привет #Команда #release_2026 #Продукт'), ['команда', 'release_2026', 'продукт']);
  });

  it('keeps duplicate tags in text extraction so composers can decide how to display them', () => {
    assert.deepEqual(extractHashtags('#SQD #sqd'), ['sqd', 'sqd']);
  });

  it('normalizes noisy values', () => {
    assert.equal(normalizeHashtag('###Hello, World!'), 'hello-world');
  });

  it('builds trends by post count, engagement and tag name', () => {
    const trends = buildHashtagTrends([
      { comments: [{ id: 1 }], likes: 1, replies: 1, reposts: 0, tags: ['beta'] },
      { comments: [], likes: 3, replies: 0, reposts: 1, tags: ['alpha'] },
      { comments: [], likes: 0, replies: 0, reposts: 0, tags: ['beta'] },
    ]);

    assert.deepEqual(trends.map((trend) => trend.tag), ['beta', 'alpha']);
  });
});
