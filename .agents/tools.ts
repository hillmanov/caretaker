// Caretaker's tools: the family's illnesses and what happened in each.
import type { Http, Kit } from "../../tools/kit";

interface Person {
  id: string;
  name: string;
}
interface Illness {
  id: string;
  person: string;
  name: string;
  sickness: string;
  start: string;
  end: string;
  note: string;
}
interface Detail {
  thing: string;
  detail: string;
}
interface Event {
  id: string;
  episode: string;
  what: string;
  when: string;
  where: string;
  data: Detail[] | null;
  note: string;
  recordedBy: string;
}
interface Kind {
  what: string;
  thing: string;
  detail: string;
}

const DAY_MS = 86_400_000;
// "Took medicine: Tylenol " and the older "Gave Tylenol" are doses; the rest of the what is the medicine.
const DOSE = /^\s*(?:took medicine|gave medicine|gave)\b\s*:?\s*(.*)$/i;
const NEW = "\u0000new";

export default (k: Kit) => {
  const z = k.z;

  const load = async (http: Http) => {
    const pb = k.pocketbase(http);
    const [people, illnesses, events] = await Promise.all([
      pb.list<Person>("person", { sort: "name" }),
      pb.list<Illness>("episode", { sort: "-start" }),
      pb.list<Event>("event", { sort: "when" }),
    ]);
    return { people, illnesses, events };
  };
  type Data = Awaited<ReturnType<typeof load>>;
  const kinds = (http: Http) => k.pocketbase(http).list<Kind>("whats_things_details", { sort: "what" });

  // PocketBase keeps UTC as "2026-02-15 14:40:36.000Z".
  const local = (s: string) => (s ? k.when(s) : null);
  /** A wall-clock time in the user's zone (default now), as an ISO time with its offset, as the app sends. */
  const zoned = (s?: string) => k.zoned(s ? k.instant(s) : new Date());
  /** A time as a card gives it: "2:40 PM" today, else "Oct 21, 2:40 PM" ("Dec 3, 2024, 2:40 PM" in another year). */
  const at = (t: string) => {
    const clock = k.time(t, { time: "only" });
    return k.date(t) === k.today() ? clock : `${k.monthDay(t)}, ${clock}`;
  };
  /** A time as a title says it: "at 2:40 PM" today, else "on Oct 21 at 2:40 PM". */
  const on = (t: string) => {
    const clock = k.time(t, { time: "only" });
    return k.date(t) === k.today() ? `at ${clock}` : `on ${k.monthDay(t)} at ${clock}`;
  };
  const time = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}[T ]\d{1,2}:\d{2}(:\d{2})?$/, "YYYY-MM-DD HH:MM")
    .describe("YYYY-MM-DD HH:MM in the user's time zone, 24-hour (default now)");
  const has = (text: string, part: string) => text.toLowerCase().includes(part.trim().toLowerCase());
  /** A name as it reads mid-sentence: "Fever" is "fever", "RSV" stays. */
  const lower = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0]!.toLowerCase() + s.slice(1) : s);
  /**
   * Illnesses whose sickness or name has the words, else any word of three letters or more ("stomach bug" finds
   * "stomach thing").
   */
  const about = (illnesses: Illness[], text: string) => {
    const phrase = illnesses.filter((i) => has(i.sickness, text) || has(i.name, text));
    if (phrase.length) return phrase;
    const words = text.split(/\W+/).filter((w) => w.length >= 3);
    return illnesses.filter((i) => words.some((w) => has(i.sickness, w) || has(i.name, w)));
  };
  /** The log's spelling of a what that differs only in case, spaces or punctuation; undefined for a new kind. */
  const spelling = (rows: Kind[], what: string) => rows.find((x) => k.norm(x.what) === k.norm(what))?.what;
  /** A where as the log spells it, when one differs only in case or spaces. */
  const place = (d: Data, where?: string) =>
    (where !== undefined && d.events.find((e) => e.where && k.norm(e.where) === k.norm(where))?.where) ||
    where?.trim() ||
    "";
  const details = (d: Record<string, string>) => Object.entries(d).map(([thing, detail]) => ({ thing, detail }));
  /** The medicine a dose's what names ("Tylenol"), or null for a what that isn't a dose. */
  const medicine = (what: string) => {
    const m = DOSE.exec(what);
    return m ? m[1]!.trim() || "medicine" : null;
  };
  /** A detail with its unit: a bare temperature is in °F. */
  const withUnit = (x: Detail) =>
    /temperature/i.test(x.thing) && /^\d+(\.\d+)?$/.test(x.detail.trim()) ? `${x.detail.trim()}°F` : x.detail;
  /** What an event is, as a title names it: "temperature", the medicine, else its what. */
  const thing = (what: string) => (/temperature/i.test(what) ? "temperature" : (medicine(what) ?? what.trim()));
  /** What an event is and its key value with its unit: "temperature, 101.2°F", "Tylenol, 5 ml". */
  const headline = (what: string, data: Detail[]) => {
    const key = data.find((x) => /temperature/i.test(x.thing)) ?? data.find((x) => /amount/i.test(x.thing));
    return key?.detail.trim() ? `${thing(what)}, ${withUnit(key)}` : thing(what);
  };
  /** The kinds nearest a what the log has never used: those holding its words (or held in them), else sharing one. */
  const nearest = (whats: string[], what: string) => {
    const hits = k.matches(whats, what, { kind: "kind", names: (w) => [w] });
    if (hits.length) return hits.slice(0, 5);
    const words = new Set(
      k
        .norm(what)
        .split(" ")
        .filter((w) => w.length >= 3),
    );
    return whats
      .filter((w) =>
        k
          .norm(w)
          .split(" ")
          .some((x) => words.has(x)),
      )
      .slice(0, 5);
  };

  const nameOf = (d: Data, id: string) => d.people.find((p) => p.id === id)?.name ?? id;
  const person = (d: Data, name: string) =>
    k.find(d.people, name, { kind: "person", kinds: "people", names: (p) => [p.name] });
  const entries = (d: Data, i: Illness) => d.events.filter((e) => e.episode === i.id).length;
  const illness = (d: Data, i: Illness) => {
    const days = ((i.end ? Date.parse(i.end) : Date.now()) - Date.parse(i.start)) / DAY_MS;
    return {
      id: i.id,
      person: nameOf(d, i.person),
      name: i.name.trim(),
      sickness: i.sickness.trim(),
      start: local(i.start),
      ...(i.end ? { end: local(i.end) } : { stillSick: true }),
      // A few old illnesses end before they start.
      ...(days >= 0 ? { days: Math.round(days * 10) / 10 } : {}),
      ...(i.note.trim() ? { note: i.note.trim() } : {}),
      events: entries(d, i),
    };
  };
  const event = (d: Data, e: Event, withPerson = false) => {
    const i = d.illnesses.find((x) => x.id === e.episode);
    const data = (e.data ?? []).filter((x) => x.thing || x.detail);
    return {
      id: e.id,
      when: local(e.when),
      ...(withPerson && i ? { person: nameOf(d, i.person), illness: i.name.trim() } : {}),
      what: e.what.trim(),
      ...(e.where ? { where: e.where } : {}),
      ...(data.length ? { details: Object.fromEntries(data.map((x) => [x.thing || "detail", x.detail])) } : {}),
      ...(e.note.trim() ? { note: e.note.trim() } : {}),
      ...(e.recordedBy ? { recordedBy: nameOf(d, e.recordedBy) } : {}),
    };
  };
  /** "Millie's stomach bug since Feb 15": an illness as a card and the Rules page name it. */
  const label = (d: Data, i: Illness) =>
    `${nameOf(d, i.person)}'s ${lower(i.name.trim())} since ${k.monthDay(i.start)}`;
  const illnessChoice = (d: Data, i: Illness) => ({
    key: i.id,
    label: i.name.trim(),
    detail: `since ${at(i.start)}, ${k.count(entries(d, i), "entry", "entries")}`,
  });
  /** A person's illness by its id, else their open ones (else, unless open, their latest): one, or several to pick. */
  const candidates = (d: Data, a: { id?: string; person: string }, open: boolean): Illness[] => {
    const p = person(d, a.person);
    if (a.id) {
      const i = d.illnesses.find((x) => x.id === a.id);
      if (!i) throw new Error(`No illness ${a.id}.`);
      if (i.person !== p.id) throw new Error(`Illness ${a.id} is ${nameOf(d, i.person)}'s, not ${p.name}'s.`);
      return [i];
    }
    const theirs = d.illnesses.filter((x) => x.person === p.id);
    const openOnes = theirs.filter((x) => !x.end);
    if (openOnes.length > 6)
      throw new Error(
        `${p.name} has several open illnesses; give the id: ${JSON.stringify(openOnes.map((x) => illness(d, x)))}`,
      );
    if (openOnes.length) return openOnes;
    if (!open && theirs[0]) return [theirs[0]];
    throw new Error(
      `${p.name} isn't sick now.${theirs[0] ? ` Their last illness: ${JSON.stringify(illness(d, theirs[0]))}` : ""}`,
    );
  };

  return k.app({
    name: "caretaker",
    title: "Caretaker",
    description:
      "Caretaker, the family's illness log for Scott, Esther, Darcy, Adrie, Liam and Millie: when each got sick and better, and the temperatures, medicine doses and symptoms recorded in each illness. Who is sick now, when a kid or parent was last sick and with what, how often someone has been sick, and what happened during an illness (temperatures, Tylenol or ibuprofen doses, throwing up, what they ate or drank, naps); recording a new illness, a temperature, medicine or symptom, and marking someone better.",
    url: "http://127.0.0.1:3013",
    icon: "client/public/icons/icon-192.png",
    reads: {
      illnesses: k.tool({
        title: "Illnesses",
        description:
          "Illnesses, newest first, with how many match: each with its id, person, name, sickness, start and end (in the user's zone; stillSick while open), length in days, note, and how many events it has. Temperatures are Fahrenheit.",
        input: {
          person: z.string().optional(),
          sickNow: z.boolean().optional().describe("Only illnesses still open"),
          sickness: z
            .string()
            .optional()
            .describe("Only illnesses whose sickness or name contains this (any case), else any of its words"),
          since: k.day.optional().describe("Only illnesses that started on or after this day"),
        },
        async run(a, { http }) {
          const d = await load(http);
          const who = a.person ? person(d, a.person) : null;
          const theirs = d.illnesses.filter((i) => !who || i.person === who.id);
          const rows = (a.sickness ? about(theirs, a.sickness) : theirs)
            .filter((i) => !a.sickNow || !i.end)
            .filter((i) => !a.since || k.date(i.start) >= a.since)
            .map((i) => illness(d, i));
          return { count: rows.length, illnesses: rows };
        },
      }),
      illness: k.tool({
        title: "Illness",
        description:
          "One of a person's illnesses and everything that happened in it, in order: by its id, their latest illness with a sickness or name like the one given, or their open illness (else their latest).",
        input: {
          person: z.string(),
          id: z.string().optional().describe("The illness's id from illnesses"),
          sickness: z.string().optional().describe("What it was called, like stomach bug or fever (any case)"),
        },
        async run(a, { http }) {
          const d = await load(http);
          let i: Illness;
          if (a.sickness && !a.id) {
            const p = person(d, a.person);
            const theirs = d.illnesses.filter((x) => x.person === p.id);
            const found = about(theirs, a.sickness)[0];
            if (!found)
              throw new Error(
                `${p.name} has no illness like "${a.sickness}". Theirs: ${JSON.stringify(theirs.map((x) => illness(d, x)))}`,
              );
            i = found;
          } else {
            const found = candidates(d, a, false);
            if (found.length > 1)
              throw new Error(
                `${nameOf(d, found[0]!.person)} has several open illnesses; give the id: ${JSON.stringify(found.map((x) => illness(d, x)))}`,
              );
            i = found[0]!;
          }
          return { ...illness(d, i), happened: d.events.filter((e) => e.episode === i.id).map((e) => event(d, e)) };
        },
      }),
      events: k.tool({
        title: "Events",
        description:
          "Things that happened across illnesses (temperatures, medicine, throwing up, food and drink, naps), newest first: each with its id, time, person, illness, what, where, details (like Temperature, Amount), note, and who recorded it.",
        input: {
          person: z.string().optional(),
          what: z
            .string()
            .optional()
            .describe(
              "Only events whose what or details contain this (any case): temperature, Tylenol, ibuprofen, threw up, drank…",
            ),
          since: k.day.optional().describe("Only events on or after this day"),
          limit: z.number().int().min(1).max(500).default(50),
        },
        async run(a, { http }) {
          const d = await load(http);
          const who = a.person ? person(d, a.person) : null;
          const theirs = new Set(d.illnesses.filter((i) => !who || i.person === who.id).map((i) => i.id));
          return d.events
            .filter((e) => theirs.has(e.episode))
            .filter(
              (e) =>
                !a.what || has(e.what, a.what) || (e.data ?? []).some((x) => has(`${x.thing} ${x.detail}`, a.what!)),
            )
            .filter((e) => !a.since || k.date(e.when) >= a.since)
            .reverse()
            .slice(0, a.limit)
            .map((e) => event(d, e, true));
        },
      }),
      kinds: k.tool({
        title: "Kinds of events",
        description:
          'Every kind of event in use, as spelled in the log ("Took medicine: Tylenol " has its trailing space), with each thing it records and the details used for it.',
        async run(_, { http }) {
          const groups = new Map<string, Map<string, Set<string>>>();
          for (const r of await kinds(http)) {
            const things = groups.get(r.what) ?? groups.set(r.what, new Map()).get(r.what)!;
            if (r.thing) (things.get(r.thing) ?? things.set(r.thing, new Set()).get(r.thing)!).add(r.detail);
          }
          return [...groups].map(([what, things]) => ({
            what,
            things: Object.fromEntries([...things].map(([t, ds]) => [t, [...ds]])),
          }));
        },
      }),
    },
    writes: {
      start_illness: k.write({
        title: "Record an illness",
        description:
          "Records that someone got sick. A person with an illness still open isn't given a second one. When their last illness ended within two days of the start, the card also offers reopening it instead.",
        input: {
          person: z.string(),
          sickness: z.string().min(1).describe("What it is: Cold, Fever, Throwing up…"),
          name: z.string().optional().describe("A title for it (default the sickness)"),
          start: time.optional(),
          note: z.string().optional(),
        },
        async run(a, { http, ask, undo }) {
          const d = await load(http);
          const p = person(d, a.person);
          const theirs = d.illnesses.filter((i) => i.person === p.id);
          const open = theirs.find((i) => !i.end);
          if (open) throw new Error(`${p.name} is already sick: ${JSON.stringify(illness(d, open))}`);
          const start = zoned(a.start);
          const sickness = a.sickness.trim();
          const name = (a.name ?? a.sickness).trim();
          const [last] = theirs;
          const facts = k.show.facts({
            Person: p.name,
            Sickness: sickness,
            Name: name !== sickness ? name : null,
            Start: at(start),
            Note: a.note?.trim(),
            "Last illness": last && `${last.name.trim()}, ended ${at(last.end)}`,
          });
          const title = `Record ${p.name}'s ${lower(sickness)}, from ${at(start)}`;
          const pb = k.pocketbase(http);
          if (last && Date.parse(start) - Date.parse(last.end) < 2 * DAY_MS) {
            const pick = await ask({
              title: `${title}?`,
              show: [facts],
              choices: [
                { key: "new", label: `New illness: ${name}`, detail: `from ${at(start)}` },
                {
                  key: "reopen",
                  label: `Reopen ${last.name.trim()}`,
                  detail: `${k.monthDay(last.start)} to ${at(last.end)}, ${k.count(entries(d, last), "entry", "entries")}`,
                },
              ],
              yes: "Record",
            });
            if (pick === "reopen") {
              const r = await pb.update<Illness>("episode", last.id, { end: "" });
              undo({ id: last.id, end: last.end });
              return illness(d, r);
            }
          } else await ask({ title, show: [facts], yes: "Record" });
          const r = await pb.create<Illness>("episode", {
            person: p.id,
            name,
            sickness,
            start,
            end: "",
            note: a.note ?? "",
          });
          undo({ remove: r.id });
          return illness({ ...d, illnesses: [r, ...d.illnesses] }, r);
        },
        undo: (u: { remove: string } | { id: string; end: string }, { http }) =>
          "remove" in u
            ? k.pocketbase(http).delete("episode", u.remove)
            : k.pocketbase(http).update("episode", u.id, { end: u.end }),
      }),
      record_event: k.write({
        title: "Record what happened",
        description:
          'Records one thing that happened in someone\'s open illness (or an illness by its id): a temperature, medicine, throwing up or another symptom, food or drink, a nap. A temperature is what "Took temperature" with the detail Temperature (°F, like 101.4); medicine is what "Took medicine: Tylenol " or "Took medicine: Ibuprofen" with Amount (like 2 pills, 10 ml). A what already in use, differing only in case, spaces or punctuation, keeps the log\'s spelling; one the log has never used is offered on the card beside the kinds nearest it.',
        input: {
          person: z.string(),
          id: z.string().optional().describe("The illness's id, when it isn't the person's open one"),
          what: z.string().min(1),
          details: z
            .record(z.string(), z.string())
            .optional()
            .describe('Thing to detail, like {"Temperature": "101.4"} or {"Amount": "2 pills"}'),
          when: time.optional(),
          where: z.string().optional().describe("Couch, Bed, Bathroom, Kitchen…"),
          note: z.string().optional(),
          recordedBy: z.string().default("Scott"),
        },
        async run(a, { http, ask, undo }) {
          const [d, rows] = await Promise.all([load(http), kinds(http)]);
          const p = person(d, a.person);
          const ill = candidates(d, a, true);
          const by = person(d, a.recordedBy);
          const known = spelling(rows, a.what);
          let what = known ?? a.what.trim();
          const where = place(d, a.where);
          const when = zoned(a.when);
          const data = details(a.details ?? {});
          const near = known ? [] : nearest([...new Set(rows.map((x) => x.what))], what);
          const dup = d.events.find(
            (e) =>
              ill.some((i) => i.id === e.episode) &&
              [what, ...near].some((w) => k.norm(w) === k.norm(e.what)) &&
              Math.abs(Date.parse(e.when) - Date.parse(when)) < 60_000,
          );
          if (dup) throw new Error(`Already recorded: ${JSON.stringify(event(d, dup))}`);
          const theirs = new Set(d.illnesses.filter((i) => i.person === p.id).map((i) => i.id));
          const lastDose = (m: string) => {
            const e = d.events
              .filter(
                (x) =>
                  theirs.has(x.episode) &&
                  Date.parse(x.when) <= Date.parse(when) &&
                  k.norm(medicine(x.what) ?? "") === k.norm(m),
              )
              .at(-1);
            const amount = e && (e.data ?? []).find((x) => /amount/i.test(x.thing))?.detail;
            return e ? [at(e.when), k.ago(e.when), amount].filter(Boolean).join(", ") : "none";
          };
          // A dose shows the last one of the same medicine, also for a near kind the card offers.
          const doses = new Map(
            [what, ...near].flatMap((w) => medicine(w) ?? []).map((m): [string, string] => [k.norm(m), m]),
          );
          const facts = (i?: Illness) =>
            k.show.facts([
              ["Person", p.name],
              ["Illness", i && `${i.name.trim()}, day ${k.daysSince(k.date(i.start), k.date(when)) + 1}`],
              ["What", known ? known.trim() : `${what} (new kind)`],
              ...data.map((x): [string, string] => [x.thing || "Detail", withUnit(x)]),
              ["When", at(when)],
              ["Where", where],
              ["Note", a.note?.trim()],
              ["Recorded by", by.name],
              ...[...doses.values()].map((m): [string, string] => [`Last ${m}`, lastDose(m)]),
            ]);
          const title = `Log ${p.name}'s ${headline(what, data)} ${on(when)}`;
          let [i] = ill as [Illness];
          if (ill.length > 1) {
            if (near.length)
              throw new Error(
                `${p.name} has several open illnesses; give the id: ${JSON.stringify(ill.map((x) => illness(d, x)))}`,
              );
            const id = await ask({
              title: `${title}?`,
              show: [facts()],
              choices: ill.map((x) => illnessChoice(d, x)),
              yes: "Log",
            });
            i = ill.find((x) => x.id === id)!;
          } else if (near.length) {
            const things = (w: string) => [...new Set(rows.filter((r) => r.what === w && r.thing).map((r) => r.thing))];
            const pick = await ask({
              title: `${title}?`,
              show: [facts(i)],
              choices: [
                ...near.map((w) => ({ key: w, label: w.trim(), detail: things(w).join(", ") || undefined })),
                { key: NEW, label: `New kind: ${what}` },
              ],
              yes: "Log",
            });
            if (pick !== NEW) what = pick;
          } else
            await ask({
              title,
              show: [facts(i)],
              // A dose shows the last one every time, and a kind the log has never used may be a typo.
              remember: known && !medicine(what) ? { key: `illness:${i.id}`, label: label(d, i) } : undefined,
              yes: "Log",
            });
          const r = await k.pocketbase(http).create<Event>("event", {
            episode: i.id,
            what,
            when,
            where,
            data,
            note: a.note ?? "",
            recordedBy: by.id,
          });
          undo({ remove: r.id });
          return event({ ...d, events: [...d.events, r] }, r, true);
        },
        undo: (u: { remove: string }, { http }) => k.pocketbase(http).delete("event", u.remove),
      }),
      update_illness: k.write({
        title: "Update an illness",
        description:
          "Marks someone's open illness over (better: the time they got better), or changes an illness's name, sickness, start or note. Found by the person's open illness, else their latest, or by its id.",
        input: {
          person: z.string(),
          id: z.string().optional().describe("The illness's id from illnesses"),
          better: z
            .union([z.literal(true), time])
            .optional()
            .describe("true for now, or the time they got better"),
          name: z.string().optional(),
          sickness: z.string().optional(),
          start: time.optional(),
          note: z.string().optional(),
        },
        async run(a, { http, ask, undo }) {
          const d = await load(http);
          const ill = candidates(d, a, a.better !== undefined);
          const patch: Partial<Illness> = {};
          if (a.better !== undefined) patch.end = zoned(a.better === true ? undefined : a.better);
          if (a.name !== undefined) patch.name = a.name.trim();
          if (a.sickness !== undefined) patch.sickness = a.sickness.trim();
          if (a.start !== undefined) patch.start = zoned(a.start);
          if (a.note !== undefined) patch.note = a.note;
          if (!Object.keys(patch).length)
            throw new Error("Nothing to change: give better, name, sickness, start or note.");
          for (const i of ill) {
            if (patch.end && i.end) throw new Error(`That illness is already over: ${JSON.stringify(illness(d, i))}`);
            const start = patch.start ?? i.start;
            if (patch.end && Date.parse(patch.end) < Date.parse(start))
              throw new Error(`${k.when(patch.end)} is before the illness started (${local(start)}).`);
          }
          const who = nameOf(d, ill[0]!.person);
          const shown = (i: Illness) => ({
            end: i.end ? at(i.end) : null,
            name: i.name.trim(),
            sickness: i.sickness.trim(),
            start: at(i.start),
            note: i.note.trim(),
          });
          const labels = { end: "Better", name: "Name", sickness: "Sickness", start: "Started", note: "Note" };
          let [i] = ill as [Illness];
          if (ill.length > 1) {
            const id = await ask({
              title: patch.end
                ? `Mark ${who} better from which illness ${on(patch.end)}?`
                : `Change which of ${who}'s illnesses?`,
              show: [
                k.show.facts(
                  Object.keys(patch).map((key) => [labels[key as "end"], shown({ ...i, ...patch })[key as "end"]]),
                ),
              ],
              choices: ill.map((x) => illnessChoice(d, x)),
              yes: patch.end ? "Mark better" : "Change",
            });
            i = ill.find((x) => x.id === id)!;
          } else {
            const [before, after] = [shown(i), shown({ ...i, ...patch })];
            if (Object.keys(labels).every((key) => before[key as "end"] === after[key as "end"]))
              throw new Error(`No change: ${JSON.stringify(illness(d, i))}`);
            const end = patch.end ?? i.end;
            const long = ((end ? Date.parse(end) : Date.now()) - Date.parse(patch.start ?? i.start)) / 1000;
            await ask({
              title: patch.end
                ? `Mark ${who} better from ${lower(i.name.trim())} ${on(patch.end)}`
                : `Change ${who}'s ${lower(i.name.trim())} from ${k.monthDay(i.start)}`,
              show: [
                k.show.changes(before, after, labels),
                k.show.facts({ Days: long >= 0 ? k.span(long) : null, Entries: entries(d, i) }),
              ],
              yes: patch.end ? "Mark better" : "Change",
            });
          }
          const old = Object.fromEntries(Object.keys(patch).map((key) => [key, i[key as keyof Illness]]));
          const r = await k.pocketbase(http).update<Illness>("episode", i.id, patch);
          undo({ id: i.id, old });
          return illness(d, r);
        },
        undo: (u: { id: string; old: Partial<Illness> }, { http }) => k.pocketbase(http).update("episode", u.id, u.old),
      }),
      fix_event: k.write({
        title: "Fix an event",
        description:
          "Changes a recorded event, by its id: its what, time, where, details (replacing them all, so a detail left out is removed), or note. A what differing from the log's spelling only in case, spaces or punctuation keeps the log's spelling.",
        input: {
          id: z.string().describe("The event's id from illness or events"),
          what: z.string().optional(),
          when: time.optional(),
          where: z.string().optional(),
          details: z.record(z.string(), z.string()).optional(),
          note: z.string().optional(),
        },
        async run(a, { http, ask, undo }) {
          const [d, rows] = await Promise.all([load(http), kinds(http)]);
          const e = d.events.find((x) => x.id === a.id);
          if (!e) throw new Error(`No event ${a.id}.`);
          const patch: Partial<Event> = {};
          const what = a.what === undefined ? e.what : (spelling(rows, a.what) ?? a.what.trim());
          if (what !== e.what) patch.what = what;
          if (a.when !== undefined) patch.when = zoned(a.when);
          if (a.where !== undefined) patch.where = place(d, a.where);
          if (a.details !== undefined) patch.data = details(a.details);
          if (a.note !== undefined) patch.note = a.note;
          if (!Object.keys(patch).length)
            throw new Error("Nothing to change: give what, when, where, details or note.");
          const next = { ...e, ...patch };
          const detail = (x: Event, t: string) => {
            const found = (x.data ?? []).find((y) => y.thing === t);
            return found ? withUnit(found) : null;
          };
          const things = [...new Set([...(e.data ?? []), ...(next.data ?? [])].map((x) => x.thing))];
          const text = (v: string | null) => v?.trim() || "none";
          const rowsChanged = (
            [
              ["What", e.what, next.what],
              ["When", at(e.when), at(next.when)],
              ["Where", e.where, next.where],
              ...things.map((t): [string, string | null, string | null] => [
                t || "Detail",
                detail(e, t),
                detail(next, t),
              ]),
              ["Note", e.note, next.note],
            ] as [string, string | null, string | null][]
          ).filter(([, before, after]) => text(before) !== text(after));
          if (!rowsChanged.length) throw new Error(`No change: ${JSON.stringify(event(d, e))}`);
          const sick = d.illnesses.find((x) => x.id === e.episode);
          const [only] = rowsChanged.length === 1 && rowsChanged[0]![0] !== "Note" ? rowsChanged : [];
          await ask({
            title: `Fix ${sick ? `${nameOf(d, sick.person)}'s` : "the"} ${thing(e.what)} ${on(e.when)}${only ? `: ${text(only[1])} to ${text(only[2])}` : ""}`,
            show: [k.show.changes(rowsChanged)],
            yes: "Fix",
          });
          const old = Object.fromEntries(Object.keys(patch).map((key) => [key, e[key as keyof Event]]));
          const r = await k.pocketbase(http).update<Event>("event", e.id, patch);
          undo({ id: e.id, old });
          return event(d, r, true);
        },
        undo: (u: { id: string; old: Partial<Event> }, { http }) => k.pocketbase(http).update("event", u.id, u.old),
      }),
    },
  });
};
