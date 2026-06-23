// Pure helper for the human-typable user code. Random generation (the impure
// step) lives in the start command; this maps random bytes deterministically
// onto a confusable-free alphabet and formats it `XXXX-XXXX`. Device-code
// hashing reuses `hashToken` from `api-token-token.ts` (same sha256 scheme).

// No 0/O/1/I — they're easy to mistype off a screen.
export const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const toUserCode = (bytes: Uint8Array): string => {
  let chars = "";
  for (let i = 0; i < 8; i++) {
    const byte = bytes[i] ?? 0;
    chars += USER_CODE_ALPHABET[byte % USER_CODE_ALPHABET.length];
  }
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
};
