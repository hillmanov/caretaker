import {
  useQuery,
  useMutation,
  queryOptions,
  UseMutationOptions,
  UseQueryResult
} from "@tanstack/react-query"
import { RecordOptions } from 'pocketbase';
import { flatMap, uniq, map, compact, reduce } from "lodash";
import pb from "./lib/pb"
import {
  PersonResponse,
  EpisodeResponse,
  EventResponse,
  EpisodeRecord,
  EventRecord,
  EventData,
  EventAutocompleteSuggestions,
  WhatsThingsDetailsResponse,
} from "@/types"

import { queryClient } from "./main";

export interface EpisodeFilter {
  personId?: string;
  status?: "active" | "past" | 'all';
}

export interface EventFilter {
  episodeId: string;
  what?: string;
}

export type CallBacks<TData = unknown, TError = Error, TRecord = unknown, TResponse = TData> = {
  onSuccess?: UseMutationOptions<TResponse, TError, TRecord>['onSuccess'],
  onError?: UseMutationOptions<TData, TError, TRecord>['onError'],
};

export type CreateEventPayload = { event: EventRecord};
export type UpdateEventPayload = { eventId: string, event: EventRecord};
export type EventCallBacks = CallBacks<EventResponse, Error, CreateEventPayload | UpdateEventPayload, EventResponse>;

export type CreateEpisodePayload = { episode: EpisodeRecord};
export type UpdateEpisodePayload = { episodeId: string, episode: EpisodeRecord};
export type EpisodeCallBacks = CallBacks<EpisodeResponse, Error, CreateEpisodePayload | UpdateEpisodePayload, EpisodeResponse>;

export const personsQueryOptions = () => {
  return queryOptions<PersonResponse[], Error>({
    queryKey: ["persons"], 
    queryFn: () => {
      return pb.collection('person').getFullList();
    }
  });
}
 
export const usePersons = () => {
  return useQuery(personsQueryOptions());
}

export const personQueryOptions = (id: string | null | undefined) => {
  return queryOptions<PersonResponse, Error>({
    queryKey: ["person", id], 
    queryFn: () => {
      return pb.collection('person').getOne(String(id));
    },
    enabled: !!id,
    placeholderData: (previousData) => previousData
  });
}

export const usePerson = (id: string | null | undefined) => {
  return useQuery(personQueryOptions(id));
}

export const episodesQueryOptions = (filter?: EpisodeFilter) => {
  const options: RecordOptions = {
    requestKey: JSON.stringify(filter),
  }

  const filterOptions = []

  if (filter?.personId) {
    filterOptions.push(pb.filter("person = {:personId}", {personId: filter.personId}));
  }

  if (filter?.status === "active") {
    filterOptions.push("start != NULL && end = NULL");
  }

  if (filter?.status === "past") {
    filterOptions.push("start != NULL && end != NULL");
  }

  options.filter = filterOptions.join(" && ");

  return queryOptions<EpisodeResponse[], Error>({
    queryKey: ["episodes", filter?.personId ?? "", filter?.status ?? ""],
    queryFn: () => {
      return pb.collection('episode').getFullList(options); 
    },
    placeholderData: (previousData) => previousData
  });
}

export const useEpisodes = (filter?: EpisodeFilter) => {
  return useQuery(episodesQueryOptions(filter));
}

export const episodeQueryOptions = (id: string | null | undefined) => {
  return queryOptions<EpisodeResponse, Error>({
    queryKey: ["episode", id], 
    queryFn: () => {
      return pb.collection('episode').getOne(String(id));
    },
    enabled: !!id
  });
}

export const useEpisode = (id: string | null | undefined) => {
  return useQuery(episodeQueryOptions(id));
}

export const episodeWhatsQueryOptions = (id: string | null | undefined) => {
  return queryOptions<string[], Error>({
    queryKey: ["episode", id, "whats"], 
    queryFn: async () => {
      const events = await pb.collection('event').getFullList({
        filter: `episode = "${id}"`,
        fields: 'what',
        sort: '-when',
        requestKey: id
      });
      return uniq(map(events, 'what'))
    },
  });
}

export const useEpisodeWhats = (id: string | null | undefined,) => {
  return useQuery(episodeWhatsQueryOptions(id));
}

export const eventsQueryOptions = (filter: EventFilter) => {
  const filterParts = [`episode = "${filter.episodeId}"`];
  if (filter.what) {
    filterParts.push(`what = "${filter.what}"`);
  }
  const filterString = filterParts.join(' && ');

  return queryOptions<EventResponse<EventData>[], Error>({
    queryKey: ["events", filter.episodeId, filter.what], 
    queryFn: () => {
      return pb.collection('event').getFullList({ filter: filterString, sort: '-when', requestKey: filterString });
    },
    enabled: !!filter.episodeId
  });
}

export const useEvents = (filter: EventFilter) => {
  return useQuery(eventsQueryOptions(filter));
}

export const eventQueryOptions = (id: string | null | undefined) => {
  return queryOptions<EventResponse<EventData>, Error>({
    queryKey: ["event", id], 
    queryFn: () => {
      return pb.collection('event').getOne(String(id));
    },
    enabled: !!id
  });
}

