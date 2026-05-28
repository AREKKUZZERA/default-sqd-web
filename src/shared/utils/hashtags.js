const hashtagPattern = /(^|[^\p{L}\p{N}_-])#([\p{L}\p{N}][\p{L}\p{N}_-]{0,31})/giu;

export function normalizeHashtag(value) {
  return value
    .trim()
    .replace(/^#+/, '')
    .replace(/[^\p{L}\p{N}_-]+/giu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function extractHashtags(text) {
  return Array.from(text.matchAll(hashtagPattern), (match) => normalizeHashtag(match[2])).filter(Boolean);
}

export function parseHashtagInput(input) {
  return input
    .split(/[\s,]+/)
    .map(normalizeHashtag)
    .filter(Boolean);
}

export function collectHashtags({ input = '', text = '' }) {
  return Array.from(new Set([...extractHashtags(text), ...parseHashtagInput(input)]));
}

export function buildHashtagTrends(posts) {
  const stats = new Map();

  posts.forEach((post) => {
    const tags = post.tags?.length ? post.tags : [post.tag].filter(Boolean);

    tags.forEach((tag) => {
      const normalizedTag = normalizeHashtag(tag);

      if (!normalizedTag) {
        return;
      }

      const current = stats.get(normalizedTag) ?? { engagement: 0, posts: 0, tag: normalizedTag };
      current.posts += 1;
      current.engagement += (post.likes ?? 0) + (post.reposts ?? 0) + (post.replies ?? 0) + (post.comments?.length ?? 0);
      stats.set(normalizedTag, current);
    });
  });

  return Array.from(stats.values())
    .sort((first, second) => second.posts - first.posts || second.engagement - first.engagement || first.tag.localeCompare(second.tag))
    .map((trend) => ({
      count: `${trend.posts} ${trend.posts === 1 ? 'пост' : 'постов'} / ${trend.engagement} реакций`,
      label: `#${trend.tag}`,
      tag: trend.tag,
    }));
}
