// src/utils/version.ts

// "1.2.3" -> [1,2,3]
export const parseVersion = (v: string | null | undefined): number[] => {
  if (!v) return [0, 0, 0];
  return String(v)
    .split('.')
    .map((x) => {
      const n = parseInt(x, 10);
      return Number.isFinite(n) ? n : 0;
    });
};

// return true if a < b
export const isVersionLess = (a: string, b: string): boolean => {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const av = pa[i] ?? 0;
    const bv = pb[i] ?? 0;
    if (av < bv) return true;
    if (av > bv) return false;
  }
  return false;
};
