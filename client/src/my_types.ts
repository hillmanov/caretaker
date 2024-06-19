export type ThingDetail = {
  thing: string;
  detail: string;
}

export type EventAutocompleteSuggestions = {
  what: string[];
  thingsByWhat: {[key: string]: string[]};
  detailsByThing: {[key: string]: {[key: string]: string[]}};
  where: string[];
}

export type EventData = ThingDetail[];

