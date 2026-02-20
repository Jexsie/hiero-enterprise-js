# Contributing to Hiero Enterprise JS

Thank you for your interest in contributing to Hiero Enterprise JS!

We appreciate your interest in helping us and the rest of our community. We welcome bug reports, feature requests, and code contributions.

**Jump To:**

- [Bug Reports](#bug-reports)
- [Feature Requests](#feature-requests)
- [Code Contributions](#code-contributions)

## Bug Reports

Bug reports are accepted through the [Issues][issues] page.

The [bug][label-bug] label is used to track bugs.

### Before Submitting a Bug Report

Before submitting a bug report, please do the following:

1. Do a search through the existing issues to make sure it has not already been reported. If you find that the bug has already been raised, please give it a +1 to help us to decide which issues we prioritise.

2. If possible, upgrade to the latest release of the library. It's possible the bug has already been fixed in the latest version.

If you have completed these steps and you need to submit a bug report, please read the guidelines below.

### Submitting a Bug Report

Please ensure that your bug report contains the following:

- A short, descriptive title. Other community members should be able to understand the nature of the issue by reading this title.
- A succinct, detailed description of the problem you're experiencing. This should include:
    - Expected behaviour of the library and the actual behaviour exhibited.
    - Any details of your application development environment that may be relevant (Node.js version, framework, network).
    - If applicable, the exception stack-trace.
    - If you are able to create one, include a [Minimal Working Example][mwe] that reproduces the issue.
- [Markdown][markdown] formatting as appropriate to make the report easier to read; for example use code blocks when pasting a code snippet or exception stack-trace.

## Requirements

- `pnpm` (latest) — https://pnpm.io
- `node` (≥20) — https://nodejs.org

## Building the Library

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Run unit tests
pnpm run test

# Lint (type check + ESLint)
pnpm run lint

# Format code
pnpm run format
```

### Running Integration Tests

> **Note:** Integration tests are not yet implemented. The CI workflow includes a commented-out integration job using [hiero-solo-action](https://github.com/hiero-ledger/hiero-solo-action) that will be activated once integration tests are written.

When integration tests are available:

1. **Setup Solo local network:**
   ```bash
   # Requires Docker and sufficient RAM (12+ GB)
   # Solo will spin up consensus node(s) and mirror node services
   ```

2. **Run integration tests:**
   ```bash
   pnpm run test:integration
   ```

## Feature Requests

Feature requests are also submitted through the [Issues][issues] page.

As with Bug Reports, please do a search of the open requests first before submitting a new one to avoid duplicates. If you do find a feature request that represents your suggestion, please give it a +1.

**NOTE:** If you intend to implement this feature, please submit the feature request _before_ working on any code changes. This will allow maintainers to assess the idea, discuss the design with you and ensure that it makes sense to include such a feature in the library.

Feature requests are labeled as [enhancements][label-enhancement].

### Submitting a Feature Request

Open an [issue][issues] with the following:

- A short, descriptive title. Other community members should be able to understand the nature of the issue by reading this title.
- A detailed description of the proposed feature. Explain why you believe it should be added to the library. Illustrative example code may also be provided to help explain how the feature should work.
- [Markdown][markdown] formatting as appropriate to make the request easier to read.
- If you plan to implement this feature yourself, please let us know that you'd like the issue to be assigned to you.

## Code Contributions

Code contributions are handled using [Pull Requests][pull-requests]. Please keep the following in mind when considering a code contribution:

- The library is released under the [Apache 2.0 License][license].

    Any code you submit will be released under this license.

- For anything other than small or quick changes, you should always start by reviewing the [Issues][issues] page to ensure that nobody else is already working on the same issue.

    If you're working on a bug fix, check to see whether the bug has already been reported. If it has but no one is assigned to it, ask one of the maintainers to assign it to you before beginning work. If you're confident the bug hasn't been reported yet, create a new [Bug Report](#bug-reports) and ask us to assign it to you.

    If you are thinking about adding entirely new functionality, open a [Feature Request](#feature-requests) to ask for feedback first before beginning work; this is to ensure that nobody else is already working on the feature and to confirm that it makes sense for such functionality to be included in the library.

- All code contributions must be accompanied with new or modified tests that verify that the code works as expected; i.e. that the issue has been fixed or that the functionality works as intended.

### Coding Standards

- **TypeScript** — strict mode, no implicit `any`
- **ESLint** — `typescript-eslint` recommended rules with Prettier integration
- **Prettier** — enforced formatting (single quotes, trailing commas, 80-char width)
- **Naming** — `PascalCase` for classes/interfaces, `camelCase` for functions/variables
- **Imports** — use `import type` for type-only imports
- **Tests** — use [Vitest](https://vitest.dev/); aim for coverage of all public API methods

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

feat:     New feature
fix:      Bug fix
docs:     Documentation
chore:    Maintenance (deps, CI, config)
refactor: Code restructuring
test:     Adding/updating tests
```

### DCO Sign-Off

This project uses the [Developer Certificate of Origin (DCO)](https://developercertificate.org/) to certify that contributors have the right to submit their code.

**Every commit must include a `Signed-off-by` trailer** with your real name and email:

```
Signed-off-by: Jane Doe <jane@example.com>
```

Add it automatically with the `-s` flag:

```bash
git commit -s -m "feat: add scheduled transaction support"
```

If you forgot to sign off, amend the last commit:

```bash
git commit --amend -s --no-edit
```

### GPG Signed Commits

We recommend that all commits are GPG-signed. Follow GitHub's guide to [sign commits with GPG](https://docs.github.com/en/authentication/managing-commit-signature-verification).

```bash
# Enable auto-signing
git config commit.gpgsign true
```

### Pull Request Readiness

Before submitting your pull request, refer to the pull request readiness checklist below:

- [ ] Includes tests to exercise the new behaviour
- [ ] Code is documented, especially public and user-facing constructs
- [ ] Local run of `pnpm run build` succeeds
- [ ] Linting passes: `pnpm run lint`
- [ ] Formatting passes: `pnpm run format:check`
- [ ] Unit tests pass: `pnpm run test`
- [ ] Git commit message is detailed and includes context behind the change
- [ ] Commits are signed off (`git commit -s`) and GPG-signed
- [ ] If the change is related to an existing Bug Report or Feature Request, please include its issue number

To contribute, please fork the GitHub repository and submit a pull request to the `main` branch.

### Getting Your Pull Request Merged

All Pull Requests must be approved by at least one maintainer before it can be merged. Maintainers only have limited bandwidth to review Pull Requests so it's not unusual for a Pull Request to go unreviewed for a few days, especially if it's a large or complex one.

[license]: ./LICENSE
[mwe]: https://en.wikipedia.org/wiki/Minimal_Working_Example
[markdown]: https://guides.github.com/features/mastering-markdown/
[issues]: ../../issues
[pull-requests]: ../../pulls
[label-bug]: ../../labels/bug
[label-enhancement]: ../../labels/enhancement
