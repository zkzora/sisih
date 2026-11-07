/**
 * Pure argument parsing for the owner CLI. Returns what to do (help, version, a command) or a
 * usage error; it never reads the network, so help, version, malformed and missing arguments
 * cannot start a transaction.
 */
import { COMMANDS, GLOBAL_FLAGS, type CommandSpec, type FlagKind } from "./spec";

export type Parsed =
  | { kind: "help"; topic?: CommandSpec }
  | { kind: "version" }
  | { kind: "usage_error"; message: string; topic?: CommandSpec }
  | { kind: "command"; spec: CommandSpec; args: string[]; flags: Record<string, string | boolean>; json: boolean; url?: string; hold: boolean };

/** "1.50" -> "1500000" (USDC base units, at most 6 decimals, positive). */
export function toBaseUnits(v: string): string | null {
  const m = /^(\d{1,6})(?:\.(\d{1,6}))?$/.exec(v.trim());
  if (!m) return null;
  const units = BigInt(m[1]!) * 1_000_000n + BigInt((m[2] ?? "").padEnd(6, "0") || "0");
  return units > 0n ? units.toString() : null;
}

const VALUE_FLAGS = new Set(
  [...Object.entries(GLOBAL_FLAGS), ...COMMANDS.flatMap((c) => Object.entries(c.flags))].filter(([, k]) => k !== "bool").map(([n]) => n),
);

function findSpec(tokens: string[]): { spec: CommandSpec; rest: string[] } | null {
  // Command words are the tokens that are neither options nor an option's value.
  const words: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.startsWith("-")) {
      if (!t.includes("=") && VALUE_FLAGS.has(t.replace(/^-+/, ""))) i++;
      continue;
    }
    words.push(t);
  }
  let best: CommandSpec | null = null;
  for (const s of COMMANDS) if (s.path.every((p, i) => words[i] === p) && (!best || s.path.length > best.path.length)) best = s;
  if (!best) return null;
  // Remove the command words (first occurrences, in order) and keep everything else.
  const rest = [...tokens];
  for (const p of best.path) rest.splice(rest.indexOf(p), 1);
  return { spec: best, rest };
}

function checkValue(kind: FlagKind, name: string, raw: string | true): { ok: true; value: string | boolean } | { ok: false; message: string } {
  if (kind === "bool") return raw === true ? { ok: true, value: true } : { ok: false, message: `--${name} takes no value` };
  if (raw === true) return { ok: false, message: `--${name} needs a value` };
  if (kind === "amount") {
    const u = toBaseUnits(raw);
    return u ? { ok: true, value: u } : { ok: false, message: `--${name} must be a positive USDC amount such as 1.50` };
  }
  if (kind === "int") return /^\d{1,3}$/.test(raw) ? { ok: true, value: raw } : { ok: false, message: `--${name} must be a whole number` };
  return { ok: true, value: raw };
}

export function parseArgs(argv: string[]): Parsed {
  if (argv.length === 0 || argv[0] === "help") {
    const topic = argv.length > 1 ? findSpec(argv.slice(1))?.spec : undefined;
    return { kind: "help", topic };
  }
  if (argv.includes("--version") || argv[0] === "version") return { kind: "version" };
  const found = findSpec(argv);
  if (!found) return argv.includes("--help") || argv.includes("-h") ? { kind: "help" } : { kind: "usage_error", message: `Unknown command "${argv.filter((a) => !a.startsWith("-")).join(" ")}".` };
  const { spec, rest } = found;
  if (rest.includes("--help") || rest.includes("-h")) return { kind: "help", topic: spec };

  const allFlags = { ...GLOBAL_FLAGS, ...spec.flags };
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i]!;
    if (!t.startsWith("--")) {
      positionals.push(t);
      continue;
    }
    const [name, inline] = t.slice(2).split(/=(.*)/s, 2) as [string, string | undefined];
    const kind = allFlags[name];
    if (!kind) return { kind: "usage_error", message: `Unknown option --${name}.`, topic: spec };
    let raw: string | true = true;
    if (inline !== undefined) raw = inline;
    else if (kind !== "bool") {
      const next = rest[i + 1];
      if (next === undefined || next.startsWith("--")) return { kind: "usage_error", message: `--${name} needs a value.`, topic: spec };
      raw = next;
      i++;
    }
    const checked = checkValue(kind, name, raw);
    if (!checked.ok) return { kind: "usage_error", message: checked.message, topic: spec };
    flags[name] = checked.value;
  }
  if (positionals.length < spec.args.length) return { kind: "usage_error", message: `Missing ${spec.args.slice(positionals.length).map((a) => `<${a}>`).join(" ")}.`, topic: spec };
  if (positionals.length > spec.args.length) return { kind: "usage_error", message: `Unexpected argument "${positionals[spec.args.length]}".`, topic: spec };
  for (const r of spec.required ?? []) if (flags[r] === undefined) return { kind: "usage_error", message: `Missing --${r}.`, topic: spec };

  // Positional amounts are validated here too, never on the server's first use.
  const amountArgs = new Set(["amount"]);
  for (const [i, name] of spec.args.entries()) {
    if (amountArgs.has(name) && !toBaseUnits(positionals[i]!)) return { kind: "usage_error", message: `<${name}> must be a positive USDC amount such as 1.50.`, topic: spec };
  }
  if (spec.path[0] === "prefs" && spec.path[1] === "add" && !["allow", "deny"].includes(positionals[0]!)) {
    return { kind: "usage_error", message: "The first argument must be allow or deny.", topic: spec };
  }
  if (spec.path[0] === "reserve" && !/^\d+$/.test(positionals[0]!)) return { kind: "usage_error", message: "<commitment-id> must be a number (see `sisih commitments`).", topic: spec };

  return { kind: "command", spec, args: positionals, flags, json: flags.json === true, url: typeof flags.url === "string" ? flags.url : undefined, hold: flags.hold === true };
}

export function usageLine(spec: CommandSpec): string {
  const flags = Object.entries(spec.flags)
    .map(([n, k]) => (spec.required?.includes(n) ? `--${n}${k === "bool" ? "" : ` <${k === "amount" ? "usdc" : "value"}>`}` : `[--${n}${k === "bool" ? "" : ` <${k === "amount" ? "usdc" : "value"}>`}]`))
    .join(" ");
  return ["sisih", ...spec.path, ...spec.args.map((a) => `<${a}>`), flags].filter(Boolean).join(" ");
}
