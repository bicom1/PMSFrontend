import { useEffect, useState } from 'react';
import { keepPreviousData, QueryClient, useQuery } from '@tanstack/react-query';
import { api } from './api.js';
import { errorMessage } from '../utils/format.js';
import { useToast } from '../components/common/ui.jsx';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useQueryError(error) {
  const toast = useToast();
  useEffect(() => {
    if (error) toast.error(errorMessage(error));
  }, [error, toast]);
}

export function useApiQuery(queryKey, url, params, options = {}) {
  return useQuery({
    queryKey,
    queryFn: ({ signal }) => api.get(url, params, { signal }),
    ...options,
  });
}

export function usePagedQuery(queryKey, url, params, options = {}) {
  return useApiQuery(queryKey, url, params, { placeholderData: keepPreviousData, ...options });
}
