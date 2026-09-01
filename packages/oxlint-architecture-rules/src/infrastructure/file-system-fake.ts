import type { FileSystem } from "../ports/file-system.js";

export const makeFileSystemFake = (present: Iterable<string>): FileSystem => {
  const paths = new Set(present);
  return { exists: (repoRelativePath) => paths.has(repoRelativePath) };
};
