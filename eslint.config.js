import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
export default [
 {ignores:['.venv/**','node_modules/**','dist/**','test-results/**','playwright-report/**','**/*.ts','**/*.tsx']},
 js.configs.recommended,
 {files:['**/*.{js,jsx,mjs}'],languageOptions:{ecmaVersion:'latest',sourceType:'module',globals:{...globals.node},parserOptions:{ecmaFeatures:{jsx:true}}},plugins:{react},rules:{'react/jsx-uses-vars':'error','react/jsx-uses-react':'error','no-unused-vars':['error',{args:'none',caughtErrors:'none'}]}},
 {files:['src/**/*.{js,jsx}','tests/**/*.js'],languageOptions:{globals:{...globals.browser}}}
];
