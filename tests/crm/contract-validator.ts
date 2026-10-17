import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

// OpenAPI 3.1 schemas use JSON Schema 2020-12. Validate the actual wire
// responses, not TypeScript assertions or mocks.
const document = JSON.parse(readFileSync("packages/contracts/openapi.json", "utf8"));
const schemas = JSON.parse(JSON.stringify(document.components.schemas).replaceAll("#/components/schemas/", "#/$defs/"));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema({ $id: "elev8-contract", $defs: schemas });

export function matchesContract(name: string, value: unknown) {
  const validate = ajv.getSchema("elev8-contract#/$defs/" + name);
  if (!validate) throw new Error("Missing contract schema: " + name);
  return Boolean(validate(value));
}
