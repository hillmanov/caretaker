export const personAvatarClassNames = (initial: string) => {
  switch (initial) {
    case 'S': return "border border-sky-500 bg-sky-100 text-sky-700"
    case 'E': return "border border-purple-500 bg-purple-100 text-purple-700"
    case 'D': return "border border-pink-500 bg-pink-100 text-pink-700"
    case 'A': return "border border-red-500 bg-red-100 text-red-700"
    case 'L': return "border border-orange-500 bg-orange-100 text-orange-700"
    case 'M': return "border border-fuchsia-500 bg-fuchsia-100 text-fuchsia-700"
    default:  
      return ""
  }
}

