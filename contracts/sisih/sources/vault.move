/// Sisih vault: committed money is reserved per obligation; the AI agent is paid only from
/// the free pool. Generic over the coin type `T` (USDC in practice, never hardcoded).
///
/// Guarantee: `release_to_agent` only ever splits from `Vault.free`. It does not borrow
/// `Vault.obligations`, so no reserve can reach the agent. Soft rules (Walrus Memory) live
/// off-chain and can only decide whether to ask for a release, never what it may touch.
module sisih::vault;

use std::string::String;
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;
use sui::vec_map::{Self, VecMap};

// === Constants ===

const VERSION: u64 = 1;
const MAX_OBLIGATIONS: u64 = 16;
const DAY_MS: u64 = 86_400_000;
const KIND_FIXED: u8 = 0;
const KIND_USAGE: u8 = 1;
const PRIORITY_MUST: u8 = 0;
const PRIORITY_IMPORTANT: u8 = 1;
const USAGE_BILL_MAX_MULTIPLIER: u64 = 3;

// === Errors (stable codes so the server can map aborts to reasons) ===

#[error(code = 0)]
const ENotOwner: vector<u8> = b"Only the vault owner can do this";
#[error(code = 1)]
const EWrongOperatorCap: vector<u8> = b"Operator cap does not match this vault";
#[error(code = 2)]
const EWrongVersion: vector<u8> = b"Vault version does not match the package";
#[error(code = 3)]
const EZeroAmount: vector<u8> = b"Amount must be greater than zero";
#[error(code = 4)]
const EExceedsFree: vector<u8> = b"Amount exceeds free funds; reserves are locked";
#[error(code = 5)]
const ETooManyObligations: vector<u8> = b"A vault holds at most 16 obligations";
#[error(code = 6)]
const EUnknownObligation: vector<u8> = b"No obligation with this id";
#[error(code = 7)]
const EInvalidKind: vector<u8> = b"Obligation kind must be 0 (fixed) or 1 (usage-based)";
#[error(code = 8)]
const EInvalidPriority: vector<u8> = b"Obligation priority must be 0 (must) or 1 (important)";
#[error(code = 9)]
const ENotDue: vector<u8> = b"Obligation is not due yet";
#[error(code = 10)]
const EFixedBillMismatch: vector<u8> = b"A fixed obligation must be billed exactly its target";
#[error(code = 11)]
const EUsageBillTooHigh: vector<u8> = b"A usage-based bill may be at most 3x its target";
#[error(code = 12)]
const ENoAgentPolicy: vector<u8> = b"No agent permission is set";
#[error(code = 13)]
const EAgentPaused: vector<u8> = b"Agent is paused";
#[error(code = 14)]
const EAgentExpired: vector<u8> = b"Agent permission has expired";
#[error(code = 15)]
const EOverPerRequest: vector<u8> = b"Amount exceeds the per-request limit";
#[error(code = 16)]
const EOverDaily: vector<u8> = b"Amount exceeds the remaining daily limit";
#[error(code = 17)]
const EInvalidPolicy: vector<u8> = b"Policy limits must be positive, per-request <= per-day, expiry in the future";

// === Objects ===

/// Shared vault. `free` is the only pool the agent can be paid from.
public struct Vault<phantom T> has key {
    id: UID,
    /// Upgrade guard: entry points assert it matches VERSION.
    version: u64,
    owner: address,
    /// The only OperatorCap this vault accepts. The owner can rotate it.
    operator_cap_id: ID,
    free: Balance<T>,
    /// Keyed by obligation id; ids grow with insertion, so map order is ascending id.
    obligations: VecMap<u64, Obligation<T>>,
    next_obligation_id: u64,
    agent_policy: Option<AgentPolicy>,
}

/// Money promised to a payee, with its own locked reserve.
public struct Obligation<phantom T> has store {
    name: String,
    payee: address,
    /// Amount per cycle, in base units of T.
    target: u64,
    /// 0 fixed, 1 usage-based.
    kind: u8,
    /// 0 = one-time.
    cycle_ms: u64,
    next_due_ms: u64,
    /// 0 must, 1 important. Must is funded first.
    priority: u8,
    /// Display only, e.g. "Monthly". Demo cycles use a short cycle_ms.
    cadence_label: String,
    reserve: Balance<T>,
}

/// Hard limits on the agent, enforced here, not in memory.
public struct AgentPolicy has store, copy, drop {
    agent: address,
    max_per_request: u64,
    max_per_day: u64,
    spent_in_window: u64,
    window_start_ms: u64,
    expires_ms: u64,
    paused: bool,
}

