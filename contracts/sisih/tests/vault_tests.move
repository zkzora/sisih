#[test_only]
module sisih::vault_tests;

use sisih::vault::{Self, Vault, OperatorCap, ObligationPaid, ReleasedToAgent};
use std::string;
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::event;
use sui::test_scenario::{Self as ts, Scenario};

public struct TEST_USDC has drop {}

const OWNER: address = @0xA;
const OPERATOR: address = @0xB;
const AGENT: address = @0xC;
const STRANGER: address = @0xD;
const PAYEE_INFERENCE: address = @0x101;
const PAYEE_HOSTING: address = @0x102;
const PAYEE_SAVINGS: address = @0x103;
const PAYEE_DOMAIN: address = @0x104;

/// 1.00 USDC in base units.
const U: u64 = 1_000_000;
const CYCLE: u64 = 120_000;
const DAY: u64 = 86_400_000;
const START: u64 = 1_000_000;

// Obligation ids in seeding order.
const INFERENCE: u64 = 0;
const HOSTING: u64 = 1;
const SAVINGS: u64 = 2;
const DOMAIN: u64 = 3;

// === Helpers ===

fun usdc(amount: u64, sc: &mut Scenario): Coin<TEST_USDC> {
    coin::mint_for_testing<TEST_USDC>(amount, sc.ctx())
}

/// Vault + clock, nothing deposited.
fun setup(): (Scenario, Clock) {
    let mut sc = ts::begin(OWNER);
    vault::create_vault<TEST_USDC>(OPERATOR, sc.ctx());
    let mut clock = clock::create_for_testing(sc.ctx());
    clock.set_for_testing(START);
    sc.next_tx(OWNER);
    (sc, clock)
}

/// The SPEC starting state: 20.00 total, 16.50 committed, 3.50 free, agent 5/10 per request/day.
fun setup_seeded(): (Scenario, Clock) {
    let (mut sc, clock) = setup();
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    let payment = usdc(20 * U, &mut sc);
    v.deposit(payment, sc.ctx());
    let due = START + CYCLE;
    v.add_obligation(string::utf8(b"Inference API"), PAYEE_INFERENCE, 6 * U, 1, CYCLE, due, 0, string::utf8(b"Monthly"), sc.ctx());
    v.add_obligation(string::utf8(b"Hosting VPS"), PAYEE_HOSTING, 5 * U, 0, CYCLE, due, 0, string::utf8(b"Monthly"), sc.ctx());
    v.add_obligation(string::utf8(b"Weekly savings"), PAYEE_SAVINGS, 4 * U, 0, CYCLE, due, 1, string::utf8(b"Weekly"), sc.ctx());
    v.add_obligation(string::utf8(b"Domain renewal"), PAYEE_DOMAIN, 1_500_000, 0, 0, due, 1, string::utf8(b"One-time"), sc.ctx());
    v.set_agent_policy(AGENT, 5 * U, 10 * U, START + 30 * DAY, &clock, sc.ctx());
    ts::return_shared(v);
    sc.next_tx(OPERATOR);
    (sc, clock)
}

/// Operator releases `amount` to the agent in its own transaction.
fun release(sc: &mut Scenario, clock: &Clock, amount: u64) {
    sc.next_tx(OPERATOR);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    let cap = sc.take_from_sender<OperatorCap>();
    v.release_to_agent(&cap, amount, b"req", clock, sc.ctx());
    sc.return_to_sender(cap);
    ts::return_shared(v);
}

fun finish(sc: Scenario, clock: Clock) {
    clock.destroy_for_testing();
    sc.end();
}

/// Sum and burn every TEST_USDC coin `who` received in the previous transaction.
fun take_received(sc: &Scenario, who: address): u64 {
    let mut total = 0;
    while (ts::has_most_recent_for_address<Coin<TEST_USDC>>(who)) {
        let c = sc.take_from_address<Coin<TEST_USDC>>(who);
        total = total + c.burn_for_testing();
    };
    total
}

// === Seed state ===

#[test]
fun seed_matches_spec() {
    let (sc, clock) = setup_seeded();
    let v = sc.take_shared<Vault<TEST_USDC>>();
    assert!(v.free_value() == 3_500_000);
    assert!(v.reserved_total() == 16_500_000);
    assert!(v.obligation_count() == 4);
    assert!(v.obligation_reserve(INFERENCE) == 6 * U);
    assert!(v.obligation_reserve(DOMAIN) == 1_500_000);
    assert!(v.owner() == OWNER);
    ts::return_shared(v);
    finish(sc, clock);
}

