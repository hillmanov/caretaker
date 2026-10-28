import { expect, test } from "bun:test";
import { kit } from "../../tools/kit";
import { appTools, requestOf } from "../../tools/test-kit";

const t = await appTools("caretaker");
const API = "/api/collections";
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[-+]\d{2}:\d{2}$/;
const OCT21 = kit.monthDay("2026-10-21");

const { illnesses: all } = await t.read("illnesses");
const sick = all.find((i: any) => i.stillSick);
const over = all.find((i: any) => !i.stillSick);
const family = ["Scott", "Esther", "Darcy", "Adrie", "Liam", "Millie"];
// Someone well whose last illness ended before Oct 19, so a start on Oct 21 offers no reopening.
const well = family.find((n) => {
  const theirs = all.filter((i: any) => i.person === n);
  return !theirs.some((i: any) => i.stillSick) && (!theirs[0] || theirs[0].end.slice(0, 10) < "2026-10-19");
});
const [fever] = (await t.read("illnesses", { person: "Millie", sickness: "fever" })).illnesses;
const [latest] = await t.read("events", { limit: 1 });
const [tylenol] = await t.read("events", { what: "Tylenol", limit: 1 });
const withDetails = (await t.read("events", { limit: 50 })).find((e: any) => e.details);

test("illnesses: newest first, with a count, filtered by person, sickness and day", async () => {
  expect(all.length).toBeGreaterThan(0);
  const liam = await t.read("illnesses", { person: "liam" });
  expect(liam.count).toBe(liam.illnesses.length);
  expect(liam.illnesses.every((i: any) => i.person === "Liam")).toBe(true);
  const now = await t.read("illnesses", { sickNow: true });
  expect(now.illnesses.every((i: any) => i.stillSick)).toBe(true);
  const fevers = await t.read("illnesses", { sickness: "fever" });
  expect(fevers.illnesses.every((i: any) => /fever/i.test(`${i.sickness} ${i.name}`))).toBe(true);
  const recent = await t.read("illnesses", { since: "2025-01-01" });
  expect(recent.illnesses.every((i: any) => i.start >= "2025-01-01")).toBe(true);
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
  const i = await t.read("illness", { person: all[0].person, id: all[0].id });
  expect(i.id).toBe(all[0].id);
  expect(i.happened.length).toBe(i.events);
  expect(i.start).toMatch(/^\d{4}-\d{2}-\d{2} \d{1,2}:\d{2} [AP]M$/);
});

test.skipIf(!fever)("illness: the person's latest one like a sickness", async () => {
  expect((await t.read("illness", { person: "millie", sickness: "fever" })).id).toBe(fever.id);
});

test("illness: a sickness the person never had names theirs", async () => {
  await expect(t.read("illness", { person: "Millie", sickness: "zzzqx" })).rejects.toThrow("Theirs: ");
});

test("illness: someone else's illness by its id is refused, and the person is required", async () => {
  const other = family.find((n) => n !== all[0].person)!;
  await expect(t.read("illness", { person: other, id: all[0].id })).rejects.toThrow(
    `is ${all[0].person}'s, not ${other}'s`,
  );
  await expect(t.read("illness", { sickness: "fever" })).rejects.toThrow("person");
});

test("events: temperatures across illnesses, newest first", async () => {
  const temps = await t.read("events", { what: "temperature", limit: 10 });
  expect(temps.length).toBeGreaterThan(0);
  for (const e of temps) expect(e.person).toBeString();
  expect(temps.some((e: any) => e.details?.Temperature)).toBe(true);
  const whens = temps.map((e: any) => e.when);
  expect(whens.every((w: string, i: number) => !i || w.slice(0, 10) <= whens[i - 1].slice(0, 10))).toBe(true);
});

test("kinds: the spellings in use", async () => {
  const kinds = await t.read("kinds");
  expect(kinds.map((x: any) => x.what)).toContain("Took temperature");
});

