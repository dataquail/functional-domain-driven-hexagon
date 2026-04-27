import { QueryClientProvider as ReactQueryClientProvider } from '@tanstack/react-query';
import { queryClient } from 'src/core/global/queryClient';

type OwnProps = {
  children: React.ReactNode;
};

export const ReactQueryTestWrapper = ({ children }: OwnProps) => {
  queryClient.setDefaultOptions({
    queries: {
      // ✅ turns retries off
      retry: false,
      staleTime: Infinity,
    },
  });

  return (
    <ReactQueryClientProvider client={queryClient}>
      {children}
    </ReactQueryClientProvider>
  );
};
