/**
 * Category hierarchy helpers (pure). Categories store a materialised `path`
 * ("/rootId/childId/") and a `fullSlug` ("electronics/phones") so any depth is
 * supported with indexed lookups and no recursive SQL.
 */
export type TreeNode = { id: string; parentId: string | null; slug: string; position: number };

export function buildPath(parentPath: string | null, id: string) {
  return `${parentPath ?? "/"}${id}/`;
}

export function buildFullSlug(parentFullSlug: string | null, slug: string) {
  return parentFullSlug ? `${parentFullSlug}/${slug}` : slug;
}

export function depthOf(path: string) {
  return path.split("/").filter(Boolean).length - 1;
}

/** Ancestor ids (root first), excluding the node itself. */
export function ancestorIds(path: string) {
  const ids = path.split("/").filter(Boolean);
  return ids.slice(0, -1);
}

/** Moving a node under itself or a descendant would create a cycle. */
export function wouldCreateCycle(nodePath: string, newParentPath: string | null) {
  return newParentPath != null && newParentPath.startsWith(nodePath);
}

export type Tree<T extends TreeNode> = T & { children: Tree<T>[] };

export function toTree<T extends TreeNode>(flat: T[]): Tree<T>[] {
  const map = new Map<string, Tree<T>>();
  for (const n of flat) map.set(n.id, { ...n, children: [] });
  const roots: Tree<T>[] = [];
  for (const n of map.values()) {
    const parent = n.parentId ? map.get(n.parentId) : undefined;
    (parent ? parent.children : roots).push(n);
  }
  const sort = (list: Tree<T>[]) => {
    list.sort((a, b) => a.position - b.position);
    list.forEach((c) => sort(c.children));
  };
  sort(roots);
  return roots;
}

/** Depth-first flatten with depth info, useful for indented selects. */
export function flattenTree<T extends TreeNode>(tree: Tree<T>[], depth = 0): (Tree<T> & { depth: number })[] {
  return tree.flatMap((n) => [{ ...n, depth }, ...flattenTree(n.children, depth + 1)]);
}

/**
 * Rewrite path/fullSlug for a moved subtree. Returns updates for the node and
 * every descendant.
 */
export function rebaseSubtree(
  nodes: { id: string; path: string; fullSlug: string }[],
  oldPath: string,
  newPath: string,
  oldFullSlug: string,
  newFullSlug: string,
) {
  return nodes
    .filter((n) => n.path.startsWith(oldPath))
    .map((n) => ({
      id: n.id,
      path: newPath + n.path.slice(oldPath.length),
      fullSlug: n.fullSlug === oldFullSlug ? newFullSlug : newFullSlug + n.fullSlug.slice(oldFullSlug.length),
      depth: depthOf(newPath + n.path.slice(oldPath.length)),
    }));
}
