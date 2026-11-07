/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: "#365C48",
        sage: "#A8C3A0",
        cream: "#FAF8F1",
        blush: "#F2D8D5",
        butter: "#F6E8B5",
        lavender: "#DED9F2",
        powder: "#D9E9F0",
        charcoal: "#242B26",
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
      },
      boxShadow: {
        soft: "0 12px 40px rgba(36, 43, 38, 0.07)",
        card: "0 4px 18px rgba(36, 43, 38, 0.05)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};
