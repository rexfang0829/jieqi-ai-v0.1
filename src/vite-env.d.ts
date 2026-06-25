declare namespace JSX {
  interface IntrinsicElements {
    textarea: {
      value?: string;
      onChange?: (event: { target: { value: string } }) => void;
      placeholder?: string;
      [prop: string]: unknown;
    };
    [elemName: string]: any;
  }
}

declare module '*.css';

declare module 'react' {
  export type StateSetter<T> = (value: T | ((previous: T) => T)) => void;
  export function useState<T>(initial: T | (() => T)): [T, StateSetter<T>];
  export function useMemo<T>(factory: () => T, deps: unknown[]): T;
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useRef<T>(initial: T): { current: T };
  export type MouseEvent<T = Element> = globalThis.MouseEvent & { currentTarget: T };
  export type PointerEvent<T = Element> = globalThis.PointerEvent & { currentTarget: T };

  const React: any;
  export default React;
}

declare module 'react/jsx-runtime' {
  export const Fragment: unknown;
  export function jsx(type: unknown, props: unknown, key?: unknown): unknown;
  export function jsxs(type: unknown, props: unknown, key?: unknown): unknown;
}

declare module 'react-dom/client' {
  export function createRoot(container: Element | DocumentFragment): {
    render(children: unknown): void;
  };
}
