NEVER run commands that may affect other services or files on the host machine. Always use targeted operations within the current project.

Do not use mocks in tests. Tests should be a simple setup, run and assertion without any mocking layers.

Use strict types whenever possible. Avoid using 'any' type in TypeScript code.

Keep implementation minimalistic and modular. Follow the code style, standards and patterns already established in the codebase.

When refactoring, never add migrations unless explicity asked to do so.

Test cases should fail if the implementation is incorrect or incomplete.

NEVER add stubs or placeholders. All functions and methods must have complete implementations.

Always install dependencies with `npm i package@latest` to ensure the latest version is used.

Always make sure `npm run check` passes after making changes to verify that the code compiles without errors and tests pass.
