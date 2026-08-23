import { describe, expect, it } from 'vitest';
import {
  expandPermissionSelection,
  togglePermissionSelection,
} from './employee-permission-dependencies';

describe('employee permission dependencies', () => {
  it('selects the read capability required by flight management', () => {
    expect([...togglePermissionSelection(new Set(), 'fl_manage')].sort()).toEqual([
      'fl_manage',
      'fl_view',
    ]);
  });

  it('selects the complete refund chain for processing', () => {
    expect([...expandPermissionSelection(['rf_process'])].sort()).toEqual([
      'rf_details',
      'rf_list',
      'rf_process',
    ]);
  });

  it('removes dependent management capabilities with a prerequisite', () => {
    const current = new Set(['ct_list', 'ct_process', 'ag_list']);
    expect([...togglePermissionSelection(current, 'ct_list')].sort()).toEqual([
      'ag_list',
    ]);
  });

  it('keeps IT action grants independent from legacy section umbrellas', () => {
    expect([...expandPermissionSelection(['us_list'])].sort()).toEqual([
      'us_list',
    ]);
    expect([...expandPermissionSelection(['us_create'])].sort()).toEqual([
      'us_create',
    ]);
    expect([...expandPermissionSelection(['sv_config'])].sort()).toEqual([
      'sv_config',
      'sv_view',
    ]);
  });
});
