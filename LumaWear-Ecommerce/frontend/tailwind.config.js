/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#f7f4ee",
        charcoal: "#232323",
        ink: "#111111",
        muted: "#c9a287",
        sand: "#e9ddcf",
      },
      boxShadow: {
        soft: "0 8px 20px rgba(17,17,17,0.08)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
