import { some, every, map, times } from 'lodash';
import { useForm, useFieldArray } from 'react-hook-form';
import {
  usePersons,
  useEventAutocompleteSuggestions,
  useCreateEventMutation,
  useUpdateEventMutation,
  EventCallBacks
} from '@/queries';
import { EventRecord, EventData, EventResponse } from '@/types';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Calendar as CalendarIcon } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TimePicker } from "@/components/ui/time-picker"
import { Autocomplete} from "@/components/ui/autocomplete"
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from "date-fns"
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

type EventFormProps = EventCallBacks & {
  episodeId: string;
  event: EventResponse<EventData> | null;
}

const eventSchema = z.object({
  what: z.string().min(1, {
    message: "You need to say what happened!",
  }),
  when: z.date({ required_error: "Oops. Missed this one!"}),
  where: z.string().min(1, { message: "Gotta be thorough here!"}),
  data: z.array(z.object({ thing: z.string().min(1, { message: "👆"}), detail: z.string().min(1, { message: "👆"})})),
  note: z.string().optional(),
  recordedBy: z.string().min(1, { message: "Ah ha!"}),
});

const EventForm = ({ episodeId, event, onSuccess, onError }: EventFormProps) => {
  const personsQuery = usePersons();
  const autocompleteSuggestionsQuery = useEventAutocompleteSuggestions();

  const createEventMutation = useCreateEventMutation({ onSuccess, onError });
  const updateEventMutation = useUpdateEventMutation({ onSuccess, onError });

  const form = useForm<z.infer<typeof eventSchema>>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      what: event?.what ?? "",
      when: event ? dayjs(event.when).toDate() : dayjs().subtract(10, "minute").toDate(),
      where: event?.where ?? "",
      note: event?.note ?? "",
      data: event?.data ?? [],
      recordedBy: event?.recordedBy ?? "",
    }
  });

  const dataFieldsController = useFieldArray({
    control: form.control,
    name: "data",
  });

  const handleWhatChange = (value: string) => {
    form.setValue('what', value);
    dataFieldsController.replace(
      map(autocompleteSuggestionsQuery.data?.thingsByWhat[value], (thing) => ({ thing, detail: '' }))
    )
  };

  const onSubmit = (values: z.infer<typeof eventSchema>) => {
    const eventRecord: EventRecord = {
      episode: episodeId,
      what: values.what,
      when: dayjs(values.when).format(),
      where: values.where,
      data: values.data,
      note: values.note,
      recordedBy: values.recordedBy,
    }

    if (event?.id) {
      updateEventMutation.mutate({ eventId: event.id, event: eventRecord });
      return;
    } else {
      createEventMutation.mutate({ event: eventRecord });
    }
    form.reset();
  }

  const whatFieldValue = form.watch('what');
  const thingsFields = form.watch(times(dataFieldsController.fields.length, (i: number) : `data.${number}.thing` => `data.${i}.thing`));

  if (some([personsQuery, autocompleteSuggestionsQuery], 'isLoading'))  {
    return (
      <div>Loading...</div>
    )
  }
  if (!every([personsQuery, autocompleteSuggestionsQuery], 'isSuccess')) {
    return (
      <div>Failed to load data!</div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="h-fit">
        <div className="mb-4">
          <FormField
            control={form.control}
            name="what"
            render={({ field }) => (
              <FormItem>
                <div className="-mb-2">
                  <FormLabel>What happened?</FormLabel>
                </div>
                <FormControl>
                  <Autocomplete 
                    placeholder="Barf? Drink? Eat?"
                    originalValues={autocompleteSuggestionsQuery.data?.what} 
                    currentValue={field.value} 
                    onSelect={handleWhatChange} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div>
          <FormLabel>More details?</FormLabel>
        </div>

        {dataFieldsController.fields.map((item, index) => {
          return (
            <div key={item.id} className="mb-2 flex flex-wrap items-center gap-2">
              <FormField
                control={form.control}
                name={`data.${index}.thing`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Autocomplete 
                        placeholder="Thing, item, or metric..."
                        originalValues={autocompleteSuggestionsQuery.data?.thingsByWhat[whatFieldValue]}
                        currentValue={field.value} 
                        onSelect={field.onChange} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />:
              <div className="w-full sm:w-auto"></div>
              <FormField
                control={form.control}
                name={`data.${index}.detail`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Autocomplete 
                        placeholder="Measurement, quantity, or value..."
                        originalValues={autocompleteSuggestionsQuery.data?.detailsByThing[whatFieldValue]?.[thingsFields?.[index]]}
                        currentValue={field.value} 
                        onSelect={field.onChange} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div onClick={() => dataFieldsController.remove(index)} className="group cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-6 w-6">
                  <path className="fill-red-300 group-hover:fill-red-400" d="M5 5h14l-.89 15.12a2 2 0 0 1-2 1.88H7.9a2 2 0 0 1-2-1.88L5 5zm5 5a1 1 0 0 0-1 1v6a1 1 0 0 0 2 0v-6a1 1 0 0 0-1-1zm4 0a1 1 0 0 0-1 1v6a1 1 0 0 0 2 0v-6a1 1 0 0 0-1-1z"/>
                  <path className="fill-red-500 group-hover:fill-red-700" d="M8.59 4l1.7-1.7A1 1 0 0 1 11 2h2a1 1 0 0 1 .7.3L15.42 4H19a1 1 0 0 1 0 2H5a1 1 0 1 1 0-2h3.59z"/>
                </svg>
              </div>
            </div>
          )})}
        <Button variant="outline" size="sm" className="mb-4" onClick={(e) =>{
          e.preventDefault();
          dataFieldsController.append({ thing: '', detail: '' });
        }}>
          <div className="group flex flex-row items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-6 w-6">
              <circle cx="12" cy="12" r="10" className="fill-blue-200 group-hover:fill-blue-300"/>
              <path className="fill-blue-400 group-hover:fill-blue-600" d="M13 11h4a1 1 0 0 1 0 2h-4v4a1 1 0 0 1-2 0v-4H7a1 1 0 0 1 0-2h4V7a1 1 0 0 1 2 0v4z"/>
            </svg>
            Add some info
          </div>
        </Button>

        <div className="mb-4">
          <FormLabel>When did this go down?</FormLabel>
          <div className="flex w-fit flex-col gap-2">
            <FormField
              control={form.control}
              name="when"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="minimal"
                          className={cn("min-w-[200px] pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                        >
                          {field.value ? (format(field.value, "PPP")) : ( <span>Pick a date</span>)}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="when"
              render={() => (
                <FormItem>
                  <FormControl>
                    <TimePicker 
                      date={dayjs(form.watch('when')).toDate()}
                      setDate={(date) => form.setValue('when', new Date(date || 0))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="mb-4">
          <FormField
            control={form.control}
            name="where"
            render={({ field }) => (
              <FormItem>
                <div className="-mb-2">
                  <FormLabel>Where did it happen?</FormLabel>
                </div>
                <FormControl>
                  <Autocomplete 
                    placeholder="Room, couch, kitchen, car..."
                    originalValues={autocompleteSuggestionsQuery.data?.where} 
                    currentValue={field.value} 
                    onSelect={field.onChange} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="mb-4">
          <FormField
            control={form.control}
            name="recordedBy"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Who is recording this?</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose the helper" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {map(personsQuery.data, (person) => (
                      <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="mb-4">
          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>

                <div className="-mb-2">
                  <FormLabel>Note</FormLabel>
                </div>
                <FormControl>
                  <Textarea className="w-full" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit">Save</Button>
      </form>
    </Form>
  )}

export default EventForm;
