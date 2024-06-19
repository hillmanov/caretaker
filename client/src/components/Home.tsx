import { Link, useSearch } from '@tanstack/react-router'
import { Episodes } from './Episodes'
import { Episode } from './Episode'
import { usePersons, EpisodeFilter, useEpisodes } from '@/queries'
import { PersonResponse } from '@/types'
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { personAvatarClassNames } from '@/lib/helpers'
import { cn } from '@/lib/utils'

type HomeProps = {
  personId?: string
  episodeId?: string
}

const PersonLink = ({ person, status }: { person: PersonResponse, status: EpisodeFilter["status"] }) => {
  const episodesQuery = useEpisodes({ personId: person.id });
  const search = useSearch({ from: '/' });
  return (
    <Link 
      key={person.id} 
      to="/" 
      search={{ personId: person.id, status: status || 'all' }} 
      className={cn("group w-24 group-hover:shadow-none group-hover:ring-2", { "active group font-semibold shadow-none": search.personId === person.id })}
    >
      <div 
        className="flex flex-col items-start gap-0 border-l-4 border-transparent p-0 px-2 group-[.active]:border-l-4 group-[.active]:border-sky-500"
      >
        <div className="text-xl text-gray-700 group-hover:text-sky-600 group-[.active]:text-sky-500">
          {person.name}
        </div>
        <div className="text-xs text-gray-400">
          {episodesQuery?.data?.length ?? '-' } episodes
        </div>
      </div>
    </Link>
  )
}

const PersonSelector = () => {
  const search = useSearch({ from: '/' });

  const personsQuery =  usePersons()
  let status: EpisodeFilter["status"] = 'all';
  if (search && 'status' in search) {
    status = search.status;
  }

  if (personsQuery.isLoading) {
    return <div>Loading...</div>
  }
  if (personsQuery.isError) {
    return <div>Error</div>
  }

  return (
    <>
      <div className="invisible w-0 border-r-2 border-gray-200 bg-white p-0 md:visible md:w-fit md:p-4">
        <div className="flex flex-col gap-4 ">
          {personsQuery.data?.map(person => (
            <PersonLink key={person.id} person={person} status={status} />
          ))}

          <div className="h-2 w-full self-center border-0 border-t-2 border-t-gray-200" />
          <Link 
            to="/" 
            search={{ status: 'all' }}
            activeOptions={{ exact: true, includeSearch: true}}
            className={cn("group w-24 group-hover:shadow-none group-hover:ring-2", { "active group font-semibold shadow-none":  !search.personId })}
          >
            <div className="flex flex-col items-start gap-0 border-l-4 border-transparent p-0 px-2 group-[.active]:border-l-4 group-[.active]:border-sky-500 ">
              <div className="text-xl  group-hover:text-sky-600 group-[.active]:text-sky-500">
                All
              </div>
            </div>
          </Link>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 z-[1000000] flex h-20 w-full flex-row items-center justify-between border-t-2 border-gray-200 bg-white p-4 md:invisible">
        {personsQuery.data?.map(person => {
          const firstInitial = person.name[0];
          return (
              <Link 
                key={person.id} 
                to="/" 
                search={{ personId: person.id, status: status || 'all' }} 
                className="group flex h-16 flex-col items-center justify-between group-hover:shadow-none group-hover:ring-2" 
                activeProps={{className: 'active group font-semibold text-sky-600 shadow-none'}}
              >
              <Avatar>
                <AvatarFallback 
                  className={personAvatarClassNames(firstInitial)}>
                  {firstInitial}
                </AvatarFallback>
              </Avatar>
              <div className="text-xs">{person.name}</div>
            </Link>
          )})}

          <Link 
            to="/" 
            search={{ status: 'all' }}
            activeOptions={{ exact: true, includeSearch: true}}
            className={cn("group flex h-16 flex-col items-center justify-between text-gray-400 group-hover:shadow-none group-hover:ring-2", { "active group font-semibold text-sky-600 shadow-none":  !search.personId })}
          >
              <Avatar>
                <AvatarFallback>
                  ∞
                </AvatarFallback>
              </Avatar>
              <div className="text-xs">All</div>
          </Link>
      </div>

    </>
  )
}

const Home = ({ personId, episodeId }: HomeProps) => {
  return (
    <div className="flex h-fit min-h-screen flex-row border-t-4 border-sky-500 bg-gray-100 pb-20 md:pb-0">
      <PersonSelector />

      <div className="h-full w-full p-4">
        {!personId && !episodeId && (
          <Episodes />
        )}
        {personId && !episodeId && (
          <Episodes personId={personId} />  
        )}
        {personId && episodeId && (
          <Episode personId={personId} episodeId={episodeId} />
        )}
      </div>
    </div>
  )
}

export default Home;