/// Held by the server operator: can release free funds to the agent (within policy),
/// pay due obligations to their stored payees, and fund reserves. Cannot withdraw.
public struct OperatorCap has key, store {
    id: UID,
    vault_id: ID,
}

// === Events (every state change; each carries vault_id) ===

public struct VaultCreated has copy, drop { vault_id: ID, owner: address, operator: address, operator_cap_id: ID }
public struct Deposited has copy, drop { vault_id: ID, from: address, amount: u64, free_after: u64 }
public struct Withdrawn has copy, drop { vault_id: ID, to: address, amount: u64, free_after: u64 }
public struct ObligationAdded has copy, drop {
    vault_id: ID,
    id: u64,
    name: String,
    payee: address,
    target: u64,
    kind: u8,
    cycle_ms: u64,
    next_due_ms: u64,
    priority: u8,
    cadence_label: String,
    reserved: u64,
    free_after: u64,
}
public struct ObligationTargetChanged has copy, drop {
    vault_id: ID,
    id: u64,
    old_target: u64,
    new_target: u64,
    reserve_after: u64,
    free_after: u64,
}
public struct ObligationRemoved has copy, drop { vault_id: ID, id: u64, released: u64, free_after: u64 }
public struct ReservesFunded has copy, drop { vault_id: ID, moved: u64, free_after: u64, reserved_total: u64 }
public struct ObligationPaid has copy, drop {
    vault_id: ID,
    id: u64,
    payee: address,
    bill: u64,
    from_reserve: u64,
    from_free: u64,
    uncovered: u64,
    /// 0 when the obligation was one-time and is now removed.
    next_due_ms: u64,
    removed: bool,
    free_after: u64,
}
public struct ReleasedToAgent has copy, drop {
    vault_id: ID,
    agent: address,
    request_id: vector<u8>,
    amount: u64,
    free_after: u64,
    spent_in_window: u64,
}
public struct AgentPolicySet has copy, drop {
    vault_id: ID,
    agent: address,
    max_per_request: u64,
    max_per_day: u64,
    expires_ms: u64,
}
public struct AgentPaused has copy, drop { vault_id: ID, agent: address }
public struct AgentResumed has copy, drop { vault_id: ID, agent: address }
public struct AgentRevoked has copy, drop { vault_id: ID, agent: address }
public struct EmergencyWithdrawn has copy, drop { vault_id: ID, to: address, amount: u64, obligations_removed: u64 }
public struct OperatorRotated has copy, drop { vault_id: ID, old_cap_id: ID, new_cap_id: ID, new_operator: address }

// === Create, deposit, withdraw ===

/// Creates and shares a vault owned by the sender; the OperatorCap goes to `operator`.
public fun create_vault<T>(operator: address, ctx: &mut TxContext) {
    let id = object::new(ctx);
    let vault_id = id.to_inner();
    let cap = OperatorCap { id: object::new(ctx), vault_id };
    let operator_cap_id = object::id(&cap);
    let vault = Vault<T> {
        id,
        version: VERSION,
        owner: ctx.sender(),
        operator_cap_id,
        free: balance::zero(),
        obligations: vec_map::empty(),
        next_obligation_id: 0,
        agent_policy: option::none(),
    };
    event::emit(VaultCreated { vault_id, owner: ctx.sender(), operator, operator_cap_id });
    transfer::share_object(vault);
    transfer::public_transfer(cap, operator);
}

/// Anyone can deposit; deposits land in the free pool.
public fun deposit<T>(vault: &mut Vault<T>, payment: Coin<T>, ctx: &TxContext) {
    assert_version(vault);
    let amount = payment.value();
    assert!(amount > 0, EZeroAmount);
    vault.free.join(payment.into_balance());
    event::emit(Deposited { vault_id: object::id(vault), from: ctx.sender(), amount, free_after: vault.free.value() });
}

/// Owner withdraws from the free pool only.
public fun withdraw_free<T>(vault: &mut Vault<T>, amount: u64, ctx: &mut TxContext) {
    assert_version(vault);
    assert_owner(vault, ctx);
    assert!(amount > 0, EZeroAmount);
    assert!(amount <= vault.free.value(), EExceedsFree);
    let out = coin::from_balance(vault.free.split(amount), ctx);
    transfer::public_transfer(out, vault.owner);
    event::emit(Withdrawn { vault_id: object::id(vault), to: vault.owner, amount, free_after: vault.free.value() });
}

