/**
 * Sisih owner CLI entry point: `pnpm sisih <command>` (see src/cli). Works the same in PowerShell
 * and POSIX shells. Owner token: SISIH_OWNER_TOKEN (or DEMO_TOKEN in the repo's .env).
 */
import { env } from "../src/lib/env";
import { main } from "../src/cli/run";

process.exitCode = await main(process.argv.slice(2), { fetch, env, out: (l) => console.log(l), err: (l) => console.error(l) });
