import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Business, BusinessUpdate, Me } from '@ct/shared';
import { get, patch } from './api';

/*
 * Data fetching hooks. TanStack Query caches each response by its key and
 * refetches when we "invalidate" a key after a change.
 */

export const keys = {
  me: ['me'] as const,
};

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => get<Me>('/me'), staleTime: 60_000 });
}

/** Convenience: the business (always loaded before pages render). */
export function useBusiness(): Business {
  const { data } = useMe();
  if (!data) throw new Error('useBusiness used before /me loaded');
  return data.business;
}

export function useUpdateBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BusinessUpdate) => patch<Business>('/business', input),
    onSuccess: (business) => {
      qc.setQueryData<Me>(keys.me, (me) => (me ? { ...me, business } : me));
    },
  });
}
