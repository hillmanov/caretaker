import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query'
import { Link, useSearch, useNavigate } from '@tanstack/react-router';
import { prettyDate } from '@/lib/timeUtils';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import EpisodeForm from '@/components/EpisodeForm'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EpisodeResponse } from '@/types'
import {
  useEpisodes,
  usePerson,
  EpisodeFilter,
  episodeQueryOptions,
  episodeWhatsQueryOptions,
  useEvents,
  eventsQueryOptions,
} from '@/queries'
import { personAvatarClassNames } from '@/lib/helpers'
import { cn } from '@/lib/utils'

export type EpisodesProps = {
  personId?: string
}

const PersonName = ({ personId }: { personId: string }) => {
  const personQuery = usePerson(personId);
  return personQuery.isSuccess && personQuery.data?.name
}


const Episode = ({ episode }: { episode: EpisodeResponse }) => {
  const personQuery = usePerson(episode.person);
  const firstInitial = personQuery.isSuccess ? personQuery.data.name[0] : '';
  const queryClient = useQueryClient();
  const eventsQuery = useEvents({ episodeId: episode.id, what: '' });

  return (
    <Link key={episode.id}
      to="/"
      search={{
        episodeId: episode.id,
        personId: episode.person,
      }}
      className="group max-w-[500px] rounded-xl bg-white shadow hover:bg-sky-50"
    >
      <div 
        className="group flex flex-row gap-6 rounded px-4 py-4 shadow"
        onMouseEnter={() => {
          queryClient.prefetchQuery(eventsQueryOptions({ episodeId: episode.id, what: '' }));
          queryClient.prefetchQuery(episodeWhatsQueryOptions(episode.id));
          queryClient.prefetchQuery(episodeQueryOptions(episode.id));
        }}
      >
        <Avatar>
          <AvatarFallback 
            className={personAvatarClassNames(firstInitial)}>
            {firstInitial}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <div className="text-2xl text-sky-800">{episode.name}</div>
          <div className="text-xs font-semibold text-gray-400">{episode.sickness && episode.sickness}</div>
        </div>
      </div>

      <div className={cn("rounded-b-xl bg-gray-100 p-4 text-xs text-gray-600 shadow", { "text-red-700": !episode.end, "text-green-700": episode.end })}>
        <div>{prettyDate(episode.start)} - {episode.end ? prettyDate(episode.end) : <span className="font-semibold italic">ongoing</span>}</div>
        <div className="text-gray-600">{eventsQuery.data?.length ?? '-'} event{(eventsQuery.data?.length ?? 0) > 1 || eventsQuery.data?.length === 0 ? 's' : ''}</div>
      </div>
    </Link>
  )
}

export const Episodes = ({ personId }: EpisodesProps) => {
  let status : EpisodeFilter["status"] = 'active';
  const search = useSearch( { from: '/'  });
  if (search && 'status' in search && search.status) {
    status = search.status;
  }

  const navigate = useNavigate();
  const episodesQuery = useEpisodes({ personId, status });
  const [showCreateEpisodeForm, setShowCreateEpisodeForm] = useState(false);

  return (
    <>
      <div className="mb-2 text-2xl font-semibold uppercase tracking-widest text-teal-700">
      {personId ? (
      <>
        <PersonName personId={personId} />'s Episodes
      </>
      ) : (
        <>Episodes</>
      )}
      </div>
      <div>
        <div className="align-center -ml-4 -mr-4 flex flex-col bg-sky-200 py-4 pb-12 pl-4 shadow-inner">
          <div className="mb-2 text-2xl font-semibold text-sky-700">
            {episodesQuery.data?.length} Episodes
          </div>
          <Tabs defaultValue="active" value={status}>
            <TabsList>
              <TabsTrigger onClick={() => navigate({ to: '/', search: {...search, status: 'active'}})} value="active">Active</TabsTrigger>
              <TabsTrigger onClick={() => navigate({ to: '/', search: {...search, status: 'past'}})} value="past">Past</TabsTrigger>
              <TabsTrigger onClick={() => navigate({ to: '/', search: {...search, status: 'all'}})} value={'all'}>All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="relative top-[-35px] flex h-fit w-fit flex-row items-center gap-4 rounded-2xl bg-white p-4 shadow-lg">
          <Button
            variant="secondary"
            className="h-10 w-fit"
            onClick={() => setShowCreateEpisodeForm(!showCreateEpisodeForm)}
          >
            {personId ? <PersonName personId={personId} /> : 'Someone'} got sick :(
          </Button>
        </div>


        <div className="flex flex-col gap-6">
          {episodesQuery.isSuccess && (
            <>
              {episodesQuery.data?.map(episode => (
                <Episode key={episode.id} episode={episode} />
              ))}
            </>
          )}

        </div>
      </div>

      <Dialog open={showCreateEpisodeForm} onOpenChange={() => setShowCreateEpisodeForm(false)} >
        <DialogContent>
          <DialogHeader >
            <DialogTitle><div className="text-2xl">Dang. That's rough</div></DialogTitle>
            <DialogDescription>
              Let's start taking care of {personId ? <PersonName personId={personId} /> : 'them'}!
            </DialogDescription>
            <div className="!mt-4">
              <EpisodeForm 
                onSuccess={(record: EpisodeResponse) => { 
                  setShowCreateEpisodeForm(false);
                  navigate({ to: '/', search: { personId: record.person, episodeId: record.id }})
                }}
                personId={personId}
              />
            </div>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
};

