# Coding Guidelines

## Simplicity First

- **KISS (Keep It Simple, Stupid):** Always prefer straightforward, uncomplicated solutions.
- **YAGNI (You Aren't Gonna Need It):** Only implement what's currently needed. No speculative features.
- Avoid overengineering and unnecessary complexity.
- Code must be readable and maintainable.
- Avoid premature optimization and abstraction.
- Prevent over-engineering and code bloat.
- Keep components simple and focused.
- Prioritise readable code over "smart" or complex optimisations.

## Documentation

- Every function MUST have a comment on top explaining **what** it does and **why**, in plain English.
- Every significant variable MUST have a short comment explaining its purpose.
- Keep comments concise and readable.
- Every line of code MUST have a short, readable inline comment explaining **what** it is doing and **why**, in plain English, so the logic is easy to follow.
- Keep all comments concise — no fluff, just clarity.
- For every file on very top, write short and readable comment to explain what is the purpose of this file.

## Coding Standards

- Naming: Use descriptive, plain-language names for variables and functions.
- Prioritize Readability over Cleverness
- All code must be compatible with the specified package versions.
- Before writing new code, review `package.json` to ensure all dependencies are up-to-date with their latest stable releases.
