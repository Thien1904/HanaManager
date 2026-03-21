// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    "./index.html",
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
            
          50:  '#fff8f0',
          100: '#ffefd6',
          500: '#f5a623',
          600: '#3924f7',
          700: '#c8810f',
          900: '#547fb8',
        }
      }
    },
  },
  plugins: [],
}
export default config
