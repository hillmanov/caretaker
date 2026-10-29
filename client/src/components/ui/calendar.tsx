import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "relative flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center h-7",
        caption_label: "text-sm font-medium",
        nav: "absolute inset-x-0 top-1 z-10 flex items-center justify-between px-1",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday:
          "text-slate-500 rounded-md w-9 font-normal text-[0.8rem] dark:text-slate-400",
        week: "flex w-full mt-2",
        day: "group h-9 w-9 text-center text-sm p-0 relative rounded-md focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal group-aria-selected:opacity-100"
        ),
        range_end: "day-range-end",
        selected:
          "[&>button]:bg-slate-900 [&>button]:text-slate-50 [&>button]:hover:bg-slate-900 [&>button]:hover:text-slate-50 [&>button]:focus:bg-slate-900 [&>button]:focus:text-slate-50 dark:[&>button]:bg-slate-50 dark:[&>button]:text-slate-900 dark:[&>button]:hover:bg-slate-50 dark:[&>button]:hover:text-slate-900 dark:[&>button]:focus:bg-slate-50 dark:[&>button]:focus:text-slate-900",
        today: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50",
        outside:
          "day-outside text-slate-500 opacity-50 aria-selected:opacity-30 dark:text-slate-400",
        disabled: "text-slate-500 opacity-50 dark:text-slate-400",
        range_middle:
          "aria-selected:bg-slate-100 aria-selected:text-slate-900 dark:aria-selected:bg-slate-800 dark:aria-selected:text-slate-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
