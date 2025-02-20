// .eslintrc.js
module.exports = {
    root: true,
    extends: [
      "universe/native",
      "universe/shared/typescript-analysis",
      "plugin:react-hooks/recommended",
    ],
    overrides: [
      {
        files: ["*.ts", "*.tsx", "*.d.ts"],
        parserOptions: {
          project: "./tsconfig.json",
        },
      },
    ],
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "react/react-in-jsx-scope": "off",
    },
    settings: {
      "import/resolver": {
        typescript: {},
        node: {
          extensions: [".js", ".jsx", ".ts", ".tsx"],
        },
      },
    },
  };