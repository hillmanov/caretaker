import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Edit2, PlusCircle, ArrowLeftCircle, CheckCircle } from "lucide-react"
import { toast } from "sonner";
import {
  map,
} from 'lodash';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Label
} from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectSeparator,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useEpisode,
  useEpisodeWhats,
  useEvents,
  useEvent,
  usePerson,
  anyLoading,
  anyError,
  allSuccess,
  useUpdateEpisodeMutation,
} from '@/queries';
import { prettyDate, prettyTime, prettyShortDate, formatDuration, utcToLocal } from '@/lib/timeUtils';
import { Button } from '@/components/ui/button';
import EventForm from '@/components/EventForm';
import EpisodeForm from '@/components/EpisodeForm';
import { EventResponse, EventData } from '@/types';
import dayjs from 'dayjs';

export type PersonEpisodeProps = {
  personId: string
  episodeId: string
}

export type EventListProps = {
  events: EventResponse<EventData>[] | null
  edit: (event: EventResponse<EventData>) => void
}

export type EventProps = {
  eventId: string;
  edit: (event: EventResponse<EventData>) => void
}

const Event = ({ eventId, edit }: EventProps) => {
  const eventQuery = useEvent(eventId);

  if (eventQuery.isLoading) {
    return null;
  }
  if (eventQuery.isError) {
    return <div>Error</div>;
  }
  if (eventQuery.isSuccess) {
    const event = eventQuery.data;
    return (
      <div className="max-w-[500px] rounded-xl bg-white p-4 shadow-md">
        <div className="-mt-2 flex flex-row content-center items-center justify-between">
          <div className="bg-red- text-xl text-sky-800">{event.what}</div>
          <Button variant="icon" size="icon"  onClick={() => edit(event)}><Edit2 className="h-5 w-5" /></Button>
        </div>
        <div className="text-gray-500">
          @ {prettyTime(event.when)} | {prettyShortDate(utcToLocal(event.when))} | {event.where}
        </div>
        <div className="-mx-4 -mb-4 mt-4 flex flex-col gap-4 rounded-b-xl bg-sky-50 px-4 py-4 ">

          {(event.data?.length?? 0) > 0 && (
            <div className="flex flex-col gap-2 text-xs text-gray-500">
              {map(event?.data, (data, key) => {
                return (
                  <div key={key} className="flex flex-row gap-1 text-xs text-gray-600">
                    <div className="font-bold uppercase tracking-wider text-sky-600">{data.thing}</div> {data.detail}
                  </div>
                );
              })}
            </div>
          )}

          {(event.data?.length?? 0) > 0 && event.note && (
            <div className="h-1 w-full border-b-[1px] border-sky-100"></div>
          )}

          {event.note && (
            <>
              <div className="hitespace-pre-line text-xs text-gray-600">
                {event.note} 
              </div>
            </>
          )}
        </div>
      </div>
    )
  }
  return null;
}

