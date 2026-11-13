import type { WarrantyStatus } from './warrantyApi';

export const warrantyStatusOrder: readonly WarrantyStatus[] = ['registered', 'review', 'waiting', 'resolved', 'rejected'];

const warrantyStatusTransitions: Record<WarrantyStatus, readonly WarrantyStatus[]> = {
  registered: ['registered', 'review'],
  review: ['review', 'waiting'],
  waiting: ['waiting', 'resolved', 'rejected'],
  resolved: ['resolved'],
  rejected: ['rejected'],
};

export function allowedWarrantyStatuses(current: WarrantyStatus): readonly WarrantyStatus[] {
  return warrantyStatusTransitions[current];
}

export function isClosedWarrantyStatus(status: WarrantyStatus): boolean {
  return status === 'resolved' || status === 'rejected';
}
