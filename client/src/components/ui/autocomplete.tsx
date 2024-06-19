import { uniq, compact } from 'lodash';
import { useState, useEffect } from 'react';
import {
  Command,
  CommandGroup,
  CommandList,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

function useValues(originalValues: string[] | undefined) : [string[], (input: string[]) => void, string, (input: string) => void]{
  const [inputValue, _setInputValue] = useState('');
  const [values, setValues] = useState<string[]>(originalValues || []);
  const [nextValue, setNextValue] = useState<string | null>(null);

  useEffect(() => {
    if (nextValue !== null) {
      _setInputValue(nextValue);
      setNextValue(null); // Reset nextValue
    }
  }, [nextValue, _setInputValue]);

  const setInputValue = (input: string) => {
    setValues(() => compact(uniq([...(originalValues || []), input])));
    setNextValue(input);
  };

  return [values, setValues, inputValue, setInputValue];
}

type AutocompleteProps = {
  originalValues?: string[],
  currentValue: string,
  placeholder: string,
  onSelect: (value: string) => void,
}

const Autocomplete = ({ originalValues, currentValue, placeholder, onSelect }: AutocompleteProps) => {
  const [valueSelectorOpen, setValueSelectorOpen] = useState(false);
  const [values, setValues, inputValue, setInputValue] = useValues(originalValues);

  useEffect(() => {
    setValues(originalValues || []);
  }, [originalValues, setValues])

  return (
    <Popover open={valueSelectorOpen} onOpenChange={setValueSelectorOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={valueSelectorOpen}
          className="w-[200px] justify-between"
        >
          {currentValue ? currentValue : <span className="text-gray-400">New or choose</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder={placeholder} value={inputValue} onValueChange={(v) => setInputValue(v)} />
          <CommandGroup>
            <CommandList>
              {values.map((value) => (
                <CommandItem
                  value={value}
                  key={value}
                  onSelect={() => {
                    onSelect(value)
                    setValueSelectorOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === currentValue ? "opacity-100" : "opacity-0")} />
                  {value}
                </CommandItem>
              ))}
            </CommandList>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export {
  Autocomplete,
}

