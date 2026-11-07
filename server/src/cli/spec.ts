/**
 * The owner CLI's command table. Parsing (parse.ts) only reads this table; nothing here touches
 * the network. `mutates` marks commands that change state: those need the owner token and are
 * the only ones that ever send a POST/PATCH.
 */
export type FlagKind = "bool" | "string" | "amount" | "int";

export interface CommandSpec {
  path: string[];
  args: string[]; // required positionals, in order (names show in usage)
  flags: Record<string, FlagKind>;
  required?: string[]; // required flags
  mutates: boolean;
  summary: string;
  group: "Inspect" | "Configure" | "Decide" | "Agent permission" | "Session" | "Owner signing" | "Evidence" | "Demo (testnet demo plumbing)";
}

export const GLOBAL_FLAGS: Record<string, FlagKind> = { json: "bool", url: "string", hold: "bool", help: "bool", yes: "bool" };

export const COMMANDS: CommandSpec[] = [
  { path: ["status"], args: [], flags: {}, mutates: false, summary: "Budget, commitments, agent permission, held requests and preferences", group: "Inspect" },
  { path: ["commitments"], args: [], flags: {}, mutates: false, summary: "List commitments with their ids, targets and reserves", group: "Inspect" },
  { path: ["requests"], args: [], flags: { held: "bool" }, mutates: false, summary: "List the agent's payment requests (--held: only those waiting for you)", group: "Inspect" },
  { path: ["request"], args: ["request-id"], flags: {}, mutates: false, summary: "One request: decision, reasons, payment receipts", group: "Inspect" },
  { path: ["prefs"], args: [], flags: {}, mutates: false, summary: "Remembered preferences (rules rebuilt from Walrus Memory)", group: "Inspect" },
  { path: ["limits"], args: [], flags: {}, mutates: false, summary: "The agent's onchain spending limits", group: "Inspect" },
  { path: ["suggestions"], args: [], flags: {}, mutates: false, summary: "Open reserve suggestions from bill outcomes", group: "Inspect" },

  { path: ["commitment", "add"], args: [], flags: { name: "string", payee: "string", amount: "amount", once: "bool", usage: "bool", important: "bool", cadence: "string" }, required: ["name", "payee", "amount"], mutates: true, summary: "Add a commitment (reserved before the agent can spend)", group: "Configure" },
  { path: ["reserve", "set"], args: ["commitment-id", "amount"], flags: {}, mutates: true, summary: "Change a commitment's reserve target", group: "Configure" },
  { path: ["limits", "set"], args: [], flags: { "per-request": "amount", "per-day": "amount", days: "int" }, required: ["per-request", "per-day"], mutates: true, summary: "Set the agent's per-request and per-day caps and permission length", group: "Configure" },
  { path: ["threshold", "set"], args: ["amount"], flags: {}, mutates: true, summary: "Automatic approval threshold for merchants without a rule", group: "Configure" },
  { path: ["prefs", "add"], args: ["allow|deny", "merchant"], flags: { max: "amount", days: "int" }, required: ["max"], mutates: true, summary: "Remember a merchant preference (allow or deny up to an amount)", group: "Configure" },
  { path: ["prefs", "disable"], args: ["rule-id"], flags: {}, mutates: true, summary: "Disable a preference (writes a rule_disabled memory)", group: "Configure" },
  { path: ["prefs", "enable"], args: ["rule-id"], flags: {}, mutates: true, summary: "Enable a preference again", group: "Configure" },

  { path: ["approve"], args: ["request-id"], flags: { remember: "bool", max: "amount", days: "int" }, mutates: true, summary: "Approve a held request; the same request is paid exactly once (--remember: save a preference)", group: "Decide" },
  { path: ["deny"], args: ["request-id"], flags: { remember: "bool", max: "amount", days: "int" }, mutates: true, summary: "Deny a held request; nothing is paid (--remember: save a preference)", group: "Decide" },
  { path: ["suggestions", "accept"], args: ["suggestion-id"], flags: {}, mutates: true, summary: "Accept a reserve suggestion (changes the reserve onchain)", group: "Decide" },
  { path: ["suggestions", "reject"], args: ["suggestion-id"], flags: {}, mutates: true, summary: "Reject a reserve suggestion (remembered)", group: "Decide" },

  { path: ["pause"], args: [], flags: {}, mutates: true, summary: "Pause the agent: the vault refuses every release", group: "Agent permission" },
  { path: ["resume"], args: [], flags: {}, mutates: true, summary: "Resume the agent", group: "Agent permission" },
  { path: ["revoke"], args: [], flags: {}, mutates: true, summary: "Revoke the agent's permission (grant again with limits set)", group: "Agent permission" },

  { path: ["session", "next"], args: [], flags: {}, mutates: true, summary: "Start the next session (rules rebuilt from Walrus recall)", group: "Session" },
  { path: ["credential", "agent"], args: [], flags: {}, mutates: true, summary: "Show the spending agent's credential privately (Testnet demo; owner only)", group: "Session" },

  { path: ["sign"], args: ["intent-id"], flags: { yes: "bool" }, mutates: true, summary: "Check an owner intent against your local config and sign it with your local owner key (--yes to sign)", group: "Owner signing" },
  { path: ["intent"], args: ["intent-id"], flags: {}, mutates: false, summary: "Show an owner intent and its status", group: "Owner signing" },
  { path: ["reconcile"], args: ["intent-id"], flags: {}, mutates: true, summary: "Look up an intent with an unknown outcome through Tatum (never re-signs)", group: "Owner signing" },
  { path: ["release"], args: [], flags: {}, mutates: true, summary: "Hand the shared demo run back to the next visitor or agent", group: "Session" },

  { path: ["evidence"], args: [], flags: {}, mutates: false, summary: "Recent verified transactions and stored memories", group: "Evidence" },
  { path: ["evidence", "tx"], args: [], flags: {}, mutates: false, summary: "All recorded transactions with Tatum verification and explorer links", group: "Evidence" },
  { path: ["evidence", "memories"], args: [], flags: {}, mutates: false, summary: "Memories in the active namespace with Walrus blob IDs and links", group: "Evidence" },
  { path: ["tx"], args: ["digest"], flags: {}, mutates: false, summary: "One transaction as verified through Tatum, with its events", group: "Evidence" },

  { path: ["demo", "reset"], args: [], flags: { yes: "bool" }, required: ["yes"], mutates: true, summary: "Reset the shared testnet demo (new namespace, reseeded vault); needs --yes", group: "Demo (testnet demo plumbing)" },
  { path: ["demo", "cycle"], args: [], flags: {}, mutates: true, summary: "Advance the billing cycle: simulated income, pay due bills, fund reserves", group: "Demo (testnet demo plumbing)" },
  { path: ["demo", "deposit"], args: ["amount"], flags: {}, mutates: true, summary: "Deposit testnet USDC from the demo owner (up to 1.00)", group: "Demo (testnet demo plumbing)" },
];

export const VERSION = "1.1.0";