export const useEvent = (id: string | null | undefined) => {
  return useQuery(eventQueryOptions(id));
}

export const eventAutocompleteSuggestionsQueryOptions = () => {
  return queryOptions<EventAutocompleteSuggestions, Error>({
    queryKey: ["eventAutocompleteSuggestions"], 
    queryFn: async () => {
      const whatsThingsDetails = await pb.collection('whats_things_details').getFullList<WhatsThingsDetailsResponse>();
      const wheres = await pb.collection('event').getFullList<{where: string}>({ fields: 'where' });

      const thingsByWhat: {[key: string]: string[]} = {};
      const detailsByThing: {[key: string]: {[key: string]: string[]} } = {};

      reduce(whatsThingsDetails, (thingsByWhat, wtd) => {
        const { what, thing } = wtd;
        thingsByWhat[what] = thingsByWhat[what] || [];
        thingsByWhat[what].push(thing);
        thingsByWhat[what] = compact(uniq(thingsByWhat[what]));
        return thingsByWhat;
      }, thingsByWhat);

      reduce(whatsThingsDetails, (detailsByThing, wtd) => {
        const { what, thing, detail } = wtd;
        detailsByThing[what] = detailsByThing[what] || {};
        detailsByThing[what][thing] = detailsByThing[what][thing] || []
        detailsByThing[what][thing].push(detail);
        detailsByThing[what][thing] = compact(uniq(detailsByThing[what][thing]));
        return detailsByThing;
      }, detailsByThing);

      return  {
        what: compact(uniq(flatMap(whatsThingsDetails, 'what'))),
        thingsByWhat,
        detailsByThing,
        where: compact(uniq(flatMap(wheres, 'where'))),
      }
    }
  });
}

export const useEventAutocompleteSuggestions = () => {
  return useQuery(eventAutocompleteSuggestionsQueryOptions());
}

export const useCreateEpisodeMutation = ({ onSuccess, onError }: EpisodeCallBacks = { onSuccess: () => {}, onError: () => {} }) => {
  return useMutation({
    mutationFn: async ({ episode }: CreateEpisodePayload) => {
      return await pb.collection('episode').create<EpisodeResponse>(episode);
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        queryKey: ["episodes"],
        exact: false,
      }); 
      onSuccess?.(...args);
    },
    onError: (...args) => {
      onError?.(...args);
    }
  })
}

export const useUpdateEpisodeMutation = ({ onSuccess, onError }: EpisodeCallBacks = { onSuccess: () => {}, onError: () => {} }) => {  
  return useMutation({
    mutationFn: async ({ episodeId,  episode }: UpdateEpisodePayload) => {
      return await pb.collection('episode').update(episodeId, episode);
    },
    onSuccess: (...args) => {
      const episode = args[0];
      queryClient.invalidateQueries({
        queryKey: ["episode", episode.id],
        exact: false,
      }); 
      onSuccess?.(...args);
    },
    onError: (...args) => {
      onError?.(...args);
    }
  })
}

export const useCreateEventMutation = ({ onSuccess, onError }: EventCallBacks = { onSuccess: () => {}, onError: () => {} }) => {
  return useMutation({
    mutationFn: async ({ event } : CreateEventPayload) => {
      return await pb.collection('event').create<EventResponse<EventData>>(event);
    },
    onSuccess: (...args) => {
      const event = args[0];
      queryClient.invalidateQueries({
        queryKey: ["events", event.episode],
        exact: false,
      }); 
      queryClient.invalidateQueries({
        queryKey: ["episode", event.episode],
        exact: false,
      }); 
      onSuccess?.(...args);
    },
    onError: (...args) => {
      onError?.(...args);
    }
  })
}

export const useUpdateEventMutation = ({ onSuccess, onError }: EventCallBacks = { onSuccess: () => {}, onError: () => {} }) => {
  return useMutation({
    mutationFn: async ({ eventId, event, } : UpdateEventPayload) => {
      return await pb.collection('event').update<EventResponse<EventData>>(eventId, event);
    },
    onSuccess: (...args) => {
      const event = args[0];
      queryClient.invalidateQueries({
        queryKey: ["event", event.id]
      }); 
      queryClient.invalidateQueries({
        queryKey: ["episode", event.episode],
        exact: false,
      }); 
      onSuccess?.(...args);
    },
    onError: (...args) => {
      onError?.(...args);
    }
  })
}

export const anyLoading = (...queries: UseQueryResult[]): boolean => {
  queries.forEach((query) => {
    if (query.isLoading) {
      return true;
    }
  })
  return false;
}

export const allSuccess = (...queries: UseQueryResult[]): boolean => {
  queries.forEach((query) => {
    if (query.isError || query.isLoading) {
      return false;
    }
  })
  return true;
}

export const anyError = (...queries: UseQueryResult[]): boolean => {
  queries.forEach((query) => {
    if (query.isError) {
      return true;
    }
  })
  return false;
}