/// Owner drains the free pool and every reserve, removing all obligations.
public fun emergency_withdraw_all<T>(vault: &mut Vault<T>, ctx: &mut TxContext) {
    assert_version(vault);
    assert_owner(vault, ctx);
    let mut total = vault.free.withdraw_all();
    let mut removed = 0;
    while (!vault.obligations.is_empty()) {
        let (_, obligation) = vault.obligations.pop();
        let Obligation { reserve, .. } = obligation;
        total.join(reserve);
        removed = removed + 1;
    };
    let amount = total.value();
    if (amount > 0) {
        transfer::public_transfer(coin::from_balance(total, ctx), vault.owner);
    } else {
        total.destroy_zero();
    };
    event::emit(EmergencyWithdrawn { vault_id: object::id(vault), to: vault.owner, amount, obligations_removed: removed });
}

// === Obligations ===

/// Owner adds an obligation. Reserves min(target, free); underfunded is allowed.
public fun add_obligation<T>(
    vault: &mut Vault<T>,
    name: String,
    payee: address,
    target: u64,
    kind: u8,
    cycle_ms: u64,
    first_due_ms: u64,
    priority: u8,
    cadence_label: String,
    ctx: &TxContext,
) {
    assert_version(vault);
    assert_owner(vault, ctx);
    assert!(target > 0, EZeroAmount);
    assert!(kind == KIND_FIXED || kind == KIND_USAGE, EInvalidKind);
    assert!(priority == PRIORITY_MUST || priority == PRIORITY_IMPORTANT, EInvalidPriority);
    assert!(vault.obligations.length() < MAX_OBLIGATIONS, ETooManyObligations);

    let reserve_amount = min(target, vault.free.value());
    let reserve = vault.free.split(reserve_amount);
    let id = vault.next_obligation_id;
    vault.next_obligation_id = id + 1;
    vault.obligations.insert(id, Obligation {
        name,
        payee,
        target,
        kind,
        cycle_ms,
        next_due_ms: first_due_ms,
        priority,
        cadence_label,
        reserve,
    });
    event::emit(ObligationAdded {
        vault_id: object::id(vault),
        id,
        name,
        payee,
        target,
        kind,
        cycle_ms,
        next_due_ms: first_due_ms,
        priority,
        cadence_label,
        reserved: reserve_amount,
        free_after: vault.free.value(),
    });
}

/// Owner changes a target. Moves the difference between free and the reserve
/// (partially when free is short).
public fun set_obligation_target<T>(vault: &mut Vault<T>, id: u64, new_target: u64, ctx: &TxContext) {
    assert_version(vault);
    assert_owner(vault, ctx);
    assert!(new_target > 0, EZeroAmount);
    assert!(vault.obligations.contains(&id), EUnknownObligation);
    let free = &mut vault.free;
    let obligation = vault.obligations.get_mut(&id);
    let old_target = obligation.target;
    obligation.target = new_target;
    let reserved = obligation.reserve.value();
    if (new_target > reserved) {
        let top_up = min(new_target - reserved, free.value());
        obligation.reserve.join(free.split(top_up));
    } else if (reserved > new_target) {
        free.join(obligation.reserve.split(reserved - new_target));
    };
    let reserve_after = obligation.reserve.value();
    event::emit(ObligationTargetChanged {
        vault_id: object::id(vault),
        id,
        old_target,
        new_target,
        reserve_after,
        free_after: vault.free.value(),
    });
}

/// Owner removes an obligation; its reserve returns to free.
public fun remove_obligation<T>(vault: &mut Vault<T>, id: u64, ctx: &TxContext) {
    assert_version(vault);
    assert_owner(vault, ctx);
    assert!(vault.obligations.contains(&id), EUnknownObligation);
    let (_, obligation) = vault.obligations.remove(&id);
    let Obligation { reserve, .. } = obligation;
    let released = reserve.value();
    vault.free.join(reserve);
    event::emit(ObligationRemoved { vault_id: object::id(vault), id, released, free_after: vault.free.value() });
}

/// Owner tops up underfunded reserves from free: priority must first, then by id.
public fun fund_reserves<T>(vault: &mut Vault<T>, ctx: &TxContext) {
    assert_version(vault);
    assert_owner(vault, ctx);
    fund_reserves_internal(vault);
}