test.skipIf(!well)("start_illness: its card names the person and the start, and it posts the illness", async () => {
  const args = { person: well!.toLowerCase(), sickness: "Fever", start: "2026-10-21T07:30" };
  const card = await t.ask("start_illness", args);
  expect(card).toMatchObject({ title: `Record ${well}'s fever, from ${OCT21}, 7:30 AM`, remember: [], yes: "Record" });
  expect(card.choices).toBeUndefined();
  expect(card.show[0]).toMatchObject({
    t: "facts",
    rows: expect.arrayContaining([
      ["Person", well],
      ["Sickness", "Fever"],
      ["Start", `${OCT21}, 7:30 AM`],
    ]),
  });
  const r = await t.rehearse("start_illness", args);
  expect(r.changes.map(requestOf)).toEqual([
    {
      method: "POST",
      path: `${API}/episode/records`,
      body: {
        person: expect.any(String),
        name: "Fever",
        sickness: "Fever",
        start: "2026-10-21T07:30:00-06:00",
        end: "",
        note: "",
      },
    },
  ]);
  expect(r.undo).toEqual([{ remove: expect.stringContaining("request 1") }]);
});

test("start_illness: refuses a time with an offset, naming the form it takes", async () => {
  expect(
    await t.refuses("start_illness", { person: "Scott", sickness: "Cold", start: "2026-10-21T07:30:00-06:00" }),
  ).toContain("YYYY-MM-DD HH:MM");
});

test.skipIf(!sick)("start_illness: refuses someone already sick", async () => {
  expect(await t.refuses("start_illness", { person: sick.person, sickness: "Cold" })).toContain("already sick");
});

test.skipIf(!sick)("record_event: a temperature's card gives the child, the reading in °F and the time", async () => {
  const args = {
    person: sick.person,
    what: "Took temperature",
    details: { Temperature: "101.2" },
    when: "2026-10-21 14:05",
  };
  const card = await t.ask("record_event", args);
  expect(card).toMatchObject({
    title: `Log ${sick.person}'s temperature, 101.2°F on ${OCT21} at 2:05 PM`,
    remember: [{ key: `illness:${sick.id}`, label: expect.stringContaining(`${sick.person}'s `) }],
    yes: "Log",
  });
  expect(card.show[0]).toMatchObject({
    rows: expect.arrayContaining([
      ["Person", sick.person],
      ["Illness", expect.stringContaining(`${sick.name}, day `)],
      ["Temperature", "101.2°F"],
      ["When", `${OCT21}, 2:05 PM`],
    ]),
  });
  const r = await t.rehearse("record_event", args);
  expect(r.changes.map(requestOf)).toEqual([
    {
      method: "POST",
      path: `${API}/event/records`,
      body: {
        episode: sick.id,
        what: "Took temperature",
        when: "2026-10-21T14:05:00-06:00",
        where: "",
        data: [{ thing: "Temperature", detail: "101.2" }],
        note: "",
        recordedBy: expect.any(String),
      },
    },
  ]);
  expect(r.undo).toEqual([{ remove: expect.stringContaining("request 1") }]);
});

test.skipIf(!sick)(
  "record_event: a dose keeps the log's spelling, shows the last one and remembers nothing",
  async () => {
    const args = {
      person: sick.person,
      what: "took medicine tylenol",
      details: { Amount: "2 pills" },
      where: "couch",
      when: "2026-10-21 14:05",
    };
    const card = await t.ask("record_event", args);
    expect(card).toMatchObject({ title: `Log ${sick.person}'s Tylenol, 2 pills on ${OCT21} at 2:05 PM`, remember: [] });
    expect(card.show[0]).toMatchObject({
      rows: expect.arrayContaining([
        ["What", "Took medicine: Tylenol"],
        ["Last Tylenol", expect.stringMatching(/^none$| ago/)],
      ]),
    });
    const { changes } = await t.rehearse("record_event", args);
    expect(requestOf(changes[0]!).body).toMatchObject({
      episode: sick.id,
      what: "Took medicine: Tylenol ",
      where: "Couch",
      data: [{ thing: "Amount", detail: "2 pills" }],
    });
  },
);

test.skipIf(!sick)("record_event: a kind the log has never used offers the nearest ones", async () => {
  const card = await t.ask("record_event", { person: sick.person, what: "Took Tylenol", details: { Amount: "5 ml" } });
  expect(card.remember).toEqual([]);
  expect(card.choices!.map((c) => c.label)).toEqual(["Took medicine: Tylenol", "New kind: Took Tylenol"]);
});

