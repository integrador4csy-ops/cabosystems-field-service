import type { WarrantyStatus } from './warrantyApi';

export const warrantyStatusOrder: readonly WarrantyStatus[] = ['registered', 'waiting', 'resolved'];

const warrantyStatusTransitions: Record<WarrantyStatus, readonly WarrantyStatus[]> = {
  registered: ['registered', 'waiting', 'resolved'],
  review: ['registered', 'waiting', 'resolved'],
  waiting: ['waiting', 'resolved'],
  resolved: ['resolved'],
  rejected: ['resolved'],
};

export function canonicalWarrantyStatus(status: WarrantyStatus): WarrantyStatus {
  if (status === 'review') return 'registered';
  if (status === 'rejected') return 'resolved';
  return status;
}

export function allowedWarrantyStatuses(current: WarrantyStatus): readonly WarrantyStatus[] {
  return warrantyStatusTransitions[current];
}

export function isClosedWarrantyStatus(status: WarrantyStatus): boolean {
  return status === 'resolved' || status === 'rejected';
}
