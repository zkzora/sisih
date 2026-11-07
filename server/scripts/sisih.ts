/**
 * Sisih owner CLI entry point: `pnpm sisih <command>` (see src/cli). Works the same in PowerShell
 * and POSIX shells. Owner credential: SISIH_OWNER_TOKEN (or DEMO_TOKEN in the repo's .env on Testnet).
 * Mainnet signing: SISIH_ENV_FILE=.env.mainnet,.env.mainnet.deployment pnpm sisih sign <intent-id> --yes
 */
import { env } from "../src/lib/env";
import { main } from "../src/cli/run";
import { localOwnerSigner } from "../src/cli/signer";

// The owner key is read only if a command signs, from the local config (SISIH_ENV_FILE on Mainnet).
process.exitCode = await main(process.argv.slice(2), { fetch, env, out: (l) => console.log(l), err: (l) => console.error(l), signer: () => localOwnerSigner(env) });
