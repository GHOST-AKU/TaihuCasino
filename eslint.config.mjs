import nextVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

const config = [
  {
    ignores: [
      ".next/**",
      ".playwright-cli/**",
      "assets/**",
      "docs/**",
      "node_modules/**",
      "out/**",
      "output/**",
      "outputs/**",
      "pages/**",
      "playwright-report/**",
      "prototypes/**",
      "supabase/.temp/**",
      "test-results/**",
      "*.config.js",
    ],
  },
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]

export default config
