const PERMISSION_DEPENDENCIES: Readonly<Record<string, readonly string[]>> = {
  fl_manage: ['fl_view'],
  ct_process: ['ct_list'],
  rf_details: ['rf_list'],
  rf_process: ['rf_list', 'rf_details'],
};

export function expandPermissionSelection(keys: Iterable<string>): Set<string> {
  const expanded = new Set(keys);
  const queue = [...expanded];

  while (queue.length > 0) {
    const key = queue.shift();
    if (!key) continue;
    for (const dependency of PERMISSION_DEPENDENCIES[key] ?? []) {
      if (expanded.has(dependency)) continue;
      expanded.add(dependency);
      queue.push(dependency);
    }
  }

  return expanded;
}

export function togglePermissionSelection(
  current: ReadonlySet<string>,
  permissionKey: string,
): Set<string> {
  if (!current.has(permissionKey)) {
    return expandPermissionSelection([...current, permissionKey]);
  }

  const next = new Set(current);
  for (const selectedKey of current) {
    if (
      selectedKey === permissionKey ||
      expandPermissionSelection([selectedKey]).has(permissionKey)
    ) {
      next.delete(selectedKey);
    }
  }
  return next;
}
