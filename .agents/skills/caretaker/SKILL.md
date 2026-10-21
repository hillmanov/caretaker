---
name: caretaker
description: The family's sickness log (Caretaker). Use to answer who is sick now, when a kid or parent was last sick and with what, how often someone has been sick, and what happened during an illness (temperatures, Tylenol or ibuprofen doses, throwing up, what they ate or drank, naps), and to record a new illness, log a temperature, medicine or symptom, or mark someone better.
metadata:
  title: Caretaker
  url: http://127.0.0.1:3013
  block: "DELETE /api/collections/person/*, DELETE /api/collections/30t3lxeeab08106/*, * /api/realtime*"
---

# Caretaker

An **episode** is one person's illness, with a `start` and an `end` (`end` is `""` while they're still sick). An **event** is one thing that happened during an episode: a temperature, a dose of medicine, throwing up, a drink.

Plain PocketBase at `http://127.0.0.1:3013`, no auth. Every read is `GET /api/collections/<c>/records` with `filter`, `sort`, `expand`, `fields`, `perPage` (up to 1000), `page`; the reply is `{page, perPage, totalItems, totalPages, items}`. Use `curl -G --data-urlencode` for filters.

## People

`person` records (`id, name`): Scott `hnbbgy8dijmfe7e`, Esther `5h0cqlq42in9t3n`, Darcy `1do0awapnpqx1qo`, Adrie `g067wfpxj78w3id`, Liam `8tzlz4lx2jqiu71`, Millie `ntius5kml8554zj`. `GET /api/collections/person/records` for the current list.

## Reading

- `episode`: `person` (id), `name` (a title like "Poor timing stomach thing"), `sickness` (free text: "Cold", "Diarrhea and barf"), `start`, `end`, `note`.
- `event`: `episode` (id), `what` ("Took temperature", "Took medicine: Tylenol ", "Threw up", "Drank: Water"), `when`, `where` ("Couch", "Bed", "Bathroom"), `data` (`[{thing, detail}]`, e.g. `{"thing":"Temperature","detail":"101.8"}`), `note`, `recordedBy` (a person id).
- `whats_things_details`: every `what`, `thing` and `detail` spelling in use (rows `{what, thing, detail}`).

```sh
# Who's sick now
curl -s -G http://127.0.0.1:3013/api/collections/episode/records --data-urlencode 'filter=end = ""' --data-urlencode 'expand=person'
# Liam's illnesses, newest first
curl -s -G http://127.0.0.1:3013/api/collections/episode/records --data-urlencode 'filter=person.name = "Liam"' --data-urlencode 'sort=-start' --data-urlencode 'perPage=200'
# Millie's temperatures
curl -s -G http://127.0.0.1:3013/api/collections/event/records --data-urlencode 'filter=data ~ "Temperature" && episode.person.name = "Millie"' --data-urlencode 'sort=-when'
# One illness with all its events
curl -s -G http://127.0.0.1:3013/api/collections/episode/records/<id> --data-urlencode 'expand=person,event_via_episode'
```

`data ~ "..."` matches text anywhere in the JSON; `data.thing = ...` doesn't work. There are no totals on the server: about 40 episodes and 123 events, so fetch all with `perPage=500` and count with jq, or read `totalItems`.

Times are stored in UTC (`2026-02-15 14:40:36.000Z`). America/Denver is UTC-6 until 2026-11-01, then UTC-7: "today" in a filter is `when >= "2026-10-21 06:00:00"`. Temperatures are Fahrenheit, as strings.

Everything is free text and spellings drift ("Diarrhea", "Diarrhea ", "Diahreah"; `"Took medicine: Tylenol "` has a trailing space). Match loosely with `~` and reuse an existing spelling from `whats_things_details` when writing.

## Recording

Each change asks the user first. Every field below is what the app's own forms require.

- **New illness:** `POST /api/collections/episode/records` with `{"person":"8tzlz4lx2jqiu71","name":"Fever","sickness":"Fever","start":"2026-10-21T07:30:00-06:00","end":"","note":""}`.
- **Something happened:** `POST /api/collections/event/records` with `{"episode":"<id>","what":"Took temperature","when":"2026-10-21T14:30:00-06:00","where":"Couch","data":[{"thing":"Device","detail":"Head thermometer"},{"thing":"Temperature","detail":"101.4"}],"note":"","recordedBy":"hnbbgy8dijmfe7e"}`. One event per thing: Tylenol and a temperature are two POSTs. Medicine is `"what":"Took medicine: Tylenol "` (or `Ibuprofen`) with `[{"thing":"Amount","detail":"2 pills"}]`.
- **Better:** `PATCH /api/collections/episode/records/<id>` with `{"end":"2026-10-21T18:00:00-06:00"}`.
- **Fix an event:** `PATCH /api/collections/event/records/<id>` with the changed fields.

Send times with the Denver offset as above (the app does the same). Deletes don't cascade: deleting an episode leaves its events behind. Deleting a person is refused.

Millie has had an episode open since 2026-02-15 ("Poor timing stomach thing"), and 4 old episodes have `end` before `start`.
