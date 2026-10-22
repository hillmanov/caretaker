import { expect, test } from "bun:test";
import { appTools, bodyOf } from "../../mcp/test-kit";

const t = await appTools("caretaker");
const API = "http://127.0.0.1:3013/api/collections";
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[-+]\d{2}:\d{2}$/;

const { illnesses: all } = await t.read("illnesses");
const sick = all.find((i: any) => i.stillSick);
const well = ["Scott", "Esther", "Darcy", "Adrie", "Liam", "Millie"].find((n) => !all.some((i: any) => i.stillSick && i.person === n))!;

test("illnesses: newest first, with a count, filtered by person and sickness", async () => {
  expect(all.length).toBeGreaterThan(0);
  const liam = await t.read("illnesses", { person: "liam" });
  expect(liam.count).toBe(liam.illnesses.length);
  expect(liam.illnesses.every((i: any) => i.person === "Liam")).toBe(true);
  const now = await t.read("illnesses", { sickNow: true });
  expect(now.illnesses.every((i: any) => i.stillSick)).toBe(true);
  const fevers = await t.read("illnesses", { sickness: "fever" });
  expect(fevers.illnesses.every((i: any) => /fever/i.test(`${i.sickness} ${i.name}`))).toBe(true);
});

test("illnesses: a sickness no illness has whole matches by its words", async () => {
  const [i] = all;
  const word = i.name.split(/\W+/).find((w: string) => w.length >= 3);
  const r = await t.read("illnesses", { person: i.person, sickness: `${word} zzzqx` });
  expect(r.illnesses.map((x: any) => x.id)).toContain(i.id);
});

test("illnesses: an unknown person names the people", async () => {
  await expect(t.read("illnesses", { person: "Nobody" })).rejects.toThrow("The people: ");
});

test("illness: one illness with what happened, in order", async () => {
  const i = await t.read("illness", { id: all[0].id });
  expect(i.id).toBe(all[0].id);
  expect(i.happened.length).toBe(i.events);
});

test("illness: the person's latest one like a sickness, and one they never had names theirs", async () => {
  const [latest] = (await t.read("illnesses", { person: "Millie", sickness: "fever" })).illnesses;
  if (latest) expect((await t.read("illness", { person: "millie", sickness: "fever" })).id).toBe(latest.id);
  await expect(t.read("illness", { person: "Millie", sickness: "zzzqx" })).rejects.toThrow("Theirs: ");
});

test("events: temperatures across illnesses, newest first", async () => {
  const temps = await t.read("events", { what: "temperature", limit: 10 });
  expect(temps.length).toBeGreaterThan(0);
  for (const e of temps) expect(e.person).toBeString();
  expect(temps.some((e: any) => e.details?.Temperature)).toBe(true);
});

test("kinds: the spellings in use", async () => {
  const kinds = await t.read("kinds");
  expect(kinds.map((x: any) => x.what)).toContain("Took temperature");
});

test("start_illness: posts a new illness with an offset time", async () => {
  const c = await t.plan("start_illness", { person: well.toLowerCase(), sickness: "Fever", start: "2026-10-21T07:30" });
  expect(c).toMatchObject({ method: "POST", url: `${API}/episode/records` });
  const b = bodyOf(c);
  expect(b).toMatchObject({ name: "Fever", sickness: "Fever", end: "", note: "" });
  expect(b.start).toBe("2026-10-21T07:30:00-06:00");
});

test("start_illness: refuses someone already sick", async () => {
  if (!sick) return;
  expect(await t.refuses("start_illness", { person: sick.person, sickness: "Cold" })).toContain("already sick");
});

test("record_event: goes to the open illness, keeping the log's spelling", async () => {
  if (!sick) return;
  const c = await t.plan("record_event", { person: sick.person, what: "took medicine: tylenol", details: { Amount: "2 pills" }, where: "couch" });
  expect(c).toMatchObject({ method: "POST", url: `${API}/event/records` });
  const b = bodyOf(c);
  expect(b).toMatchObject({ episode: sick.id, what: "Took medicine: Tylenol ", where: "Couch", data: [{ thing: "Amount", detail: "2 pills" }] });
  expect(b.when).toMatch(TIME);
});

test("record_event: refuses someone who isn't sick", async () => {
  expect(await t.refuses("record_event", { person: well, what: "Took temperature", details: { Temperature: "101" } })).toContain("isn't sick now");
});

test("update_illness: marks the open illness better", async () => {
  if (!sick) return;
  const c = await t.plan("update_illness", { person: sick.person, better: true });
  expect(c).toMatchObject({ method: "PATCH", url: `${API}/episode/records/${sick.id}` });
  expect(bodyOf(c).end).toMatch(TIME);
});

test("update_illness: changes a note, and refuses an illness that's over or nothing to change", async () => {
  const over = all.find((i: any) => !i.stillSick);
  expect(bodyOf(await t.plan("update_illness", { id: over.id, note: "Test note" }))).toEqual({ note: "Test note" });
  expect(await t.refuses("update_illness", { id: over.id, better: true })).toContain("already over");
  expect(await t.refuses("update_illness", { id: over.id })).toContain("Nothing to change");
});

test("fix_event: patches only what changed", async () => {
  const [e] = await t.read("events", { limit: 1 });
  const c = await t.plan("fix_event", { id: e.id, details: { Amount: "A lot" } });
  expect(c).toMatchObject({ method: "PATCH", url: `${API}/event/records/${e.id}` });
  expect(bodyOf(c)).toEqual({ data: [{ thing: "Amount", detail: "A lot" }] });
  expect(await t.refuses("fix_event", { id: "nosuchevent0000" })).toContain("No event");
});

test("fix_event: a what differing only in spaces keeps the log's spelling", async () => {
  const [e] = await t.read("events", { what: "Tylenol", limit: 1 });
  if (!e) return;
  const c = await t.plan("fix_event", { id: e.id, what: e.what, details: { Amount: "10 ml" } });
  expect(bodyOf(c)).toEqual({ data: [{ thing: "Amount", detail: "10 ml" }] });
});
