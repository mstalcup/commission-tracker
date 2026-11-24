import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Activity,
  Business,
  BusinessUpdate,
  Client,
  ClientInput,
  Commission,
  CommissionInput,
  CommissionPatch,
  Expense,
  Me,
  Payment,
} from '@ct/shared';
import { del, get, patch, post } from './api';

/*
 * Data fetching hooks. TanStack Query caches each response by its key and
 * refetches when we "invalidate" a key after a change.
 */

export const keys = {
  me: ['me'] as const,
  clients: ['clients'] as const,
  client: (id: string) => ['clients', id] as const,
  commissions: ['commissions'] as const,
  commission: (id: string) => ['commissions', id] as const,
  dashboard: ['dashboard'] as const,
  payments: ['payments'] as const,
  expenses: ['expenses'] as const,
};

// ---------------------------------------------------------------- Business

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

// ---------------------------------------------------------------- Clients

export function useClients() {
  return useQuery({ queryKey: keys.clients, queryFn: () => get<Client[]>('/clients') });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: keys.client(id),
    queryFn: () => get<{ client: Client; commissions: Commission[] }>(`/clients/${id}`),
  });
}

/** id → client lookup for showing names next to commissions. */
export function useClientMap(): Map<string, Client> {
  const { data } = useClients();
  return new Map((data ?? []).map((c) => [c.clientId, c]));
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientInput) => post<Client>('/clients', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.clients }),
  });
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ClientInput>) => patch<Client>(`/clients/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.clients }),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del<void>(`/clients/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.clients }),
  });
}

// ---------------------------------------------------------------- Commissions

export interface CommissionDetail {
  commission: Commission;
  payments: Payment[];
  expenses: Expense[];
  activity: Activity[];
}

export function useCommissions() {
  return useQuery({ queryKey: keys.commissions, queryFn: () => get<Commission[]>('/commissions') });
}

export function useCommission(id: string) {
  return useQuery({ queryKey: keys.commission(id), queryFn: () => get<CommissionDetail>(`/commissions/${id}`) });
}

/** Anything that changes money or stages also changes the dashboard. */
function invalidateWork(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: keys.commissions });
  qc.invalidateQueries({ queryKey: keys.dashboard });
  qc.invalidateQueries({ queryKey: keys.clients });
}

export function useCreateCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CommissionInput) => post<Commission>('/commissions', input),
    onSuccess: () => invalidateWork(qc),
  });
}

/**
 * Updates a commission. The list is updated immediately (optimistically) so
 * dragging a card on the board feels instant; it rolls back if the API fails.
 */
export function useUpdateCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CommissionPatch }) => patch<Commission>(`/commissions/${id}`, input),
    onMutate: async ({ id, input }) => {
      await qc.cancelQueries({ queryKey: keys.commissions, exact: true });
      const previous = qc.getQueryData<Commission[]>(keys.commissions);
      qc.setQueryData<Commission[]>(keys.commissions, (list) =>
        list?.map((c) => (c.commissionId === id ? ({ ...c, ...input } as Commission) : c)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(keys.commissions, context.previous);
    },
    onSettled: (_data, _err, { id }) => {
      invalidateWork(qc);
      qc.invalidateQueries({ queryKey: keys.commission(id) });
    },
  });
}

export function useDeleteCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del<void>(`/commissions/${id}`),
    onSuccess: () => {
      invalidateWork(qc);
      qc.invalidateQueries({ queryKey: keys.payments });
      qc.invalidateQueries({ queryKey: keys.expenses });
    },
  });
}
