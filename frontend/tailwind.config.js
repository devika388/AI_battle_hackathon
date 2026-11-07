/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: "#184d3b",
        leaf: "#3d8b63",
        cream: "#f7f6ef",
      },
    },
  },
  plugins: [],
};
