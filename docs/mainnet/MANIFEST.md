# Sisih Mainnet proof manifest

Status: **approved, funded and executed on 8 November 2026**; see [authorization](EXECUTION_AUTHORIZATION.md) and [verified evidence](../evidence/mainnet-20261108/README.md). The immutable [`MANIFEST.json`](./MANIFEST.json) retains the original financial proposal and local target; it is not an execution-status database. Two 0.80-USDC purchases completed, the third was refused, and permission is revoked. Net gas: 0.083418818 SUI. The later explicit Mainnet-only publication request is recorded separately in [PUBLIC_DEPLOYMENT.json](PUBLIC_DEPLOYMENT.json), with no new spending authority.

## Deployment and isolation

- Live proof execution target: isolated local runtime at `http://127.0.0.1:8788`, MCP `http://127.0.0.1:8788/api/mcp`, explicit PGlite state `server/data/mainnet-proof-20261107`, and Walrus prefix `sisih-mainnet-proof-20261107`.
- The original proposed second Vercel project was not used. The owner subsequently requested replacing the canonical `https://sisih-azure.vercel.app` runtime with Mainnet only. Completed state is published read-only in an isolated PostgreSQL schema on the existing managed instance, with no wallet keys. No old tables are read or overwritten.
- The former public runtime is retired; original network receipts remain unchanged in repository archives.
- Network: Sui Mainnet, chain ID `4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S`.
- Asset: native Circle USDC `0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC`, 6 decimals.
- Selected primitive: Sisih custom vault; see [`VAULT_DECISION.md`](./VAULT_DECISION.md).

## Exact funding checkpoint

All amounts below are maximum authorizations, not predicted charges. 1 SUI = 1,000,000,000 MIST; 1 USDC = 1,000,000 base units.

| Role | Public funding address | USDC | SUI / gas authorization |
| --- | --- | ---: | ---: |
| owner, local key only | `0xebd63d9b61f6a9a4f2e46954adb70c66c42e98f127a84a30071c336d63b98990` | 3.000000 | 0.165000000 |
| operator, deployment-held | `0x3728736836d2ffc9380cd7f1d4c17afc2838a74967e552344e6345bdf7de0fcc` | 0 | 0.040000000 |
| agent, deployment-held | `0x659429355664bc93efceae5faf7b2eeb55a10f42dd5e74c526b5fb660d54c2d5` | 0 | 0 |
| facilitator, deployment-held | `0x9ccb348898d029c559913609cdd262ecad0f11afd0e17ceb24dae3bf9f2c3664` | 0 | 0 |

Maximum allocation: **3.000000 USDC and 0.205000000 SUI aggregate**. The ChainScope merchant recipient is the project-operated address `0xb00fbd9da3208cfba9034178439f3c9dc6685d38db47845c0b9bedc6e8262ce5`. Its maximum receipt is 1.600000 USDC across exactly two 0.800000-USDC purchases. Those are the project's own funds returning to a project-operated address, not revenue.

Native-USDC x402 at this amount follows the installed library's gasless path and sets facilitator gas budget to zero; both actual settlements confirmed zero net gas. Owner authorization sums publish 100,000,000 MIST, create 20,000,000, setup 25,000,000 and revoke 20,000,000. Operator authorization is two 20,000,000-MIST release limits. Initial publish simulation measured 76,670,000 MIST gross; other caps used labeled Testnet-derived bounds. Actual computation/storage/rebate/net are now recorded per receipt in the evidence: aggregate net 83,418,818 MIST.

## Exact scenario

1. Owner publishes the selected package and retains UpgradeCap.
2. Owner creates `Vault<USDC>`; OperatorCap is sent to the reviewed operator.
3. Owner deposits 3.000000 USDC, creates a 0.800000-USDC savings commitment payable only to the owner, and grants the reviewed agent 1.000000 per request / 3.000000 per day until `1794647357715` ms.
4. A new 0.800000-USDC ChainScope request is held. Owner approves that exact request and remembers the preference. One release and one x402 settlement occur.
5. After Walrus reports the rule stored, a fresh application and agent session recalls it. A new 0.800000-USDC request is allowed and settles once.
6. A third request is refused: 0.600000 is free while 0.800000 remains reserved. The contract boundary is demonstrated only by a labeled simulation, not a deliberately failing broadcast.
7. Owner revokes the agent policy. Final vault expectation: 1.400000 total = 0.600000 free + 0.800000 reserved.
8. The exact verifier checks sender, gas owner/budget, package/function/type arguments, recipient/asset/amount balance changes, events and created types. A valid unrelated digest fails.

## Custody and approval boundary

The owner private key remains only in the ignored local `.env.mainnet` and signs publication, setup and owner intents locally. A server receives only the public owner address plus scoped operator/agent/facilitator keys. Persistent database budgets cap Mainnet merchant outflow at 1.600000 USDC and operator gas at 40,000,000 MIST; unknown outcomes retain their reservation until read-back.

The document alone never authorizes spending. The later [user authorization](EXECUTION_AUTHORIZATION.md) covered this exact plan, which is now executed. Live commands require the manifest, `--execute` and acknowledgement. Its two-purchase allocation is consumed; additional spending or withdrawal needs a new reviewed authorization.
