import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { sampleMCQData } from "../src/data/mcq-questions";
import { getUnprefilledPairs } from "../src/utils/mcq";

async function main() {
  const outFile = resolve(process.cwd(), "src/data/unprefilled-pairs.json");
  const result = getUnprefilledPairs(sampleMCQData);
  await writeFile(outFile, JSON.stringify(result, null, 2), "utf8");
  console.log(`Wrote ${result.length} pairs to ${outFile}`);
}

await main();


