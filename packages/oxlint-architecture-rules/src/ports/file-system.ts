// Sibling-parity rules ask a question no AST can answer: does this other file
// exist? A port keeps that question testable without a fixture tree on disk.
export type FileSystem = {
  readonly exists: (repoRelativePath: string) => boolean;
};
