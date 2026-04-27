import { ReactNode, JSX } from 'react';
import { getThemeWrapper } from 'src/__test__/getThemeWrapper';
import { ReactQueryTestWrapper } from './ReactQueryTestWrapper';

export const getTestWrapper = (): (({
  children,
}: {
  children: ReactNode;
}) => JSX.Element) => {
  const { ThemeWrapper } = getThemeWrapper();

  return ({ children }: { children: ReactNode }) => (
    <ThemeWrapper>
      <ReactQueryTestWrapper>{children}</ReactQueryTestWrapper>
    </ThemeWrapper>
  );
};
