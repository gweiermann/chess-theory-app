import js from '@eslint/js'
import ts from 'typescript-eslint'
import vue from 'eslint-plugin-vue'

export default ts.config(
  {
    ignores: [
      'node_modules/**',
      '.nuxt/**',
      '.output/**',
      'storybook-static/**',
      'public/**',
      'data/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      '*.tsbuildinfo',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.ts', '**/*.vue'],
    languageOptions: { parserOptions: { parser: ts.parser } },
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      'vue/multi-word-component-names': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-self-closing': [
        'error',
        { html: { void: 'always', normal: 'always', component: 'always' } },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex:
                '(?:^|/)modules/[^/]+/(?!public(?:\\.[cm]?tsx?)?$|index(?:\\.[cm]?tsx?)?$).+',
              message:
                'Use the module public entry point. Private implementations stay inside their owning module.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['app/modules/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex:
                '^\\.\\./(?:board|openings|learning|selection|training)/(?!public(?:\\.[cm]?tsx?)?$|index(?:\\.[cm]?tsx?)?$).+',
              message: 'Import another module through its public entry point.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
      },
    },
  },
)
