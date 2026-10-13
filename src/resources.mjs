// Stable resource namespaces; no user-provided role grants access.
export const RESOURCE_IDS = Object.freeze({ notes: 'notes', announcements: 'announcements' });

export function identifyResource(path) {
  if (path === '/api/notes' || path === '/notes') return { resourceId: RESOURCE_IDS.notes, itemId: null };
  const note = /^\/(?:api\/)?notes\/([A-Za-z0-9_-]+)$/u.exec(path);
  if (note && !['export', 'admin', 'search', 'all'].includes(note[1].toLowerCase())) {
    return { resourceId: RESOURCE_IDS.notes, itemId: note[1] };
  }
  if (/^\/(?:api\/)?announcements(?:\/[A-Za-z0-9_-]+)?$/u.test(path)) {
    return { resourceId: RESOURCE_IDS.announcements, itemId: null };
  }
  return null;
}
