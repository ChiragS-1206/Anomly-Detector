/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: "#1a1f2e",
          card: "#242938",
          border: "#3a4252",
        },
        accent: {
          blue: "#3b82f6",
          green: "#10b981",
          red: "#ef4444",
          yellow: "#f59e0b",
        }
      }
    }
  },
  plugins: [],
}