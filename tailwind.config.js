/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0B0A14",
          900: "#121022",
          800: "#1B1830",
          700: "#262242",
          600: "#332C58",
        },
        signal: {
          400: "#7CF5D0",
          500: "#4BE3B0",
          600: "#2EC79A",
        },
        flare: {
          400: "#FF8A6B",
          500: "#FF6B4A",
          600: "#E4502F",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(124,245,208,0.15), 0 8px 30px rgba(0,0,0,0.35)",
      },
      backgroundImage: {
        grain: "radial-gradient(circle at 20% 20%, rgba(124,245,208,0.08), transparent 40%), radial-gradient(circle at 80% 0%, rgba(255,107,74,0.08), transparent 45%)",
      },
    },
  },
  plugins: [],
};
