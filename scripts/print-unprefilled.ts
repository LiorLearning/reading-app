import { sampleMCQData } from "../src/data/mcq-questions";
import { getUnprefilledPairs } from "../src/utils/mcq";

const result = getUnprefilledPairs(sampleMCQData);
console.log(JSON.stringify(result, null, 2));


