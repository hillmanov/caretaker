// Caretaker's writes against a pretend PocketBase: a dose's last dose, a new kind offered beside the nearest ones,
// several open illnesses and a recent one as choices, and each write's undo.
import { afterAll, expect, test } from "bun:test";
import { kit } from "../../tools/kit";
import { pretendTools, requestOf } from "../../tools/test-kit";

const people = [
  { id: "liam", name: "Liam" },
  { id: "millie", name: "Millie" },
  { id: "scott", name: "Scott" },
];
const ill = (id: string, person: string, name: string, start: string, end = "") => ({
  id,
  person,
  name,
  sickness: name,
  start,
  end,
  note: "",
});
// Newest first, as the tools ask PocketBase for them.
const illnesses = [
  ill("back", "scott", "Back pain", "2026-10-21 15:00:00.000Z"),
  ill("fever", "millie", "Fever", "2026-10-20 20:00:00.000Z"),
  ill("cold", "scott", "Cold", "2026-10-19 15:00:00.000Z"),
  ill("liamcold", "liam", "Cold", "2026-10-18 14:00:00.000Z", "2026-10-22 00:00:00.000Z"),
];
// Oldest first, as the tools ask for them.
const events = [
  {
    id: "dose1",
    episode: "fever",
    what: "Took medicine: Tylenol ",
    when: "2026-10-21 16:15:00.000Z",
    where: "Couch",
    data: [{ thing: "Amount", detail: "5 ml" }],
    note: "",
    recordedBy: "scott",
  },
  {
    id: "temp1",
    episode: "fever",
    what: "Took temperature",
    when: "2026-10-21 17:00:00.000Z",
    where: "",
    data: [
      { thing: "Temperature", detail: "101.2" },
      { thing: "Device", detail: "Head thermometer" },
    ],
    note: "",
    recordedBy: "scott",
  },
];
const kinds = [
  { what: "Threw up", thing: "Amount", detail: "A little" },
  { what: "Took medicine: Ibuprofen", thing: "Amount", detail: "5 ml" },
  { what: "Took medicine: Tylenol ", thing: "Amount", detail: "5 ml" },
  { what: "Took temperature", thing: "Device", detail: "Head thermometer" },
  { what: "Took temperature", thing: "Temperature", detail: "101.2" },
];
const LISTS: Record<string, unknown[]> = {
  person: people,
  episode: illnesses,
  event: events,
  whats_things_details: kinds,
};

const p = await pretendTools("caretaker", (url, req, body) => {
  const [, , , collection, , id] = url.pathname.split("/");
  if (req.method === "GET" && !id) return { items: LISTS[collection!] ?? [] };
  if (req.method === "POST") return { id: "made1", ...JSON.parse(body) };
  if (req.method === "PATCH") {
    const was = [...illnesses, ...events].find((x) => x.id === id);
    return { ...was, ...JSON.parse(body) };
  }
  if (req.method === "DELETE") return new Response(null, { status: 204 });
});
afterAll(() => p.stop());

