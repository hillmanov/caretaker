import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter, Outlet, createRoute, createRootRouteWithContext } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Home from '@/components/Home';
import { Toaster } from "@/components/ui/sonner"
import { EpisodeFilter } from '@/queries'

export const queryClient = new QueryClient()

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: function RootRoute() {return (
    <>
      <Outlet />
    </>
  )},
});   

type PersonEpisodeSelector = {
  personId?: string
  episodeId?: string
  status?: EpisodeFilter["status"]
}

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: PersonEpisodeSelector): PersonEpisodeSelector => {
    return {
      personId: search.personId,
      episodeId: search.episodeId,
      status: search.status,
    }
  },
  component: function HomeRoute() {
    const { personId, episodeId } = homeRoute.useSearch();
    return (
      <>
        <Home personId={personId} episodeId={episodeId} />
        <Toaster />
      </>
    )
  }
});

const routeTree = rootRoute.addChildren([
  homeRoute,
])

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  context: {
    queryClient,
  }
})

// Register things for typesafety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
