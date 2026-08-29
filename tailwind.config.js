/** @type {import('tailwindcss').Config} */
export default {
  content: ["./under-cover/**/*.{html,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        undercover: {
          bg: "#0a0a0f",
          surface: "#14141f",
          card: "#1a1a28",
          border: "#2a2a3d",
          accent: "#a855f7",
          "accent-dim": "#7c3aed",
          danger: "#ef4444",
          success: "#22c55e",
          muted: "#94a3b8",
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        display: ["Syne", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
