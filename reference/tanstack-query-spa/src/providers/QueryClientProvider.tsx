import { ReactNode } from 'react';
import { QueryClientProvider as ReactQueryClientProvider } from '@tanstack/react-query';
import { queryClient } from 'src/core/global/queryClient';

type OwnProps = {
  children: ReactNode;
};

export const QueryClientProvider = ({ children }: OwnProps) => {
  return (
    <ReactQueryClientProvider client={queryClient}>
      {children}
    </ReactQueryClientProvider>
  );
};