const EventList = ({ events, edit }: EventListProps) => {
  if (!events) {
    return null;
  }
  return (
    <div className="mt-1 text-xs font-semibold">
      {map(events, (event, index) => {
        let timeDifference = '';
        if (index > 0) {
          const previousEvent = events[index - 1];
          timeDifference = formatDuration(previousEvent.when, event.when);
        }

        return (
          <div key={event.id}>
            <div className="flex flex-col gap-1">
              {timeDifference && (
                <div className="flex w-36 flex-col flex-wrap items-center gap-2">
                  <div className="mt-2 h-4 w-1 border-l-2 border-sky-400"></div>
                  <div className="text-sky-600">
                    {timeDifference}
                  </div>
                  <div className="mb-2 h-4 w-1 border-l-2 border-sky-400"></div>
                </div>
              )}
              <Event eventId={event.id} edit={edit} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const Episode = ({ episodeId, personId }: PersonEpisodeProps) => {
  const navigate = useNavigate();
  const [eventToEdit, setEventToEdit] = useState<EventResponse<EventData> | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showEpisodeForm, setShowEpisodeForm] = useState(false);
  const [eventFilter, setEventFilter] = useState<string>('');

  const episodeQuery = useEpisode(episodeId);
  const eventsQuery = useEvents({ episodeId, what: eventFilter });
  const episodeWhatsQuery = useEpisodeWhats(episodeId);
  const personQuery = usePerson(personId);
  const updateEpisodeMutation = useUpdateEpisodeMutation({ 
    onSuccess: () => {
      toast.success('Yay', {
        className: '!text-green-700',
        description: `So good to see that ${personQuery.data?.name} is feeling better!`,
        position: 'bottom-center',
      });
    },
    onError: () => {
      toast.error('Crud', {
        className: '!text-red-700',
        description: `Couldn't mark them as recovered for some reason`,
        position: 'bottom-center',
      });
    },
  });

  const setEpisodeRecovered = () => {
    updateEpisodeMutation.mutate({
      episodeId,
      episode: {
        ...episodeQuery.data,
        end: dayjs().format()
      }
    });
  }

  const editEvent = (event: EventResponse<EventData>) => {
    setEventToEdit(event);
    setShowEventForm(true);
  }

  const closeEventForm = () => {
    setEventToEdit(null);
    setShowEventForm(false);
  }

  if (anyLoading(episodeQuery, episodeWhatsQuery, eventsQuery, personQuery)) {
    return <div>Loading...</div>;
  }

  if (anyError(episodeQuery, episodeWhatsQuery, eventsQuery, personQuery)) {
    return <div>Error</div>;
  }

  if (allSuccess(episodeQuery, episodeWhatsQuery, eventsQuery, personQuery)) {
    return (
      <>
        <div className="mb-2 flex flex-row items-center gap-2 text-2xl font-semibold uppercase tracking-widest text-teal-700">
          <Button 
            variant="icon"
            size="icon" 
            onClick={() => window.history.back()} className="m-0 h-8 w-8" >
            <ArrowLeftCircle className="h-6 w-6" />
          </Button>
          {personQuery.data?.name} was sick :(
        </div>

        <div className="navy-200 -ml-4 -mr-4 mt-2 bg-sky-200 py-4 pb-12 pl-4 shadow-inner">
          <div className="flex flex-row gap-2">
            <div className="flex flex-col">
              <div className="flex flex-row items-center gap-2 text-2xl font-semibold text-sky-700">
                {episodeQuery.data?.name}
                <Button 
                  variant="icon"
                  size="icon"
                  onClick={() => setShowEpisodeForm(true)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-lg text-gray-700">
                <div>
                  {episodeQuery.data?.sickness ? `${episodeQuery.data?.sickness}` : ''}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {prettyDate(episodeQuery.data?.start)} - {episodeQuery.data?.end ? prettyDate(episodeQuery.data?.end) : ''}
                </div>
              </div>
            </div>
          </div>

          {episodeQuery.data?.note && (
            <div className="mt-4 max-w-[500px]">
              <div className="whitespace-pre-line text-sm text-gray-600 ">
                {episodeQuery.data?.note}
              </div>
            </div>
          )}

        </div>

        <div className="relative top-[-35px] flex h-fit w-fit flex-row items-center gap-4 rounded-2xl bg-white p-4 shadow-lg">
          <Button 
            className="h-10 w-fit gap-3 font-semibold" 
            variant="secondary" 
            onClick={() => setShowEventForm(!showEventForm)}>
            <PlusCircle className="text-sky-600" />Event
          </Button>

          <Button 
            className="h-10 w-fit gap-3 font-semibold" 
            variant="green" 
            disabled={(!!episodeQuery.data?.end)}
            onClick={() => setEpisodeRecovered()}>
            <CheckCircle className="text-green-700" />Recovered
          </Button>
        </div>

        {eventsQuery.data && (
          <div className="-mt-4 text-sm font-semibold">
            {((episodeWhatsQuery.data?.length?? 0) > 0) && (
              <>
                <Label className="mb-1">Events:</Label>
                <div className="mb-4">
                  <Select onValueChange={(value) => setEventFilter(value)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <Button
                        className="w-full px-2"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEventFilter('')
                        }}
                      >
                        Clear
                      </Button>
                      <SelectSeparator />
                      {episodeWhatsQuery.data?.map((what) => (
                        <SelectItem key={what} value={what}>{what}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <EventList events={eventsQuery.data} edit={(event: EventResponse<EventData>) => editEvent(event)} />
          </div>
        )}

        <Dialog open={showEventForm} onOpenChange={() => closeEventForm()} >
          <DialogContent>
            <DialogHeader >
              <DialogTitle><div className="text-2xl">Something happened!</div></DialogTitle>
              <DialogDescription className="text-xs italic text-gray-400">
                Was it gross?
              </DialogDescription>
              <div className="!mt-4">
                <EventForm 
                  onSuccess={() => { 
                    setShowEventForm(false);
                    navigate({ to: '/', search: { personId, episodeId }})
                    toast.success('Event saved!', {
                      className: '!text-green-700',
                      description: `Thanks for taking care of ${personQuery.data?.name}!`,
                      position: 'bottom-center',
                    });
                  }}
                  onError={() => {
                    toast.error('Error saving event.', {
                      className: '!text-red-700',
                      description: `Sorry - that didn't go through.`,
                      position: 'bottom-center',
                    });
                  }}
                  episodeId={episodeId}
                  event={eventToEdit}
                />
              </div>
            </DialogHeader>
          </DialogContent>
        </Dialog>

        <Dialog open={showEpisodeForm} onOpenChange={() => setShowEpisodeForm(false)} >
          <DialogContent>
            <DialogHeader >
              <DialogTitle><div className="text-2xl">Let's fix this up a bit...</div></DialogTitle>
              <DialogDescription className="text-xs italic text-gray-300">
                What's the deal?
              </DialogDescription>
              <div className="!mt-4">
                <EpisodeForm 
                  onSuccess={() => { 
                    setShowEpisodeForm(false);
                    toast.success('Episode saved!', {
                      className: '!text-green-700',
                      description: `Thanks for taking care of ${personQuery.data?.name}!`,
                      position: 'bottom-center',
                    });
                  }}
                  onError={() => {
                    toast.error('Error saving episode.', {
                      className: '!text-red-700',
                      description: `Sorry - that didn't go through.`,
                      position: 'bottom-center',
                    });
                  }}
                  episode={episodeQuery.data}
                />
              </div>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </>
    );
  }
  return null;
};

