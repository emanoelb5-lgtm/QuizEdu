import fs from "node:fs";
import path from "node:path";
if (process.env.RUNNER_TEMP) fs.rmSync(path.join(process.env.RUNNER_TEMP,"quizedu-signing"),{recursive:true,force:true});
