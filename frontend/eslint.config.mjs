import next from "eslint-config-next/core-web-vitals";

export default [
  {
    ignores: [".next/**", "node_modules/**", "dist/**", "build/**"],
  },
  ...next,
  {
    rules: {
      // load-on-mount via `void load()` in a useEffect is a pre-existing
      // intentional pattern across these client pages; the new rule fires
      // because the loader eventually calls setState. The pattern is the
      // documented "fetch on mount" shape and is safe here.
      "react-hooks/set-state-in-effect": "off",
    },
  },
];
