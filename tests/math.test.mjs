import test from "node:test";
import assert from "node:assert/strict";
import { sequence, analyze, close, explanation } from "../docs/math.js";
test("arithmetic nth, negative difference, one term and fractional sums", () => {
  assert.deepEqual(
    sequence({ a: 3, d: 4, n: 12 }).terms,
    Array.from({ length: 12 }, (_, i) => 3 + i * 4),
  );
  assert.equal(sequence({ a: 3, d: 4, n: 12 }).sum, 300);
  assert.equal(sequence({ a: 10, d: -3, n: 5 }).nth, -2);
  assert.equal(sequence({ a: 9, d: 8, n: 1 }).sum, 9);
  assert.ok(close(sequence({ a: 0.1, d: 0.1, n: 10 }).sum, 5.5));
});
test("geometric supports r=1, r=0, negative ratio, zero seed and convergence", () => {
  assert.equal(sequence({ type: "geometric", a: 5, r: 1, n: 20 }).sum, 100);
  assert.equal(sequence({ type: "geometric", a: 5, r: 0, n: 20 }).sum, 5);
  assert.deepEqual(
    sequence({ type: "geometric", a: 2, r: -2, n: 5 }).terms,
    [2, -4, 8, -16, 32],
  );
  assert.equal(sequence({ type: "geometric", a: 0, r: 10, n: 200 }).sum, 0);
  assert.ok(
    close(sequence({ type: "geometric", a: 1, r: 0.5, n: 100 }).sum, 2),
  );
  assert.match(
    explanation(sequence({ type: "geometric", a: 5, r: 1, n: 2 })).sumFormula,
    /r = 1/,
  );
});
test("linear recurrence agrees with closed form, and p=1 degenerates to arithmetic", () => {
  const v = sequence({ type: "recurrence", a: 5, p: 0.8, q: 5, n: 20 });
  assert.ok(close(v.nth, 25 + (5 - 25) * 0.8 ** 19));
  assert.deepEqual(
    sequence({ type: "recurrence", a: 3, p: 1, q: 4, n: 10 }).terms,
    sequence({ a: 3, d: 4, n: 10 }).terms,
  );
  assert.deepEqual(
    sequence({ type: "recurrence", a: 7, p: 0, q: 3, n: 3 }).terms,
    [7, 3, 3],
  );
});
test("rejects invalid, empty, unsafe counts and runaway values", () => {
  for (const input of [
    { n: 0 },
    { n: 201 },
    { n: 2.5 },
    { n: "" },
    { a: "" },
    { a: " " },
    { a: [] },
    { a: Infinity },
    { type: "bad" },
    { type: "geometric", r: 101 },
    { type: "geometric", a: 1, r: 100, n: 200 },
  ])
    assert.throws(() => sequence(input));
});
test("detects known patterns and handles zero without invented ratios", () => {
  assert.ok(
    analyze("2，5，8，11").candidates.some(
      (c) => c.type === "arithmetic" && c.next === 14,
    ),
  );
  assert.ok(
    analyze("3 6 12 24").candidates.some(
      (c) => c.type === "geometric" && c.next === 48,
    ),
  );
  assert.ok(
    analyze("1,4,9,16,25").candidates.some(
      (c) => c.type === "quadratic" && c.next === 36,
    ),
  );
  assert.ok(
    analyze("1,1,2,3,5,8").candidates.some(
      (c) => c.type === "fibonacci" && c.next === 13,
    ),
  );
  assert.ok(!analyze("0,0,1,2").candidates.some((c) => c.type === "geometric"));
  assert.ok(
    analyze("5,0,0,0").candidates.some(
      (c) => c.type === "geometric" && c.next === 0,
    ),
  );
  assert.match(
    analyze("0,0,0,0").candidates.find((c) => c.type === "geometric").label,
    /不唯一/,
  );
  assert.equal(analyze("5,5,5,5").candidates.length, 2);
  assert.equal(
    analyze(
      "0.000000000001,0.000000000002,0.000000000004,0.000000000008",
    ).candidates.some((c) => c.type === "arithmetic"),
    false,
  );
  assert.throws(() => analyze("1,2,3"));
  assert.throws(() => analyze("1,2,no,4"));
});
