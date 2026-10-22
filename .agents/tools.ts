// Caretaker's tools for the homelab MCP server (~/homelab/mcp): the family's illnesses and what happened in each.
import type { Http, Kit } from "../../mcp/kit";

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

export default (k: Kit) => {
  const z = k.z;
  const C = "/api/collections";

  const all = async <T>(http: Http, c: string, sort: string): Promise<T[]> =>
    (await http.get(`${C}/${c}/records`, { perPage: 1000, sort })).items;
  const load = async (http: Http) => {
    const [people, illnesses, events] = await Promise.all([
      all<Person>(http, "person", "name"),
      all<Illness>(http, "episode", "-start"),
      all<Event>(http, "event", "when"),
    ]);
    return { people, illnesses, events };
  };
  type Data = Awaited<ReturnType<typeof load>>;

  // PocketBase keeps UTC as "2026-02-15 14:40:36.000Z".
  const instant = (s: string) => new Date(s.replace(" ", "T"));
  const local = (s: string) => {
    if (!s) return null;
    const d = instant(s);
    return `${k.date(d)} ${k.time(d, { time: "only" })}`;
  };
  /** "2026-10-21T14:30" (or with a space) in the user's zone → an ISO time with its offset, as the app sends. */
  const toISO = (s?: string) => {
    const d = s ? new Date(`${s.trim().replace(" ", "T")}Z`) : new Date();
    if (Number.isNaN(d.getTime())) throw new Error(`Not a time: ${s} (give YYYY-MM-DDTHH:MM)`);
    // For a given wall time, the zone's offset is how far its wall clock is from UTC at about that instant.
    const wall = (t: Date) => {
      const p = Object.fromEntries(
        new Intl.DateTimeFormat("en-US", { timeZone: k.zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
          .formatToParts(t)
          .map((x) => [x.type, x.value]),
      );
      return Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!);
    };
    const utc = s ? new Date(d.getTime() - (wall(d) - d.getTime())) : d;
    const offset = Math.round((wall(utc) - utc.getTime()) / 60000);
    const shifted = new Date(utc.getTime() + offset * 60000).toISOString().slice(0, 19);
    const sign = offset < 0 ? "-" : "+";
    const abs = Math.abs(offset);
    return `${shifted}${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  };
  const time = z.string().describe("YYYY-MM-DDTHH:MM in the user's time zone (default now)");
  const has = (text: string, part: string) => text.toLowerCase().includes(part.trim().toLowerCase());
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  /** Illnesses whose sickness or name has the words, else any word of three letters or more ("stomach bug" finds "stomach thing"). */
  const about = (illnesses: Illness[], text: string) => {
    const phrase = illnesses.filter((i) => has(i.sickness, text) || has(i.name, text));
    if (phrase.length) return phrase;
    const words = text.split(/\W+/).filter((w) => w.length >= 3);
    return illnesses.filter((i) => words.some((w) => has(i.sickness, w) || has(i.name, w)));
  };
  const squash = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  /** A what as the log spells it, when one differs only in case or spaces. */
  const spelled = async (http: Http, what: string) => {
    const known: { what: string }[] = await all(http, "whats_things_details", "what");
    return known.find((x) => squash(x.what) === squash(what))?.what ?? what.trim();
  };

  const nameOf = (d: Data, id: string) => d.people.find((p) => p.id === id)?.name ?? id;
  const person = (d: Data, name: string) => {
    const p = d.people.find((x) => same(x.name, name));
    if (!p) throw new Error(`No one named ${name}. The people: ${d.people.map((x) => x.name).join(", ")}`);
    return p;
  };
  const illness = (d: Data, i: Illness) => {
    const days = ((i.end ? instant(i.end) : new Date()).getTime() - instant(i.start).getTime()) / 86_400_000;
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
      events: d.events.filter((e) => e.episode === i.id).length,
    };
  };
  const event = (d: Data, e: Event, withPerson = false) => {
    const i = d.illnesses.find((x) => x.id === e.episode);
    return {
      id: e.id,
      when: local(e.when),
      ...(withPerson && i ? { person: nameOf(d, i.person), illness: i.name.trim() } : {}),
      what: e.what.trim(),
      ...(e.where ? { where: e.where } : {}),
      ...((e.data ?? []).some((x) => x.thing || x.detail)
        ? { details: Object.fromEntries((e.data ?? []).filter((x) => x.thing || x.detail).map((x) => [x.thing || "detail", x.detail])) }
        : {}),
      ...(e.note.trim() ? { note: e.note.trim() } : {}),
      ...(e.recordedBy ? { recordedBy: nameOf(d, e.recordedBy) } : {}),
    };
  };
  /** An illness by its id, else the person's open one (or their latest, with latest). */
  const pick = (d: Data, a: { id?: string; person?: string }, open: boolean) => {
    if (a.id) {
      const i = d.illnesses.find((x) => x.id === a.id);
      if (!i) throw new Error(`No illness ${a.id}.`);
      return i;
    }
    if (!a.person) throw new Error("Give the person or the illness's id.");
    const p = person(d, a.person);
    const theirs = d.illnesses.filter((x) => x.person === p.id);
    const openOnes = theirs.filter((x) => !x.end);
    if (openOnes.length > 1) throw new Error(`${p.name} has several open illnesses; give the id: ${JSON.stringify(openOnes.map((x) => illness(d, x)))}`);
    const i = openOnes[0] ?? (open ? undefined : theirs[0]);
    if (!i) throw new Error(`${p.name} isn't sick now.${theirs[0] ? ` Their last illness: ${JSON.stringify(illness(d, theirs[0]))}` : ""}`);
    return i;
  };

  return k.app({
    name: "caretaker",
    title: "Caretaker",
    description:
      "The family's sickness log (Caretaker). Who is sick now, when a kid or parent was last sick and with what, how often someone has been sick, and what happened during an illness (temperatures, Tylenol or ibuprofen doses, throwing up, what they ate or drank, naps); recording a new illness, a temperature, medicine or symptom, and marking someone better.",
    url: "http://127.0.0.1:3013",
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
          since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Only illnesses that started on or after this day"),
        },
        async run(a, http) {
          const d = await load(http);
          const who = a.person ? person(d, a.person) : null;
          const theirs = d.illnesses.filter((i) => !who || i.person === who.id);
          const rows = (a.sickness ? about(theirs, a.sickness) : theirs)
            .filter((i) => !a.sickNow || !i.end)
            .filter((i) => !a.since || local(i.start)!.slice(0, 10) >= a.since)
            .map((i) => illness(d, i));
          return { count: rows.length, illnesses: rows };
        },
      }),
      illness: k.tool({
        title: "Illness",
        description:
          "One illness and everything that happened in it, in order: by its id, the person's latest illness with a sickness or name like the one given, or the person's open illness (else their latest).",
        input: {
          person: z.string().optional(),
          id: z.string().optional().describe("The illness's id from illnesses"),
          sickness: z.string().optional().describe("What it was called, like stomach bug or fever (any case)"),
        },
        async run(a, http) {
          const d = await load(http);
          let i: Illness;
          if (a.sickness && !a.id) {
            if (!a.person) throw new Error("Give the person with the sickness.");
            const p = person(d, a.person);
            const theirs = d.illnesses.filter((x) => x.person === p.id);
            const found = about(theirs, a.sickness)[0];
            if (!found) throw new Error(`${p.name} has no illness like "${a.sickness}". Theirs: ${JSON.stringify(theirs.map((x) => illness(d, x)))}`);
            i = found;
          } else i = pick(d, a, false);
          return { ...illness(d, i), happened: d.events.filter((e) => e.episode === i.id).map((e) => event(d, e)) };
        },
      }),
      events: k.tool({
        title: "Events",
        description:
          "Things that happened across illnesses (temperatures, medicine, throwing up, food and drink, naps), newest first: each with its id, time, person, illness, what, where, details (like Temperature, Amount), note, and who recorded it.",
        input: {
          person: z.string().optional(),
          what: z.string().optional().describe("Only events whose what or details contain this (any case): temperature, Tylenol, ibuprofen, threw up, drank…"),
          since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Only events on or after this day"),
          limit: z.number().int().min(1).max(500).default(50),
        },
        async run(a, http) {
          const d = await load(http);
          const who = a.person ? person(d, a.person) : null;
          const theirs = new Set(d.illnesses.filter((i) => !who || i.person === who.id).map((i) => i.id));
          return d.events
            .filter((e) => theirs.has(e.episode))
            .filter((e) => !a.what || has(e.what, a.what) || (e.data ?? []).some((x) => has(`${x.thing} ${x.detail}`, a.what!)))
            .filter((e) => !a.since || local(e.when)!.slice(0, 10) >= a.since)
            .reverse()
            .slice(0, a.limit)
            .map((e) => event(d, e, true));
        },
      }),
      kinds: k.tool({
        title: "Kinds of events",
        description: "Every kind of event in use, as spelled in the log (\"Took medicine: Tylenol \" has its trailing space), with each thing it records and the details used for it.",
        async run(_, http) {
          const rows: { what: string; thing: string; detail: string }[] = await all(http, "whats_things_details", "what");
          const kinds = new Map<string, Map<string, Set<string>>>();
          for (const r of rows) {
            const things = kinds.get(r.what) ?? kinds.set(r.what, new Map()).get(r.what)!;
            if (r.thing) (things.get(r.thing) ?? things.set(r.thing, new Set()).get(r.thing)!).add(r.detail);
          }
          return [...kinds].map(([what, things]) => ({ what, things: Object.fromEntries([...things].map(([t, ds]) => [t, [...ds]])) }));
        },
      }),
    },
    writes: {
      start_illness: k.tool({
        title: "Record an illness",
        description: "Records that someone got sick. A person with an illness still open isn't given a second one.",
        input: {
          person: z.string(),
          sickness: z.string().min(1).describe("What it is: Cold, Fever, Throwing up…"),
          name: z.string().optional().describe("A title for it (default the sickness)"),
          start: time.optional(),
          note: z.string().optional(),
        },
        async run(a, http) {
          const d = await load(http);
          const p = person(d, a.person);
          const open = d.illnesses.find((i) => i.person === p.id && !i.end);
          if (open) throw new Error(`${p.name} is already sick: ${JSON.stringify(illness(d, open))}`);
          const r: Illness = await http.post(`${C}/episode/records`, {
            person: p.id,
            name: (a.name ?? a.sickness).trim(),
            sickness: a.sickness.trim(),
            start: toISO(a.start),
            end: "",
            note: a.note ?? "",
          });
          return illness({ ...d, illnesses: [r, ...d.illnesses] }, r);
        },
      }),
      record_event: k.tool({
        title: "Record what happened",
        description:
          "Records one thing that happened in someone's open illness (or an illness by its id). A temperature is what \"Took temperature\" with the detail Temperature (°F, like 101.4); medicine is what \"Took medicine: Tylenol \" or \"Took medicine: Ibuprofen\" with Amount (like 2 pills, 10 ml). A what already in use, differing only in case or spaces, keeps the log's spelling.",
        input: {
          person: z.string().optional(),
          id: z.string().optional().describe("The illness's id, when it isn't the person's open one"),
          what: z.string().min(1),
          details: z.record(z.string(), z.string()).optional().describe("Thing to detail, like {\"Temperature\": \"101.4\"} or {\"Amount\": \"2 pills\"}"),
          when: time.optional(),
          where: z.string().optional().describe("Couch, Bed, Bathroom, Kitchen…"),
          note: z.string().optional(),
          recordedBy: z.string().default("Scott"),
        },
        async run(a, http) {
          const d = await load(http);
          const i = pick(d, a, true);
          const by = person(d, a.recordedBy);
          const what = await spelled(http, a.what);
          const where = d.events.find((e) => e.where && same(e.where, a.where ?? ""))?.where ?? a.where?.trim() ?? "";
          const when = toISO(a.when);
          const dup = d.events.find((e) => e.episode === i.id && squash(e.what) === squash(what) && Math.abs(instant(e.when).getTime() - Date.parse(when)) < 60_000);
          if (dup) throw new Error(`Already recorded: ${JSON.stringify(event(d, dup))}`);
          const r: Event = await http.post(`${C}/event/records`, {
            episode: i.id,
            what,
            when,
            where,
            data: Object.entries(a.details ?? {}).map(([thing, detail]) => ({ thing, detail })),
            note: a.note ?? "",
            recordedBy: by.id,
          });
          return event({ ...d, events: [...d.events, r] }, r, true);
        },
      }),
      update_illness: k.tool({
        title: "Update an illness",
        description:
          "Marks someone's open illness over (better: the time they got better), or changes an illness's name, sickness, start or note. Found by the person's open illness, else their latest, or by its id.",
        input: {
          person: z.string().optional(),
          id: z.string().optional().describe("The illness's id from illnesses"),
          better: z.union([z.literal(true), time]).optional().describe("true for now, or the time they got better"),
          name: z.string().optional(),
          sickness: z.string().optional(),
          start: time.optional(),
          note: z.string().optional(),
        },
        async run(a, http) {
          const d = await load(http);
          const i = pick(d, a, a.better !== undefined);
          const patch: Partial<Illness> = {};
          if (a.better !== undefined) {
            if (i.end) throw new Error(`That illness is already over: ${JSON.stringify(illness(d, i))}`);
            patch.end = toISO(a.better === true ? undefined : a.better);
            if (Date.parse(patch.end) < instant(i.start).getTime()) throw new Error(`${patch.end} is before the illness started (${local(i.start)}).`);
          }
          if (a.name !== undefined) patch.name = a.name.trim();
          if (a.sickness !== undefined) patch.sickness = a.sickness.trim();
          if (a.start !== undefined) patch.start = toISO(a.start);
          if (a.note !== undefined) patch.note = a.note;
          if (!Object.keys(patch).length) throw new Error("Nothing to change: give better, name, sickness, start or note.");
          const r: Illness = await http.patch(`${C}/episode/records/${i.id}`, patch);
          return illness(d, r);
        },
      }),
      fix_event: k.tool({
        title: "Fix an event",
        description:
          "Changes a recorded event, by its id: its what, time, where, details (replacing them all), or note. A what differing from the log's spelling only in case or spaces keeps the log's spelling.",
        input: {
          id: z.string().describe("The event's id from illness or events"),
          what: z.string().optional(),
          when: time.optional(),
          where: z.string().optional(),
          details: z.record(z.string(), z.string()).optional(),
          note: z.string().optional(),
        },
        async run(a, http) {
          const d = await load(http);
          const e = d.events.find((x) => x.id === a.id);
          if (!e) throw new Error(`No event ${a.id}.`);
          const patch: Partial<Event> = {};
          if (a.what !== undefined) {
            const what = await spelled(http, a.what);
            if (what !== e.what) patch.what = what;
          }
          if (a.when !== undefined) patch.when = toISO(a.when);
          if (a.where !== undefined) patch.where = a.where;
          if (a.details !== undefined) patch.data = Object.entries(a.details).map(([thing, detail]) => ({ thing, detail }));
          if (a.note !== undefined) patch.note = a.note;
          if (!Object.keys(patch).length) throw new Error("Nothing to change: give what, when, where, details or note.");
          const r: Event = await http.patch(`${C}/event/records/${e.id}`, patch);
          return event(d, r, true);
        },
      }),
    },
  });
};
