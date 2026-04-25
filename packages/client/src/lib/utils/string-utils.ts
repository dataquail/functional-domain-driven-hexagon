import * as Array from "effect/Array";
import { flow, pipe } from "effect/Function";
import * as Option from "effect/Option";
import * as String from "effect/String";

/**
 * Generates initials from a given name.
 *
 * @param {string | null | undefined} name - The name to generate initials from.
 * @returns {string} The initials (up to 2 characters) derived from the name, or "?" if the input is null, undefined, or empty.
 * @example
 * getNameInitials("John Doe") // Returns "JD"
 * getNameInitials("Alice") // Returns "A"
 * getNameInitials(null) // Returns "?"
 */
export const getNameInitials = (name: string | null | undefined): string => {
  return pipe(
    name === "" ? null : name,
    Option.fromNullable,
    Option.map(
      flow(
        String.split(" "),
        Array.filter((word) => word.length > 0),
        Array.take(2),
        Array.map((word) => word[0]?.toUpperCase() ?? ""),
        Array.join(""),
      ),
    ),
    Option.getOrElse(() => "?"),
  );
};

/**
 * Normalizes a string by removing diacritics, converting to lowercase, and performing additional normalization.
 * This function is useful for creating searchable or comparable versions of strings,
 * especially when dealing with text that may contain special characters or accents.
 *
 * @param {string} str - The input string to be normalized.
 * @returns {string} The normalized string.
 *
 * @example
 * normalizeString("Año") // Returns "ano"
 * normalizeString("Café") // Returns "cafe"
 * normalizeString("Größe") // Returns "grosse"
 */
export const normalizeString = flow(
  String.normalize("NFKD"),
  String.replace(/[\u0300-\u036f]/g, ""), // Remove combining diacritical marks
  String.toLowerCase,
  String.replace(/[æœ]/g, "ae"),
  String.replace(/ø/g, "o"),
  String.replace(/ß/g, "ss"),
);

/**
 * Formats the message by replacing double newlines with a space and removing asterisks around words.
 *
 * @param {string} message - The message to format.
 * @returns {string} The formatted message.
 * @example
 * stripMessageFormatting("Hello\\n\\nWorld") // Returns "Hello World"
 * stripMessageFormatting("*Hello* World") // Returns "Hello World"
 */
export const stripMessageFormatting = flow(
  String.replace(/\\n\\n/g, " "),
  String.replace(/\*(.*?)\*/g, "$1"),
);
