/**
 * Capabilities that require lower-level read capabilities to render and work.
 *
 * The dependency is persisted for new/updated employees, while the guard also
 * honours it for accounts created before this rule existed. This keeps the
 * menu, page data and mutation endpoints aligned without widening writes.
 */
export const EMPLOYEE_PERMISSION_DEPENDENCIES: Readonly<
  Record<string, readonly string[]>
> = {
  fl_manage: ['fl_view'],
  ct_process: ['ct_list'],
  rf_details: ['rf_list'],
  rf_process: ['rf_list', 'rf_details'],
};

export function expandEmployeePermissionKeys(
  permissionKeys: readonly string[],
): string[] {
  const expanded = new Set(permissionKeys);
  const queue = [...permissionKeys];

  while (queue.length > 0) {
    const key = queue.shift();
    if (!key) continue;
    for (const dependency of EMPLOYEE_PERMISSION_DEPENDENCIES[key] ?? []) {
      if (expanded.has(dependency)) continue;
      expanded.add(dependency);
      queue.push(dependency);
    }
  }

  return [...expanded];
}

/** Grants which implicitly satisfy a required capability (including itself). */
export function grantsSatisfyingEmployeePermission(
  requiredKey: string,
): string[] {
  return [
    requiredKey,
    ...Object.keys(EMPLOYEE_PERMISSION_DEPENDENCIES).filter((grantKey) =>
      expandEmployeePermissionKeys([grantKey]).includes(requiredKey),
    ),
  ];
}

/** Removing a prerequisite also removes capabilities that depend on it. */
export function dependentEmployeePermissionKeys(
  permissionKey: string,
): string[] {
  return [
    permissionKey,
    ...Object.keys(EMPLOYEE_PERMISSION_DEPENDENCIES).filter((candidateKey) =>
      expandEmployeePermissionKeys([candidateKey]).includes(permissionKey),
    ),
  ];
}
