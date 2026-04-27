import { ReactNode } from 'react';
import { ThemeProvider } from 'src/providers/ThemeProvider';

export const getThemeWrapper = () => {
  return {
    ThemeWrapper: ({ children }: { children: ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    ),
  };
};
