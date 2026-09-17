import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      // This app fetches data with plain useEffect + fetch (no React Compiler / concurrent
      // features in play). The rule flags the common, intentional "reset loading/error state
      // then fetch" pattern used across every list/detail page — safe here, so relaxed to a
      // warning instead of failing the build.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
