import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
process.loadEnvFile(resolve(__dirname, ".env"));
