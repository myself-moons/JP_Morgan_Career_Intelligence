/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        jpmorgan: {
          navy: "#0a192f",
          dark: "#001b3d",
          blue: "#005ea6",
          accent: "#1e88e5",
          light: "#f0f4f8",
        },
      },
    },
  },
  plugins: [],
}
