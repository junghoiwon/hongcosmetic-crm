/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        porcelain: "#FAF9F5",
        ink: "#211F1C",
        subink: "#6B665F",
        line: "#E4E0D6",
        jade: {
          50: "#EEF4F1",
          100: "#D6E5DE",
          300: "#8CB6A6",
          500: "#2F6F62",
          600: "#255A4F",
          700: "#1C453D",
        },
        clay: {
          50: "#FBEFE9",
          100: "#F5D9CB",
          300: "#E8A98C",
          500: "#CC6E4C",
          600: "#B15A3B",
        },
        gold: {
          400: "#C9A24B",
          500: "#AD8836",
        },
      },
      fontFamily: {
        display: ["'Noto Serif KR'", "serif"],
        sans: ["'Pretendard Variable'", "Pretendard", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(33,31,28,0.04), 0 1px 12px rgba(33,31,28,0.05)",
      },
      borderRadius: {
        card: "10px",
      },
    },
  },
  plugins: [],
};