/// Operator variant of `fund_reserves`.
public fun fund_reserves_as_operator<T>(vault: &mut Vault<T>, cap: &OperatorCap) {
    assert_version(vault);
    assert_operator(vault, cap);
    fund_reserves_internal(vault);
}

/// Owner pays a due obligation to its stored payee.
public fun pay_obligation<T>(vault: &mut Vault<T>, id: u64, bill: u64, clock: &Clock, ctx: &mut TxContext) {
    assert_version(vault);
    assert_owner(vault, ctx);
    pay_obligation_internal(vault, id, bill, clock, ctx);
}

/// Operator variant of `pay_obligation`. Still pays only the stored payee, only when due.
public fun pay_obligation_as_operator<T>(
    vault: &mut Vault<T>,
    cap: &OperatorCap,
    id: u64,
    bill: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert_version(vault);
    assert_operator(vault, cap);
    pay_obligation_internal(vault, id, bill, clock, ctx);
}

// === Agent ===

/// Owner sets (or replaces) the agent permission. Keeps the current daily window when the
/// agent stays the same, so re-saving limits cannot reset the day's spend.
public fun set_agent_policy<T>(
    vault: &mut Vault<T>,
    agent: address,
    max_per_request: u64,
    max_per_day: u64,
    expires_ms: u64,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert_version(vault);
    assert_owner(vault, ctx);
    let now = clock.timestamp_ms();
    assert!(max_per_request > 0 && max_per_request <= max_per_day && expires_ms > now, EInvalidPolicy);
    let (spent_in_window, window_start_ms) = if (vault.agent_policy.is_some() && vault.agent_policy.borrow().agent == agent) {
        let p = vault.agent_policy.borrow();
        (p.spent_in_window, p.window_start_ms)
    } else {
        (0, now)
    };
    vault.agent_policy = option::some(AgentPolicy {
        agent,
        max_per_request,
        max_per_day,
        spent_in_window,
        window_start_ms,
        expires_ms,
        paused: false,
    });
    event::emit(AgentPolicySet { vault_id: object::id(vault), agent, max_per_request, max_per_day, expires_ms });
}

public fun pause_agent<T>(vault: &mut Vault<T>, ctx: &TxContext) {
    assert_version(vault);
    assert_owner(vault, ctx);
    assert!(vault.agent_policy.is_some(), ENoAgentPolicy);
    let vault_id = object::id(vault);
    let policy = vault.agent_policy.borrow_mut();
    policy.paused = true;
    event::emit(AgentPaused { vault_id, agent: policy.agent });
}

public fun resume_agent<T>(vault: &mut Vault<T>, ctx: &TxContext) {
    assert_version(vault);
    assert_owner(vault, ctx);
    assert!(vault.agent_policy.is_some(), ENoAgentPolicy);
    let vault_id = object::id(vault);
    let policy = vault.agent_policy.borrow_mut();
    policy.paused = false;
    event::emit(AgentResumed { vault_id, agent: policy.agent });
}

public fun revoke_agent<T>(vault: &mut Vault<T>, ctx: &TxContext) {
    assert_version(vault);
    assert_owner(vault, ctx);
    assert!(vault.agent_policy.is_some(), ENoAgentPolicy);
    let policy = vault.agent_policy.extract();
    event::emit(AgentRevoked { vault_id: object::id(vault), agent: policy.agent });
}

/// Operator releases `amount` from the FREE pool to the agent. Never touches reserves.
public fun release_to_agent<T>(
    vault: &mut Vault<T>,
    cap: &OperatorCap,
    amount: u64,
    request_id: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert_version(vault);
    assert_operator(vault, cap);
    assert!(amount > 0, EZeroAmount);
    assert!(vault.agent_policy.is_some(), ENoAgentPolicy);
    let now = clock.timestamp_ms();
    let vault_id = object::id(vault);
    let policy = vault.agent_policy.borrow_mut();
    assert!(!policy.paused, EAgentPaused);
    assert!(now < policy.expires_ms, EAgentExpired);
    assert!(amount <= policy.max_per_request, EOverPerRequest);
    if (now >= policy.window_start_ms + DAY_MS) {
        policy.window_start_ms = now;
        policy.spent_in_window = 0;
    };
    assert!(policy.spent_in_window + amount <= policy.max_per_day, EOverDaily);
    assert!(amount <= vault.free.value(), EExceedsFree);

    policy.spent_in_window = policy.spent_in_window + amount;
    let agent = policy.agent;
    let spent_in_window = policy.spent_in_window;
    let payment = coin::from_balance(vault.free.split(amount), ctx);
    transfer::public_transfer(payment, agent);
    event::emit(ReleasedToAgent {
        vault_id,
        agent,
        request_id,
        amount,
        free_after: vault.free.value(),
        spent_in_window,
    });
}

