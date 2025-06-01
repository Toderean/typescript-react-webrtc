/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          "midnight": "#131A2B",
          "darkblue": "#183153",
          "primary-blue": "#2563eb",
          "accent-blue": "#1e40af",
          "almost-black": "#0A0A12",
        },
      },
    },
    plugins: [],
  }
  