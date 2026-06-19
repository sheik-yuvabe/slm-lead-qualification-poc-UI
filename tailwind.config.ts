import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        border: '#d8dee8',
        surface: '#ffffff',
        muted: '#f3f5f8',
        ink: '#172033'
      },
      boxShadow: {
        panel: '0 1px 2px rgba(16, 24, 40, 0.06)'
      }
    }
  },
  plugins: []
};

export default config;