// === The core guarantee: the agent is paid only from free funds ===

#[test]
fun release_takes_only_free_never_reserves() {
    let (mut sc, clock) = setup_seeded();
    release(&mut sc, &clock, 3_500_000); // exactly all free funds
    let released = event::events_by_type<ReleasedToAgent>();
    assert!(released.length() == 1);
    let (agent, amount, free_after, spent) = vault::released_event_values(&released[0]);
    assert!(agent == AGENT && amount == 3_500_000 && free_after == 0 && spent == 3_500_000);
    assert!(vault::released_event_request_id(&released[0]) == b"req");
    sc.next_tx(OWNER);
    assert!(take_received(&sc, AGENT) == 3_500_000);
    let v = sc.take_shared<Vault<TEST_USDC>>();
    assert!(v.free_value() == 0);
    assert!(v.reserved_total() == 16_500_000);
    assert!(v.obligation_reserve(INFERENCE) == 6 * U);
    assert!(v.obligation_reserve(HOSTING) == 5 * U);
    assert!(v.obligation_reserve(SAVINGS) == 4 * U);
    assert!(v.obligation_reserve(DOMAIN) == 1_500_000);
    ts::return_shared(v);
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::EExceedsFree)]
fun release_one_unit_over_free_aborts() {
    let (mut sc, clock) = setup_seeded();
    release(&mut sc, &clock, 3_500_001);
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::EExceedsFree)]
fun release_after_free_is_spent_aborts() {
    let (mut sc, clock) = setup_seeded();
    release(&mut sc, &clock, 3_500_000);
    release(&mut sc, &clock, 10_000); // 16.50 still reserved, but none of it is reachable
    finish(sc, clock);
}

