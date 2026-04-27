import 'src/core/global/registerEventHandlers';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { queryClient } from 'src/core/global/queryClient';
import { usePriorityTodoStore } from 'src/core/infrastructure/repositories/PriorityTodoRepository/priorityTodoStore';
import { useReviewStore } from 'src/core/infrastructure/repositories/ReviewRepository/reviewStore';

const { getComputedStyle } = window;
window.getComputedStyle = (elt) => getComputedStyle(elt);
window.HTMLElement.prototype.scrollIntoView = () => {};

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserver;

window.HTMLElement.prototype.scrollTo = vi.fn().mockReturnValue({ x: 0, y: 0 });

beforeEach(() => {
  queryClient.clear();
  usePriorityTodoStore.setState({ dict: {} });
  useReviewStore.setState({ record: undefined });
});