/// Owner replaces the operator: mints a new cap for `new_operator`; the old cap stops working.
public fun rotate_operator<T>(vault: &mut Vault<T>, new_operator: address, ctx: &mut TxContext) {
    assert_version(vault);
    assert_owner(vault, ctx);
    let vault_id = object::id(vault);
    let cap = OperatorCap { id: object::new(ctx), vault_id };
    let new_cap_id = object::id(&cap);
    let old_cap_id = vault.operator_cap_id;
    vault.operator_cap_id = new_cap_id;
    transfer::public_transfer(cap, new_operator);
    event::emit(OperatorRotated { vault_id, old_cap_id, new_cap_id, new_operator });
}

// === Read helpers ===

public fun owner<T>(vault: &Vault<T>): address { vault.owner }
public fun version<T>(vault: &Vault<T>): u64 { vault.version }
public fun operator_cap_id<T>(vault: &Vault<T>): ID { vault.operator_cap_id }
public fun free_value<T>(vault: &Vault<T>): u64 { vault.free.value() }
public fun obligation_count<T>(vault: &Vault<T>): u64 { vault.obligations.length() }
public fun obligation_ids<T>(vault: &Vault<T>): vector<u64> { vault.obligations.keys() }
public fun has_obligation<T>(vault: &Vault<T>, id: u64): bool { vault.obligations.contains(&id) }

public fun reserved_total<T>(vault: &Vault<T>): u64 {
    let mut total = 0;
    let mut i = 0;
    let n = vault.obligations.length();
    while (i < n) {
        let (_, obligation) = vault.obligations.get_entry_by_idx(i);
        total = total + obligation.reserve.value();
        i = i + 1;
    };
    total
}

public fun obligation_reserve<T>(vault: &Vault<T>, id: u64): u64 { obligation(vault, id).reserve.value() }
public fun obligation_target<T>(vault: &Vault<T>, id: u64): u64 { obligation(vault, id).target }
public fun obligation_payee<T>(vault: &Vault<T>, id: u64): address { obligation(vault, id).payee }
public fun obligation_next_due_ms<T>(vault: &Vault<T>, id: u64): u64 { obligation(vault, id).next_due_ms }
public fun obligation_kind<T>(vault: &Vault<T>, id: u64): u8 { obligation(vault, id).kind }
public fun obligation_priority<T>(vault: &Vault<T>, id: u64): u8 { obligation(vault, id).priority }
public fun obligation_cycle_ms<T>(vault: &Vault<T>, id: u64): u64 { obligation(vault, id).cycle_ms }
public fun obligation_name<T>(vault: &Vault<T>, id: u64): String { obligation(vault, id).name }
public fun obligation_cadence_label<T>(vault: &Vault<T>, id: u64): String { obligation(vault, id).cadence_label }

public fun has_agent_policy<T>(vault: &Vault<T>): bool { vault.agent_policy.is_some() }
public fun agent_policy<T>(vault: &Vault<T>): Option<AgentPolicy> { vault.agent_policy }
public fun policy_agent(p: &AgentPolicy): address { p.agent }
public fun policy_paused(p: &AgentPolicy): bool { p.paused }
public fun policy_spent_in_window(p: &AgentPolicy): u64 { p.spent_in_window }
public fun policy_max_per_request(p: &AgentPolicy): u64 { p.max_per_request }
public fun policy_max_per_day(p: &AgentPolicy): u64 { p.max_per_day }
public fun policy_expires_ms(p: &AgentPolicy): u64 { p.expires_ms }

public fun cap_vault_id(cap: &OperatorCap): ID { cap.vault_id }

// === Internal ===

fun assert_version<T>(vault: &Vault<T>) {
    assert!(vault.version == VERSION, EWrongVersion);
}

fun assert_owner<T>(vault: &Vault<T>, ctx: &TxContext) {
    assert!(ctx.sender() == vault.owner, ENotOwner);
}

fun assert_operator<T>(vault: &Vault<T>, cap: &OperatorCap) {
    assert!(object::id(cap) == vault.operator_cap_id && cap.vault_id == object::id(vault), EWrongOperatorCap);
}

