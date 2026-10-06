/**
 * Class-name joiner. Replaces the clsx dependency that section 2 forbids.
 * Accepts strings, arrays and { 'class': condition } objects, in any mix.
 *
 *   cn('btn', 'btn-primary', isWide && 'full')
 */
export default function cn(...parts) {
  const out = [];
  for (const part of parts) {
    if (!part) continue;
    if (typeof part === 'string' || typeof part === 'number') {
      if (part !== '') out.push(part);
    } else if (Array.isArray(part)) {
      const inner = cn(...part);
      if (inner) out.push(inner);
    } else if (typeof part === 'object') {
      for (const key of Object.keys(part)) {
        if (part[key]) out.push(key);
      }
    }
  }
  return out.join(' ');
}