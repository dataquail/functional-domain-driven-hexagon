// Pure helper for the human-typable user code. Random generation (the impure
// step) lives in the start command; this maps random bytes deterministically
// onto a confusable-free alphabet and formats it `XXXX-XXXX`. Device-code
// hashing reuses `hashToken` from `api-token-token.ts` (same sha256 scheme).

// No 0/O/1/I — they're easy to mistype off a screen.
export const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Maps random `bytes` onto the alphabet via rejection sampling: any byte in
// the biased tail (>= the largest multiple of the alphabet length that fits
// in 256) is discarded, so every symbol stays equally likely regardless of
// the alphabet length. For the current 32-char alphabet 256 is an exact
// multiple, so nothing is ever rejected — but the guard keeps the mapping
// uniform if the alphabet ever changes. Caller must supply enough bytes; the
// start command overdraws so exhaustion can't happen in practice.
export const toUserCode = (bytes: Uint8Array): string => {
  const n = USER_CODE_ALPHABET.length;
  const limit = 256 - (256 % n);
  let chars = "";
  for (let i = 0; i < bytes.length && chars.length < 8; i++) {
    const byte = bytes[i] ?? 0;
    if (byte >= limit) continue;
    chars += USER_CODE_ALPHABET[byte % n];
  }
  if (chars.length < 8) {
    throw new Error("toUserCode: not enough random bytes to build a user code");
  }
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
};
