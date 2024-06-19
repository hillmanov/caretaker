# Caretaker
## Keep track of who was sick, with what, when, and what happened while they were sick. 

## Overview
Monitor and record details about individuals who fall ill, including symptoms, timeline, and related events.

### Tech Stack
- Backend: Go + Pocketbase (<https://pocketbase.io>)
- Frontend: Bun + React + TypeScript + react-query + TailwindCSS + Shadcn/UI

### Getting Started
* Clone the repository
* Navigate to the `client` folder and run `bun install`
* In the root directory, execute `make run`
    * This command starts both the backend server and frontend development server on port 3028.
* Access the Pocketbase instance via <http://localhost:3028/_/>
* Open the app at <http://localhost:3027>
* Optionally, add `caretaker.local.com` to your `/etc/hosts` file for easier navigation (access the app at <http://caretaker.local.com> and the Pocketbase instance at <http://caretaker.local.com/admin>)

### Setup
Upon first use, the app will be empty. To make it useful:
* Input data into the `person` collection via the Pocketbase admin.
* If you prefer intelligent autocomplete suggestions for symptoms, events, and related details, fill out the `sicknesses`, `whats`, `details`, and `things` collections in that order (this is optional)
    * Your actual data will contribute to the autocomplete suggestions.

#### History
This app was primarily created as an opportunity to experiment with and learn a few new technologies:
- Bun (<https://bun.sh>) - used only for running the development server
- react-query (<https://tanstack.com/query/latest>)
- shadcn/ui (<https://ui.shadcn.com/>)
- Pocketbase (<https://pocketbase.io>)
- TailwindCSS (<https://tailwindcss.com>)
- TypeScript (<https://typescriptlang.org>)

I did not attempt to use the most idiomatic ways of utilizing these technologies - rather, it was about gaining more experience with them.

### Disclaimer
This app is intended for private use within a non-public network. There are no security measures or login implemented since they are of of scope. 
Use at your own risk.
