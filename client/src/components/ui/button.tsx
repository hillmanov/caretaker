import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(`
    inline-flex
    items-center
    justify-center
    whitespace-nowrap
    rounded-md
    text-sm
    font-medium
    ring-offset-white
    transition-colors
    focus:outline-none
    focus:ring-0
    disabled:pointer-events-none
    disabled:opacity-50
    dark:ring-offset-sky-900
  `,
  {
    variants: {
      variant: {
        default: `
          text-semibold
          bg-sky-500
          text-sky-50
          hover:bg-sky-700/90
          dark:bg-sky-50
          dark:text-sky-900
          dark:hover:bg-sky-50/90
        `,
        destructive: `
          bg-red-500
          text-sky-50
          hover:bg-red-500/90
          dark:bg-red-900
          dark:text-sky-50
          dark:hover:bg-red-900/90
       `,
        outline: `
          border
          border-slate-300
          bg-white
          text-slate-900
          hover:bg-sky-100
          hover:text-sky-900
          dark:border-sky-800
          dark:bg-sky-900
          dark:hover:bg-sky-800
          dark:hover:text-sky-50
        `,
        secondary: `
          border
          bg-sky-100
          text-sky-600
          hover:border-sky-300
          hover:bg-sky-200
          hover:text-sky-800
          dark:bg-sky-800
          dark:text-sky-50
          dark:hover:bg-sky-800/80
        `,
        green: `
          border
          bg-green-100
          text-green-700
          hover:border-green-300
          hover:bg-green-200
          hover:text-green-800
          dark:bg-green-800
          dark:text-green-50
          dark:hover:bg-green-800/80
        `,
        ghost: `
          hover:bg-sky-100
          hover:text-sky-900
          dark:hover:bg-sky-800
          dark:hover:text-sky-50
        `,
        link: `
          text-sky-900
          underline-offset-4
          hover:underline
          dark:text-sky-50
      `,
        minimal: `
          border
          bg-white
      `,
        icon: `
          text-sky-600
          hover:bg-sky-100
          hover:text-sky-800
          dark:hover:text-sky-50
      `,
      },
      size: {
        default: `h-10 px-4 py-2`,
        sm: `h-9 rounded-md px-3`,
        lg: `h-11 rounded-md px-8`,
        icon: `h-9 w-9 rounded-md`,
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
