import importPlugin from 'eslint-plugin-import';

export default [
  {
    files: ['**/*.js'],
    plugins: {
      import: importPlugin,
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            // Prevent cross-domain access into private internal directories
            { target: './iam', from: './events/internal' },
            { target: './iam', from: './forms/internal' },
            { target: './iam', from: './announcements/internal' },
            { target: './iam', from: './gallery/internal' },

            { target: './events', from: './iam/internal' },
            { target: './events', from: './forms/internal' },
            { target: './events', from: './announcements/internal' },
            { target: './events', from: './gallery/internal' },

            { target: './forms', from: './iam/internal' },
            { target: './forms', from: './events/internal' },
            { target: './forms', from: './announcements/internal' },
            { target: './forms', from: './gallery/internal' },

            { target: './announcements', from: './iam/internal' },
            { target: './announcements', from: './events/internal' },
            { target: './announcements', from: './forms/internal' },
            { target: './announcements', from: './gallery/internal' },

            { target: './gallery', from: './iam/internal' },
            { target: './gallery', from: './events/internal' },
            { target: './gallery', from: './forms/internal' },
            { target: './gallery', from: './announcements/internal' },
          ],
        },
      ],
    },
  },
];