#[test]
fun release_gate_example_half_dollar() {
    let (mut sc, clock) = setup_seeded();
    release(&mut sc, &clock, 500_000);
    sc.next_tx(OWNER);
    assert!(take_received(&sc, AGENT) == 500_000);
    let v = sc.take_shared<Vault<TEST_USDC>>();
    assert!(v.free_value() == 3 * U);
    assert!(v.reserved_total() == 16_500_000);
    ts::return_shared(v);
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::EExceedsFree)]
fun release_five_with_three_free_aborts() {
    let (mut sc, clock) = setup_seeded();
    release(&mut sc, &clock, 500_000);
    release(&mut sc, &clock, 5 * U); // within the 5.00 per-request cap, but only 3.00 free
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::EAgentPaused)]
fun release_when_paused_aborts() {
    let (mut sc, clock) = setup_seeded();
    sc.next_tx(OWNER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.pause_agent(sc.ctx());
    ts::return_shared(v);
    release(&mut sc, &clock, 100_000);
    finish(sc, clock);
}

#[test]
fun resume_after_pause_allows_release() {
    let (mut sc, clock) = setup_seeded();
    sc.next_tx(OWNER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.pause_agent(sc.ctx());
    v.resume_agent(sc.ctx());
    ts::return_shared(v);
    release(&mut sc, &clock, 100_000);
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::EAgentExpired)]
fun release_after_expiry_aborts() {
    let (mut sc, mut clock) = setup_seeded();
    clock.set_for_testing(START + 30 * DAY);
    release(&mut sc, &clock, 100_000);
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::ENoAgentPolicy)]
fun release_after_revoke_aborts() {
    let (mut sc, clock) = setup_seeded();
    sc.next_tx(OWNER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.revoke_agent(sc.ctx());
    assert!(!v.has_agent_policy());
    ts::return_shared(v);
    release(&mut sc, &clock, 100_000);
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::EOverPerRequest)]
fun release_over_per_request_aborts() {
    let (mut sc, clock) = setup_seeded();
    sc.next_tx(OWNER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    let extra = usdc(20 * U, &mut sc);
    v.deposit(extra, sc.ctx());
    ts::return_shared(v);
    release(&mut sc, &clock, 5 * U + 1);
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::EOverDaily)]
fun release_over_daily_window_aborts() {
    let (mut sc, clock) = setup_seeded();
    sc.next_tx(OWNER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    let extra = usdc(20 * U, &mut sc);
    v.deposit(extra, sc.ctx());
    ts::return_shared(v);
    release(&mut sc, &clock, 5 * U);
    release(&mut sc, &clock, 5 * U);
    release(&mut sc, &clock, 10_000); // 10.00 per day already used
    finish(sc, clock);
}

#[test]
fun daily_window_resets_after_24h() {
    let (mut sc, mut clock) = setup_seeded();
    sc.next_tx(OWNER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    let extra = usdc(20 * U, &mut sc);
    v.deposit(extra, sc.ctx());
    ts::return_shared(v);
    release(&mut sc, &clock, 5 * U);
    release(&mut sc, &clock, 5 * U);
    clock.set_for_testing(START + DAY);
    release(&mut sc, &clock, 5 * U);
    finish(sc, clock);
}

#[test]
fun resaving_policy_keeps_the_days_spend() {
    let (mut sc, clock) = setup_seeded();
    release(&mut sc, &clock, 3 * U);
    sc.next_tx(OWNER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.set_agent_policy(AGENT, 5 * U, 10 * U, START + 30 * DAY, &clock, sc.ctx());
    let policy = v.agent_policy().destroy_some();
    assert!(policy.policy_spent_in_window() == 3 * U);
    ts::return_shared(v);
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::EWrongOperatorCap)]
fun rotated_operator_cap_stops_working() {
    let (mut sc, clock) = setup_seeded();
    sc.next_tx(OWNER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.rotate_operator(STRANGER, sc.ctx());
    ts::return_shared(v);
    release(&mut sc, &clock, 100_000); // OPERATOR still holds the old cap
    finish(sc, clock);
}

#[test]
fun rotated_operator_cap_works_for_new_operator() {
    let (mut sc, clock) = setup_seeded();
    sc.next_tx(OWNER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.rotate_operator(STRANGER, sc.ctx());
    ts::return_shared(v);
    sc.next_tx(STRANGER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    let cap = sc.take_from_sender<OperatorCap>();
    v.release_to_agent(&cap, 100_000, b"r2", &clock, sc.ctx());
    sc.return_to_sender(cap);
    ts::return_shared(v);
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::EWrongOperatorCap)]
fun cap_from_another_vault_is_rejected() {
    let (mut sc, clock) = setup_seeded();
    let seeded_id = ts::most_recent_id_shared<Vault<TEST_USDC>>().destroy_some();
    // STRANGER creates a second vault and operates it; that cap must not work on the first.
    sc.next_tx(STRANGER);
    vault::create_vault<TEST_USDC>(STRANGER, sc.ctx());
    sc.next_tx(STRANGER);
    let cap = sc.take_from_sender<OperatorCap>();
    let mut v = sc.take_shared_by_id<Vault<TEST_USDC>>(seeded_id);
    v.release_to_agent(&cap, 100_000, b"x", &clock, sc.ctx());
    ts::return_shared(v);
    sc.return_to_sender(cap);
    finish(sc, clock);
}

// === Owner-only actions ===

#[test, expected_failure(abort_code = vault::ENotOwner)]
fun stranger_cannot_withdraw() {
    let (mut sc, clock) = setup_seeded();
    sc.next_tx(STRANGER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.withdraw_free(100_000, sc.ctx());
    ts::return_shared(v);
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::ENotOwner)]
fun operator_cannot_withdraw() {
    let (mut sc, clock) = setup_seeded();
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.withdraw_free(100_000, sc.ctx());
    ts::return_shared(v);
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::ENotOwner)]
fun stranger_cannot_add_obligation() {
    let (mut sc, clock) = setup_seeded();
    sc.next_tx(STRANGER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.add_obligation(string::utf8(b"X"), STRANGER, U, 0, CYCLE, START, 0, string::utf8(b"Monthly"), sc.ctx());
    ts::return_shared(v);
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::ENotOwner)]
fun stranger_cannot_change_target() {
    let (mut sc, clock) = setup_seeded();
    sc.next_tx(STRANGER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.set_obligation_target(INFERENCE, U, sc.ctx());
    ts::return_shared(v);
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::ENotOwner)]
fun stranger_cannot_remove_obligation() {
    let (mut sc, clock) = setup_seeded();
    sc.next_tx(STRANGER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.remove_obligation(INFERENCE, sc.ctx());
    ts::return_shared(v);
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::ENotOwner)]
fun stranger_cannot_set_policy() {
    let (mut sc, clock) = setup_seeded();
    sc.next_tx(STRANGER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.set_agent_policy(STRANGER, 100 * U, 100 * U, START + DAY, &clock, sc.ctx());
    ts::return_shared(v);
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::ENotOwner)]
fun stranger_cannot_emergency_withdraw() {
    let (mut sc, clock) = setup_seeded();
    sc.next_tx(STRANGER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.emergency_withdraw_all(sc.ctx());
    ts::return_shared(v);
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::ENotOwner)]
fun stranger_cannot_pause_agent() {
    let (mut sc, clock) = setup_seeded();
    sc.next_tx(STRANGER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.pause_agent(sc.ctx());
    ts::return_shared(v);
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::ENotOwner)]
fun stranger_cannot_rotate_operator() {
    let (mut sc, clock) = setup_seeded();
    sc.next_tx(STRANGER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.rotate_operator(STRANGER, sc.ctx());
    ts::return_shared(v);
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::EExceedsFree)]
fun owner_cannot_withdraw_reserves() {
    let (mut sc, clock) = setup_seeded();
    sc.next_tx(OWNER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.withdraw_free(3_500_001, sc.ctx());
    ts::return_shared(v);
    finish(sc, clock);
}

// === Paying obligations ===

fun pay_as_operator(sc: &mut Scenario, clock: &Clock, id: u64, bill: u64) {
    sc.next_tx(OPERATOR);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    let cap = sc.take_from_sender<OperatorCap>();
    v.pay_obligation_as_operator(&cap, id, bill, clock, sc.ctx());
    sc.return_to_sender(cap);
    ts::return_shared(v);
}

#[test]
fun usage_bill_over_reserve_takes_shortfall_from_free() {
    let (mut sc, mut clock) = setup_seeded();
    clock.set_for_testing(START + CYCLE);
    pay_as_operator(&mut sc, &clock, INFERENCE, 6_800_000);
    let paid = event::events_by_type<ObligationPaid>();
    assert!(paid.length() == 1);
    let (id, bill, from_reserve, from_free, uncovered, next_due, removed) = vault::paid_event_values(&paid[0]);
    assert!(id == INFERENCE && bill == 6_800_000);
    assert!(from_reserve == 6 * U && from_free == 800_000 && uncovered == 0);
    assert!(next_due == START + 2 * CYCLE && !removed);
    sc.next_tx(OWNER);
    assert!(take_received(&sc, PAYEE_INFERENCE) == 6_800_000);
    let v = sc.take_shared<Vault<TEST_USDC>>();
    assert!(v.free_value() == 2_700_000);
    assert!(v.obligation_reserve(INFERENCE) == 0);
    assert!(v.obligation_next_due_ms(INFERENCE) == START + 2 * CYCLE);
    ts::return_shared(v);
    finish(sc, clock);
}

#[test]
fun shortfall_beyond_free_is_recorded_as_uncovered() {
    let (mut sc, mut clock) = setup_seeded();
    sc.next_tx(OWNER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.withdraw_free(3_200_000, sc.ctx()); // free 0.30
    ts::return_shared(v);
    clock.set_for_testing(START + CYCLE);
    pay_as_operator(&mut sc, &clock, INFERENCE, 6_800_000);
    let paid = event::events_by_type<ObligationPaid>();
    let (_, _, from_reserve, from_free, uncovered, _, _) = vault::paid_event_values(&paid[0]);
    assert!(from_reserve == 6 * U && from_free == 300_000 && uncovered == 500_000);
    sc.next_tx(OWNER);
    assert!(take_received(&sc, PAYEE_INFERENCE) == 6_300_000);
    let v = sc.take_shared<Vault<TEST_USDC>>();
    assert!(v.free_value() == 0);
    ts::return_shared(v);
    finish(sc, clock);
}

#[test]
fun pays_only_the_stored_payee() {
    let (mut sc, mut clock) = setup_seeded();
    clock.set_for_testing(START + CYCLE);
    pay_as_operator(&mut sc, &clock, HOSTING, 5 * U);
    sc.next_tx(OWNER);
    assert!(take_received(&sc, PAYEE_HOSTING) == 5 * U);
    assert!(!ts::has_most_recent_for_address<Coin<TEST_USDC>>(OPERATOR));
    assert!(!ts::has_most_recent_for_address<Coin<TEST_USDC>>(AGENT));
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::ENotDue)]
fun paying_before_due_aborts() {
    let (mut sc, clock) = setup_seeded();
    pay_as_operator(&mut sc, &clock, HOSTING, 5 * U);
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::EFixedBillMismatch)]
fun fixed_bill_must_equal_target() {
    let (mut sc, mut clock) = setup_seeded();
    clock.set_for_testing(START + CYCLE);
    pay_as_operator(&mut sc, &clock, HOSTING, 5_500_000);
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::EUsageBillTooHigh)]
fun usage_bill_capped_at_three_times_target() {
    let (mut sc, mut clock) = setup_seeded();
    clock.set_for_testing(START + CYCLE);
    pay_as_operator(&mut sc, &clock, INFERENCE, 18 * U + 1);
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::EWrongOperatorCap)]
fun pay_with_rotated_cap_aborts() {
    let (mut sc, mut clock) = setup_seeded();
    sc.next_tx(OWNER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.rotate_operator(STRANGER, sc.ctx());
    ts::return_shared(v);
    clock.set_for_testing(START + CYCLE);
    pay_as_operator(&mut sc, &clock, HOSTING, 5 * U);
    finish(sc, clock);
}

#[test]
fun owner_can_pay_directly() {
    let (mut sc, mut clock) = setup_seeded();
    clock.set_for_testing(START + CYCLE);
    sc.next_tx(OWNER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.pay_obligation(SAVINGS, 4 * U, &clock, sc.ctx());
    ts::return_shared(v);
    sc.next_tx(OWNER);
    assert!(take_received(&sc, PAYEE_SAVINGS) == 4 * U);
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::ENotOwner)]
fun stranger_cannot_pay_as_owner() {
    let (mut sc, mut clock) = setup_seeded();
    clock.set_for_testing(START + CYCLE);
    sc.next_tx(STRANGER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.pay_obligation(SAVINGS, 4 * U, &clock, sc.ctx());
    ts::return_shared(v);
    finish(sc, clock);
}

#[test]
fun one_time_obligation_is_removed_after_payment() {
    let (mut sc, mut clock) = setup_seeded();
    clock.set_for_testing(START + CYCLE);
    pay_as_operator(&mut sc, &clock, DOMAIN, 1_500_000);
    let paid = event::events_by_type<ObligationPaid>();
    let (_, _, from_reserve, _, _, next_due, removed) = vault::paid_event_values(&paid[0]);
    assert!(from_reserve == 1_500_000 && next_due == 0 && removed);
    sc.next_tx(OWNER);
    assert!(take_received(&sc, PAYEE_DOMAIN) == 1_500_000);
    let v = sc.take_shared<Vault<TEST_USDC>>();
    assert!(!v.has_obligation(DOMAIN));
    assert!(v.obligation_count() == 3);
    assert!(v.free_value() == 3_500_000);
    ts::return_shared(v);
    finish(sc, clock);
}

#[test]
fun recurring_obligation_advances_one_cycle() {
    let (mut sc, mut clock) = setup_seeded();
    clock.set_for_testing(START + CYCLE);
    pay_as_operator(&mut sc, &clock, HOSTING, 5 * U);
    sc.next_tx(OWNER);
    let v = sc.take_shared<Vault<TEST_USDC>>();
    assert!(v.obligation_next_due_ms(HOSTING) == START + 2 * CYCLE);
    assert!(v.has_obligation(HOSTING));
    ts::return_shared(v);
    finish(sc, clock);
}

#[test]
fun late_payment_skips_missed_cycles() {
    let (mut sc, mut clock) = setup_seeded();
    clock.set_for_testing(START + CYCLE + 3 * CYCLE + CYCLE / 2); // 3.5 cycles late
    pay_as_operator(&mut sc, &clock, HOSTING, 5 * U);
    sc.next_tx(OWNER);
    let v = sc.take_shared<Vault<TEST_USDC>>();
    assert!(v.obligation_next_due_ms(HOSTING) == START + 5 * CYCLE);
    assert!(v.obligation_next_due_ms(HOSTING) > clock.timestamp_ms());
    ts::return_shared(v);
    finish(sc, clock);
}

// === Reserves ===

#[test]
fun fund_reserves_respects_priority() {
    let (mut sc, clock) = setup();
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    // Created with no funds, so every reserve starts at zero. Important first in id order.
    v.add_obligation(string::utf8(b"Savings"), PAYEE_SAVINGS, 4 * U, 0, CYCLE, START, 1, string::utf8(b"Weekly"), sc.ctx());
    v.add_obligation(string::utf8(b"Inference"), PAYEE_INFERENCE, 6 * U, 1, CYCLE, START, 0, string::utf8(b"Monthly"), sc.ctx());
    v.add_obligation(string::utf8(b"Hosting"), PAYEE_HOSTING, 5 * U, 0, CYCLE, START, 0, string::utf8(b"Monthly"), sc.ctx());
    assert!(v.reserved_total() == 0);
    let payment = usdc(7 * U, &mut sc);
    v.deposit(payment, sc.ctx());
    v.fund_reserves(sc.ctx());
    assert!(v.obligation_reserve(1) == 6 * U); // must, lowest id
    assert!(v.obligation_reserve(2) == U); // must, gets the remainder
    assert!(v.obligation_reserve(0) == 0); // important waits
    assert!(v.free_value() == 0);
    ts::return_shared(v);
    finish(sc, clock);
}

#[test]
fun operator_can_fund_reserves() {
    let (mut sc, mut clock) = setup_seeded();
    clock.set_for_testing(START + CYCLE);
    pay_as_operator(&mut sc, &clock, HOSTING, 5 * U); // hosting reserve now 0
    sc.next_tx(OWNER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    let income = usdc(17 * U, &mut sc);
    v.deposit(income, sc.ctx());
    ts::return_shared(v);
    sc.next_tx(OPERATOR);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    let cap = sc.take_from_sender<OperatorCap>();
    v.fund_reserves_as_operator(&cap);
    assert!(v.obligation_reserve(HOSTING) == 5 * U);
    assert!(v.free_value() == 3_500_000 + 17 * U - 5 * U);
    sc.return_to_sender(cap);
    ts::return_shared(v);
    finish(sc, clock);
}

#[test]
fun add_obligation_reserves_only_what_is_free() {
    let (mut sc, clock) = setup_seeded();
    sc.next_tx(OWNER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.add_obligation(string::utf8(b"Big"), PAYEE_HOSTING, 10 * U, 0, CYCLE, START, 1, string::utf8(b"Monthly"), sc.ctx());
    assert!(v.obligation_reserve(4) == 3_500_000); // underfunded is allowed
    assert!(v.free_value() == 0);
    ts::return_shared(v);
    finish(sc, clock);
}

#[test]
fun set_target_moves_between_free_and_reserve() {
    let (mut sc, clock) = setup_seeded();
    sc.next_tx(OWNER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.set_obligation_target(INFERENCE, 7 * U, sc.ctx()); // the accepted reserve suggestion
    assert!(v.obligation_reserve(INFERENCE) == 7 * U);
    assert!(v.free_value() == 2_500_000);
    v.set_obligation_target(INFERENCE, 5 * U, sc.ctx());
    assert!(v.obligation_reserve(INFERENCE) == 5 * U);
    assert!(v.free_value() == 4_500_000);
    v.set_obligation_target(INFERENCE, 20 * U, sc.ctx()); // partial when free is short
    assert!(v.obligation_reserve(INFERENCE) == 9_500_000);
    assert!(v.free_value() == 0);
    ts::return_shared(v);
    finish(sc, clock);
}

#[test]
fun remove_obligation_returns_reserve_to_free() {
    let (mut sc, clock) = setup_seeded();
    sc.next_tx(OWNER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.remove_obligation(SAVINGS, sc.ctx());
    assert!(v.free_value() == 7_500_000);
    assert!(v.reserved_total() == 12_500_000);
    assert!(!v.has_obligation(SAVINGS));
    ts::return_shared(v);
    finish(sc, clock);
}

#[test]
fun emergency_withdraw_returns_everything_to_owner() {
    let (mut sc, clock) = setup_seeded();
    sc.next_tx(OWNER);
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    v.emergency_withdraw_all(sc.ctx());
    assert!(v.free_value() == 0);
    assert!(v.obligation_count() == 0);
    ts::return_shared(v);
    sc.next_tx(OWNER);
    assert!(take_received(&sc, OWNER) == 20 * U);
    finish(sc, clock);
}

#[test, expected_failure(abort_code = vault::ETooManyObligations)]
fun at_most_sixteen_obligations() {
    let (mut sc, clock) = setup();
    let mut v = sc.take_shared<Vault<TEST_USDC>>();
    let mut i = 0u64;
    while (i < 17) {
        v.add_obligation(string::utf8(b"O"), PAYEE_HOSTING, U, 0, CYCLE, START, 1, string::utf8(b"Monthly"), sc.ctx());
        i = i + 1;
    };
    ts::return_shared(v);
    finish(sc, clock);
}