test("record_event: a dose shows the last one of that medicine, how long ago and how much, and remembers nothing", async () => {
  const card = await p.ask("record_event", {
    person: "Millie",
    what: "Took medicine: Tylenol",
    details: { Amount: "5 ml" },
    when: "2026-10-21 14:40",
  });
  expect(card.title).toMatch(/^Log Millie's Tylenol, 5 ml (at|on .+ at) 2:40 PM$/);
  expect(card.remember).toEqual([]);
  expect(card.show[0]).toMatchObject({
    rows: expect.arrayContaining([
      ["Illness", "Fever, day 2"],
      ["Last Tylenol", expect.stringMatching(/10:15 AM, .+ ago, 5 ml$/)],
    ]),
  });
});

test("record_event: a temperature remembers its illness; send it and undo deletes it", async () => {
  const args = {
    person: "millie",
    what: "took temperature",
    details: { Temperature: "100.4" },
    when: "2026-10-21 18:30",
  };
  expect((await p.ask("record_event", args)).remember).toEqual([
    { key: "illness:fever", label: `Millie's fever since ${kit.monthDay("2026-10-20")}` },
  ]);
  const sent = await p.send("record_event", args);
  expect(sent.outcome.changes.map(requestOf)).toMatchObject([
    { method: "POST", path: "/api/collections/event/records", body: { episode: "fever", what: "Took temperature" } },
  ]);
  expect(sent.undo).toEqual([{ remove: "made1" }]);
  expect((await p.undo("record_event", sent.undo)).changes.map(requestOf)).toEqual([
    { method: "DELETE", path: "/api/collections/event/records/made1", body: null },
  ]);
});

test("record_event: a kind the log has never used offers the nearest kinds and itself", async () => {
  const args = { person: "Millie", what: "Took Tylenol", details: { Amount: "5 ml" }, when: "2026-10-21 14:40" };
  const card = await p.ask("record_event", args);
  expect(card.choices!.map((c) => [c.label, c.detail])).toEqual([
    ["Took medicine: Tylenol", "Amount"],
    ["New kind: Took Tylenol", undefined],
  ]);
  expect(card.show[0]).toMatchObject({ rows: expect.arrayContaining([["What", "Took Tylenol (new kind)"]]) });
  const kept = await p.rehearse("record_event", args);
  expect(requestOf(kept.changes[0]!).body).toMatchObject({ what: "Took medicine: Tylenol " });
  const fresh = await p.rehearse("record_event", args, [{ choice: card.choices![1]!.key }]);
  expect(requestOf(fresh.changes[0]!).body).toMatchObject({ what: "Took Tylenol" });
});

test("record_event: several open illnesses are choices", async () => {
  const args = { person: "Scott", what: "Threw up", details: { Amount: "A lot" }, when: "2026-10-21 19:00" };
  const card = await p.ask("record_event", args);
  expect(card.choices!.map((c) => c.label)).toEqual(["Back pain", "Cold"]);
  const r = await p.rehearse("record_event", args, [{ choice: "cold" }]);
  expect(requestOf(r.changes[0]!).body).toMatchObject({ episode: "cold", what: "Threw up" });
});

test("start_illness: a last illness that ended within two days can be reopened instead, and undone", async () => {
  const args = { person: "Liam", sickness: "Fever", start: "2026-10-22 18:00" };
  const card = await p.ask("start_illness", args);
  expect(card.title).toMatch(/^Record Liam's fever, from .*6:00 PM\?$/);
  expect(card.choices!.map((c) => c.label)).toEqual(["New illness: Fever", "Reopen Cold"]);
  const reopened = await p.send("start_illness", args, [{ choice: "reopen" }]);
  expect(reopened.outcome.changes.map(requestOf)).toEqual([
    { method: "PATCH", path: "/api/collections/episode/records/liamcold", body: { end: "" } },
  ]);
  expect((await p.undo("start_illness", reopened.undo)).changes.map(requestOf)).toEqual([
    { method: "PATCH", path: "/api/collections/episode/records/liamcold", body: { end: "2026-10-22 00:00:00.000Z" } },
  ]);
  const made = await p.send("start_illness", args, [{ choice: "new" }]);
  expect(made.outcome.changes.map(requestOf)[0]).toMatchObject({
    method: "POST",
    body: { person: "liam", sickness: "Fever", start: "2026-10-22T18:00:00-06:00" },
  });
  expect((await p.undo("start_illness", made.undo)).changes.map(requestOf)).toEqual([
    { method: "DELETE", path: "/api/collections/episode/records/made1", body: null },
  ]);
});

test("update_illness: undo puts back what the change replaced", async () => {
  const sent = await p.send("update_illness", { person: "Millie", better: "2026-10-22 08:00", note: "Back at school" });
  expect(sent.cards[0]!.show[0]).toEqual({
    t: "changes",
    rows: [
      ["Better", "none", expect.stringContaining("8:00 AM")],
      ["Note", "none", "Back at school"],
    ],
  });
  expect((await p.undo("update_illness", sent.undo)).changes.map(requestOf)).toEqual([
    { method: "PATCH", path: "/api/collections/episode/records/fever", body: { end: "", note: "" } },
  ]);
});

test("fix_event: details replaced as a set, a dropped one reading before → none; undo puts them back", async () => {
  const sent = await p.send("fix_event", { id: "temp1", details: { Temperature: "102.1" } });
  expect(sent.cards[0]!.show[0]).toEqual({
    t: "changes",
    rows: [
      ["Temperature", "101.2°F", "102.1°F"],
      ["Device", "Head thermometer", "none"],
    ],
  });
  expect(sent.cards[0]!.remember).toEqual([]);
  expect((await p.undo("fix_event", sent.undo)).changes.map(requestOf)).toEqual([
    { method: "PATCH", path: "/api/collections/event/records/temp1", body: { data: events[1]!.data } },
  ]);
  const one = await p.ask("fix_event", { id: "temp1", details: { Temperature: "102.1", Device: "Head thermometer" } });
  expect(one.title).toMatch(/^Fix Millie's temperature on .+ at 11:00 AM: 101\.2°F to 102\.1°F$/);
});
