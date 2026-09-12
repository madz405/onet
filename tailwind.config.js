/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Nilai warna diambil dari CSS variable (lihat app/globals.css) supaya
        // bisa berubah sesuai tema yang dipilih user (atribut data-theme di <html>).
        // Pola "rgb(var(--x) / <alpha-value>)" tetap membuat modifier opacity
        // Tailwind (contoh: bg-ink-900/60) berfungsi normal.
        ink: {
          950: "rgb(var(--ink-950) / <alpha-value>)",
          900: "rgb(var(--ink-900) / <alpha-value>)",
          800: "rgb(var(--ink-800) / <alpha-value>)",
          700: "rgb(var(--ink-700) / <alpha-value>)",
          600: "rgb(var(--ink-600) / <alpha-value>)",
        },
        signal: {
          400: "rgb(var(--signal-400) / <alpha-value>)",
          500: "rgb(var(--signal-500) / <alpha-value>)",
          600: "rgb(var(--signal-600) / <alpha-value>)",
        },
        flare: {
          400: "rgb(var(--flare-400) / <alpha-value>)",
          500: "rgb(var(--flare-500) / <alpha-value>)",
          600: "rgb(var(--flare-600) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgb(var(--signal-400) / 0.15), 0 8px 30px rgba(0,0,0,0.35)",
      },
      backgroundImage: {
        grain: "radial-gradient(circle at 20% 20%, rgb(var(--signal-500) / 0.08), transparent 40%), radial-gradient(circle at 80% 0%, rgb(var(--flare-500) / 0.08), transparent 45%)",
      },
    },
  },
  plugins: [],
};
