/**
* This file was @generated using pocketbase-typegen
*/

import type PocketBase from 'pocketbase'
import type { RecordService } from 'pocketbase'

export enum Collections {
	Details = "details",
	Episode = "episode",
	Event = "event",
	Person = "person",
	Sicknesses = "sicknesses",
	Things = "things",
	Users = "users",
	Whats = "whats",
	WhatsThingsDetails = "whats_things_details",
}

// Alias types for improved usability
export type IsoDateString = string
export type RecordIdString = string
export type HTMLString = string

// System fields
export type BaseSystemFields<T = never> = {
	id: RecordIdString
	created: IsoDateString
	updated: IsoDateString
	collectionId: string
	collectionName: Collections
	expand?: T
}

export type AuthSystemFields<T = never> = {
	email: string
	emailVisibility: boolean
	username: string
	verified: boolean
} & BaseSystemFields<T>

// Record types for each collection

export type DetailsRecord = {
	detail?: string
	thing?: RecordIdString[]
	what?: RecordIdString[]
}

export type EpisodeRecord = {
	end?: IsoDateString
	name?: string
	note?: string
	person?: RecordIdString
	sickness?: string
	start?: IsoDateString
}

export type EventRecord<Tdata = unknown> = {
	data?: null | Tdata
	episode?: RecordIdString
	note?: string
	recordedBy?: RecordIdString
	what: string
	when?: IsoDateString
	where?: string
}

export type PersonRecord = {
	name?: string
	photo?: string
}

export type SicknessesRecord = {
	what?: string
}

export type ThingsRecord = {
	thing?: string
	what?: RecordIdString[]
}

export type UsersRecord = {
	avatar?: string
	name?: string
}

export type WhatsRecord = {
	what?: string
}

export type WhatsThingsDetailsRecord = {
	detail?: string
	thing?: string
	what?: string
}

// Response types include system fields and match responses from the PocketBase API
export type DetailsResponse<Texpand = unknown> = Required<DetailsRecord> & BaseSystemFields<Texpand>
export type EpisodeResponse<Texpand = unknown> = Required<EpisodeRecord> & BaseSystemFields<Texpand>
export type EventResponse<Tdata = unknown, Texpand = unknown> = Required<EventRecord<Tdata>> & BaseSystemFields<Texpand>
export type PersonResponse<Texpand = unknown> = Required<PersonRecord> & BaseSystemFields<Texpand>
export type SicknessesResponse<Texpand = unknown> = Required<SicknessesRecord> & BaseSystemFields<Texpand>
export type ThingsResponse<Texpand = unknown> = Required<ThingsRecord> & BaseSystemFields<Texpand>
export type UsersResponse<Texpand = unknown> = Required<UsersRecord> & AuthSystemFields<Texpand>
export type WhatsResponse<Texpand = unknown> = Required<WhatsRecord> & BaseSystemFields<Texpand>
export type WhatsThingsDetailsResponse<Texpand = unknown> = Required<WhatsThingsDetailsRecord> & BaseSystemFields<Texpand>

// Types containing all Records and Responses, useful for creating typing helper functions

export type CollectionRecords = {
	details: DetailsRecord
	episode: EpisodeRecord
	event: EventRecord
	person: PersonRecord
	sicknesses: SicknessesRecord
	things: ThingsRecord
	users: UsersRecord
	whats: WhatsRecord
	whats_things_details: WhatsThingsDetailsRecord
}

export type CollectionResponses = {
	details: DetailsResponse
	episode: EpisodeResponse
	event: EventResponse
	person: PersonResponse
	sicknesses: SicknessesResponse
	things: ThingsResponse
	users: UsersResponse
	whats: WhatsResponse
	whats_things_details: WhatsThingsDetailsResponse
}

// Type for usage with type asserted PocketBase instance
// https://github.com/pocketbase/js-sdk#specify-typescript-definitions

export type TypedPocketBase = PocketBase & {
	collection(idOrName: 'details'): RecordService<DetailsResponse>
	collection(idOrName: 'episode'): RecordService<EpisodeResponse>
	collection(idOrName: 'event'): RecordService<EventResponse>
	collection(idOrName: 'person'): RecordService<PersonResponse>
	collection(idOrName: 'sicknesses'): RecordService<SicknessesResponse>
	collection(idOrName: 'things'): RecordService<ThingsResponse>
	collection(idOrName: 'users'): RecordService<UsersResponse>
	collection(idOrName: 'whats'): RecordService<WhatsResponse>
	collection(idOrName: 'whats_things_details'): RecordService<WhatsThingsDetailsResponse>
}
