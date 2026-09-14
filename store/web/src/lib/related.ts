export function pickRelated<T extends { id: string | number; category: string }>(
  current: T,
  all: T[],
  limit = 4,
): T[] {
  const others = all.filter((p) => p.id !== current.id);
  const sameCategory = others.filter((p) => p.category === current.category);
  const otherCategory = others.filter((p) => p.category !== current.category);

  return [...sameCategory, ...otherCategory].slice(0, limit);
}
