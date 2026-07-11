import { DISEASE_SUMMARIES } from "../lib/clinical-knowledge";
import * as fs from "fs";
import * as path from "path";

const outPath = "C:/Users/narac/Downloads/DischargeX_Automator/knowledge/clinical_knowledge.json";
fs.writeFileSync(outPath, JSON.stringify(DISEASE_SUMMARIES, null, 2));
console.log("Successfully dumped clinical knowledge to " + outPath);