test.skipIf(!well)("record_event: refuses someone who isn't sick", async () => {
  const why = await t.refuses("record_event", {
    person: well,
    what: "Took temperature",
    details: { Temperature: "101" },
  });
  expect(why).toContain("isn't sick now");
});

test.skipIf(!sick)("update_illness: marks the open illness better, its end before → after", async () => {
  const card = await t.ask("update_illness", { person: sick.person, better: "2026-10-21 18:00" });
  expect(card).toMatchObject({
    title: `Mark ${sick.person} better from ${sick.name.replace(/^[A-Z](?=[a-z])/, (c: string) => c.toLowerCase())} on ${OCT21} at 6:00 PM`,
    show: [{ t: "changes", rows: [["Better", "none", `${OCT21}, 6:00 PM`]] }, { t: "facts" }],
    remember: [],
  });
  const r = await t.rehearse("update_illness", { person: sick.person, better: true });
  expect(r.changes.map(requestOf)).toEqual([
    { method: "PATCH", path: `${API}/episode/records/${sick.id}`, body: { end: expect.stringMatching(TIME) } },
  ]);
  expect(r.undo).toEqual([{ id: sick.id, old: { end: "" } }]);
});

test.skipIf(!over)(
  "update_illness: changes a note, and refuses an illness that's over or nothing to change",
  async () => {
    const card = await t.ask("update_illness", { person: over.person, id: over.id, note: "Test note" });
    expect(card.show[0]).toEqual({ t: "changes", rows: [["Note", over.note ?? "none", "Test note"]] });
    const r = await t.rehearse("update_illness", { person: over.person, id: over.id, note: "Test note" });
    expect(r.changes.map(requestOf)).toEqual([
      { method: "PATCH", path: `${API}/episode/records/${over.id}`, body: { note: "Test note" } },
    ]);
    expect(await t.refuses("update_illness", { person: over.person, id: over.id, better: true })).toContain(
      "already over",
    );
    expect(await t.refuses("update_illness", { person: over.person, id: over.id })).toContain("Nothing to change");
  },
);

test.skipIf(!latest)("fix_event: patches only what changed, each detail before → after", async () => {
  const card = await t.ask("fix_event", { id: latest.id, details: { Amount: "Test amount" } });
  expect(card).toMatchObject({ title: expect.stringMatching(/^Fix /), remember: [], yes: "Fix" });
  expect(card.show[0]).toMatchObject({
    t: "changes",
    rows: expect.arrayContaining([["Amount", latest.details?.Amount ?? "none", "Test amount"]]),
  });
  const r = await t.rehearse("fix_event", { id: latest.id, details: { Amount: "Test amount" } });
  expect(r.changes.map(requestOf)).toEqual([
    {
      method: "PATCH",
      path: `${API}/event/records/${latest.id}`,
      body: { data: [{ thing: "Amount", detail: "Test amount" }] },
    },
  ]);
  expect(r.undo).toHaveLength(1);
  expect(r.undo[0]).toMatchObject({ id: latest.id });
  expect(Object.keys((r.undo[0] as any).old)).toEqual(["data"]);
});

test.skipIf(!withDetails)("fix_event: a detail left out reads before → none", async () => {
  const card = await t.ask("fix_event", { id: withDetails.id, details: {} });
  const [thing, detail] = Object.entries(withDetails.details)[0]! as [string, string];
  expect(card.show[0]).toMatchObject({
    rows: expect.arrayContaining([[thing, expect.stringContaining(detail), "none"]]),
  });
});

test("fix_event: refuses an event it doesn't have", async () => {
  expect(await t.refuses("fix_event", { id: "nosuchevent0000", note: "x" })).toContain("No event");
});

test.skipIf(!tylenol)("fix_event: a what differing only in spaces keeps the log's spelling", async () => {
  const { changes } = await t.rehearse("fix_event", {
    id: tylenol.id,
    what: tylenol.what,
    details: { Amount: "10 ml" },
  });
  expect(requestOf(changes[0]!).body).toEqual({ data: [{ thing: "Amount", detail: "10 ml" }] });
});
