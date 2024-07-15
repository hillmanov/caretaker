import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { usePersons, useCreateEpisodeMutation, useUpdateEpisodeMutation, EpisodeCallBacks } from '@/queries';
import {
  EpisodeRecord,
  EpisodeResponse,
} from '@/types';
import { 
  Label
} from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { 
  Switch
} from "@/components/ui/switch"
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import { Calendar as CalendarIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TimePicker } from "@/components/ui/time-picker"
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from "date-fns"
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

const episodeSchema = z.object({
  name: z.string().min(1, { message: "You need to fill this one in!"}),
  sickness: z.string().min(1, { message: "What kind of sickness?"}),
  person: z.string().min(1, { message: "Who got sick????"}),
  start: z.date({ required_error: "We need this!"}),
  end: z.date({ required_error: "We need this!"}),
  note: z.string().optional(),
});

type EpisodeFormProps = EpisodeCallBacks & {
  personId?: string;
  episode?: EpisodeResponse | null;
}

const EpisodeForm = ({ personId, episode, onSuccess, onError }: EpisodeFormProps) => {
  const personsQuery = usePersons();
  const createEpisodeMutation = useCreateEpisodeMutation({ onSuccess, onError });
  const updateEpisodeMutation = useUpdateEpisodeMutation({ onSuccess, onError });
  const [recovered, setRecovered] = useState(!!episode?.end);

  const form = useForm<z.infer<typeof episodeSchema>>({
    resolver: zodResolver(episodeSchema),
    defaultValues: {
      name: episode?.name || "",
      sickness: episode?.sickness || "",
      person: episode?.person || personId || "",
      start: episode?.start ? dayjs(episode.start).toDate() : dayjs().subtract(10, "minute").toDate(),
      end: episode?.end ? dayjs(episode.end).toDate() : dayjs().toDate(),
      note: episode?.note || "",
    }
  });

  const onSubmit = (values: z.infer<typeof episodeSchema>) => {
    const episodeRecord: EpisodeRecord = {
      person: values.person,
      name: values.name,
      sickness: values.sickness,
      start: dayjs(values.start).format(),
      end: recovered ? dayjs(values.end).format() : '',
      note: values.note,
    }

    if (episode?.id) {
      updateEpisodeMutation.mutate({ episodeId: episode.id, episode: episodeRecord });
    } else {
      createEpisodeMutation.mutate({ episode: episodeRecord });
    }
    form.reset();
  }

  useEffect(() => {
    if (personId) {
      form.setFocus("sickness");
    }
  }, [form, personId])

  if (personsQuery.isLoading) return <div>Loading...</div>
  if (!personsQuery.isSuccess) return <div>Failed to load people</div>

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="h-fit">
        <div className="mb-4">
          <FormField
            control={form.control}
            name="person"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Who got sick?</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select the sicky" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {personsQuery.data.map((person) => (
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
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>What should we call this episode?</FormLabel>
                <FormControl>
                  <Input placeholder="The grand cold of '24" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="mb-4">
          <FormField
            control={form.control}
            name="sickness"
            render={({ field }) => (
              <FormItem>
                <FormLabel>What do they have?</FormLabel>
                <FormControl>
                  <Input placeholder="bleh" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="mb-4">
          <FormLabel>When did this go down?</FormLabel>
          <div className="flex w-fit flex-col gap-2">
            <FormField
              control={form.control}
              name="start"
              render={({ field }) => (
                <FormItem className="flex flex-col flex-wrap gap-2">
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
              name="start"
              render={() => (
                <FormItem>
                  <FormControl>
                    <TimePicker 
                      date={dayjs(form.watch('start')).toDate()}
                      setDate={(date) => form.setValue('start', new Date(date || 0))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="mb-4 flex items-center space-x-2">
          <Switch 
            id="recovered" 
            checked={recovered} 
            onCheckedChange={() => {
              setRecovered(!recovered)
            }} />
          <Label htmlFor="recovered">Recovered</Label>
        </div>

        

        {(recovered) && (
          <>
            <div className="mb-4">
              <FormLabel>When did all this end?</FormLabel>
              <div className="flex w-fit flex-col gap-2">
                <FormField
                  control={form.control}
                  name="end"
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
                  name="end"
                  render={() => (
                    <FormItem>
                      <FormControl>
                        <TimePicker 
                          date={dayjs(form.watch('end')).toDate()}
                          setDate={(date) => form.setValue('end', new Date(date || 0))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />


                
              </div>
            </div>
          </>
        )}

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

export default EpisodeForm;
