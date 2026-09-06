declare module 'https://aistudiocdn.com/react@^19.2.0' {
  const React: typeof import('react');
  export default React;
}

declare module 'https://esm.sh/@react-pdf/renderer@4.1.6?bundle&external=react,react-dom' {
  export const Page: import('react').ComponentType<any>;
  export const Text: import('react').ComponentType<any>;
  export const View: import('react').ComponentType<any>;
  export const Document: import('react').ComponentType<any>;
  export const StyleSheet: { create<T extends Record<string, unknown>>(styles: T): T };
  export const Font: { register(options: Record<string, unknown>): void };
  export const pdf: (document: import('react').ReactElement) => { toBlob(): Promise<Blob> };
}