fun obligation<T>(vault: &Vault<T>, id: u64): &Obligation<T> {
    assert!(vault.obligations.contains(&id), EUnknownObligation);
    let idx = vault.obligations.get_idx(&id);
    let (_, obligation) = vault.obligations.get_entry_by_idx(idx);
    obligation
}

fun min(a: u64, b: u64): u64 { if (a < b) a else b }

fun fund_reserves_internal<T>(vault: &mut Vault<T>) {
    let mut moved = 0;
    let n = vault.obligations.length();
    let mut priority = PRIORITY_MUST;
    while (priority <= PRIORITY_IMPORTANT) {
        let mut i = 0;
        while (i < n) {
            let (_, obligation) = vault.obligations.get_entry_by_idx_mut(i);
            if (obligation.priority == priority) {
                let reserved = obligation.reserve.value();
                if (reserved < obligation.target) {
                    let top_up = min(obligation.target - reserved, vault.free.value());
                    obligation.reserve.join(vault.free.split(top_up));
                    moved = moved + top_up;
                };
            };
            i = i + 1;
        };
        priority = priority + 1;
    };
    let reserved_total = reserved_total(vault);
    event::emit(ReservesFunded { vault_id: object::id(vault), moved, free_after: vault.free.value(), reserved_total });
}

fun pay_obligation_internal<T>(vault: &mut Vault<T>, id: u64, bill: u64, clock: &Clock, ctx: &mut TxContext) {
    assert!(bill > 0, EZeroAmount);
    assert!(vault.obligations.contains(&id), EUnknownObligation);
    let now = clock.timestamp_ms();
    let vault_id = object::id(vault);

    let free = &mut vault.free;
    let obligation = vault.obligations.get_mut(&id);
    assert!(now >= obligation.next_due_ms, ENotDue);
    if (obligation.kind == KIND_FIXED) {
        assert!(bill == obligation.target, EFixedBillMismatch);
    } else {
        assert!(bill <= obligation.target * USAGE_BILL_MAX_MULTIPLIER, EUsageBillTooHigh);
    };

    let from_reserve = min(bill, obligation.reserve.value());
    let mut payment = obligation.reserve.split(from_reserve);
    let from_free = min(bill - from_reserve, free.value());
    payment.join(free.split(from_free));
    let uncovered = bill - from_reserve - from_free;
    let payee = obligation.payee;

    let one_time = obligation.cycle_ms == 0;
    let next_due_ms = if (one_time) {
        0
    } else {
        // Skip missed cycles so a late payment leaves the next due time in the future.
        let missed = (now - obligation.next_due_ms) / obligation.cycle_ms + 1;
        obligation.next_due_ms + missed * obligation.cycle_ms
    };
    if (!one_time) obligation.next_due_ms = next_due_ms;

    if (payment.value() > 0) {
        transfer::public_transfer(coin::from_balance(payment, ctx), payee);
    } else {
        payment.destroy_zero();
    };

    if (one_time) {
        let (_, removed) = vault.obligations.remove(&id);
        let Obligation { reserve, .. } = removed;
        vault.free.join(reserve);
    };

    event::emit(ObligationPaid {
        vault_id,
        id,
        payee,
        bill,
        from_reserve,
        from_free,
        uncovered,
        next_due_ms,
        removed: one_time,
        free_after: vault.free.value(),
    });
}

// === Test-only ===

#[test_only]
/// (id, bill, from_reserve, from_free, uncovered, next_due_ms, removed)
public fun paid_event_values(e: &ObligationPaid): (u64, u64, u64, u64, u64, u64, bool) {
    (e.id, e.bill, e.from_reserve, e.from_free, e.uncovered, e.next_due_ms, e.removed)
}

#[test_only]
/// (agent, amount, free_after, spent_in_window)
public fun released_event_values(e: &ReleasedToAgent): (address, u64, u64, u64) {
    (e.agent, e.amount, e.free_after, e.spent_in_window)
}

#[test_only]
public fun released_event_request_id(e: &ReleasedToAgent): vector<u8> { e.request_id }

#[test_only]
public fun destroy_for_testing<T>(vault: Vault<T>) {
    let Vault { id, free, mut obligations, .. } = vault;
    id.delete();
    free.destroy_for_testing();
    while (!obligations.is_empty()) {
        let (_, obligation) = obligations.pop();
        let Obligation { reserve, .. } = obligation;
        reserve.destroy_for_testing();
    };
    obligations.destroy_empty();
}
