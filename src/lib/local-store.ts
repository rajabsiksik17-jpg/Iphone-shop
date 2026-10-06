/**
 * Small, safe wrappers around localStorage for guest-only conveniences
 * (wishlist before sign-in, recently viewed, recent searches). Every access is
 * guarded: private mode / blocked storage simply degrades to "empty".
 */
function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export const guestWishlist = {
  get: () => read<string[]>("nq:wishlist", []),
  toggle(id: string, on: boolean) {
    const list = new Set(read<string[]>("nq:wishlist", []));
    if (on) list.add(id);
    else list.delete(id);
    write("nq:wishlist", [...list].slice(-200));
  },
  clear: () => write("nq:wishlist", []),
};

export const recentlyViewed = {
  get: () => read<string[]>("nq:recent", []),
  push(id: string) {
    const list = read<string[]>("nq:recent", []).filter((x) => x !== id);
    list.unshift(id);
    write("nq:recent", list.slice(0, 12));
  },
};

export const recentSearches = {
  get: () => read<string[]>("nq:searches", []),
  push(q: string) {
    const term = q.trim();
    if (term.length < 2) return;
    const list = read<string[]>("nq:searches", []).filter((x) => x.toLowerCase() !== term.toLowerCase());
    list.unshift(term);
    write("nq:searches", list.slice(0, 6));
  },
  clear: () => write("nq:searches", []),
};
