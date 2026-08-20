/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/pages/landing/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  corePlugins: {
    // CRITICAL: This stops Tailwind from resetting Ant Design's global styles
    preflight: false,
  },
  plugins: [],
}