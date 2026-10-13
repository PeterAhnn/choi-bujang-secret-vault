export const RESOURCE_IDS = Object.freeze({ notes: 'notes', announcements: 'announcements' });

// Identify the resource namespace only. This does not grant access to a resource.
export function identifyResource(path) {
  if (typeof path !== 'string') return null;
  const match = /^\/(?:api\/)?(notes|announcements)(?:\/([A-Za-z0-9_-]+))?$/u.exec(path);
  if (!match) return null;
  return Object.freeze({ resourceId: RESOURCE_IDS[match[1]], itemId: match[2] ?? null });
}
