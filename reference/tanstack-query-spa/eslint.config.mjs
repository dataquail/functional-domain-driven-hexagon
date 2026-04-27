import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';
import pluginReact from '@eslint-react/eslint-plugin';

export default [
  // Start with files to ignore
  {
    ignores: [
      '**/eslint.config.mjs',
      '**/vite.config.ts',
      '**/vite.config.mts',
      '**/vitest.config.ts',
      '**/mockServiceWorker.js',
    ],
  },

  // Base configurations
  ...baseConfig,
  ...nx.configs['flat/react'],
  pluginReact.configs.recommended,

  // JavaScript files configuration
  {
    files: ['**/*.js', '**/*.jsx', '**/*.mjs'],
    rules: {
      'no-empty-function': 'off',
    },
  },

  // TypeScript files configuration with carefully configured rules
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-namespace': 'off',
      'no-empty-function': 'off',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-empty-function': [
        'error',
        {
          allow: ['arrowFunctions', 'functions', 'methods'],
        },
      ],
    },
  },
];
