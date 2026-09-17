import { unzipSync } from "fflate";
import { MAX_CHALK_BYTES } from "./chalk-results";

export function readChalkFile(name: string, bytes: Uint8Array): string {
  if (bytes.length > MAX_CHALK_BYTES)
    throw new Error("Choose a CSV or ZIP no larger than 5 MB.");
  let csv = bytes;
  if (/\.zip$/i.test(name)) {
    let count = 0;
    const files = unzipSync(bytes, {
      filter: (entry) => {
        if (
          !/(^|\/)results\.csv$/i.test(entry.name) ||
          entry.name.startsWith("__MACOSX/")
        )
          return false;
        count++;
        if (count > 1)
          throw new Error(
            "The ZIP contains multiple results.csv files. Choose one CSV instead.",
          );
        if (entry.originalSize > MAX_CHALK_BYTES)
          throw new Error("The expanded CSV must be 5 MB or smaller.");
        return true;
      },
    });
    if (count !== 1)
      throw new Error("The ZIP must contain one results.csv file.");
    csv = Object.values(files)[0];
  } else if (!/\.csv$/i.test(name))
    throw new Error("Choose a Chalk It Pro CSV or ZIP export.");
  if (csv.length > MAX_CHALK_BYTES)
    throw new Error("The expanded CSV must be 5 MB or smaller.");
  return new TextDecoder("utf-8", { fatal: true }).decode(csv);
}
