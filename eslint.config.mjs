import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        ignores: ["node_modules/**", "coverage/**", "examples/**"]
    },
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                require: "readonly",
                module: "readonly",
                process: "readonly",
                __dirname: "readonly",
                console: "readonly",
                describe: "readonly",
                it: "readonly",
                expect: "readonly",
                jest: "readonly",
                beforeEach: "readonly",
                afterEach: "readonly",
                beforeAll: "readonly",
                afterAll: "readonly",
                URL: "readonly"
            }
        },
        rules: {
            "no-console": "off",
            "no-unused-vars": "warn",
            "semi": ["error", "always"],
            "quotes": "off"
        }
    }
];
