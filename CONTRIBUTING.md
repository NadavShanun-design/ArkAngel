# Contributing to ArkAngel

Thanks for your interest in contributing to ArkAngel! This guide explains how to set up your environment, follow our coding standards, and submit changes.

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork:
   ```bash
   git clone https://github.com/<your-username>/ArkAngel.git
   cd ArkAngel
   ```
3. **Install prerequisites:**
   - Node.js 18+
   - Rust 1.70+
   - Tauri CLI

4. **Install dependencies:**
   ```bash
   npm install
   ```

5. **Run the development build:**
   ```bash
   npm run tauri dev
   ```

## Coding Guidelines

- Follow existing code style and naming conventions.
- Keep commits atomic and messages descriptive.
- Test changes locally on your platform before submitting.
- Ensure no sensitive data (PII/PHI) is logged or exposed.
- Update documentation if you introduce new features or changes.

## Submitting Changes

1. **Create a new branch:**
   ```bash
   git checkout -b feature/<short-description>
   ```

2. **Make your changes.**

3. **Commit and push:**
   ```bash
   git commit -m "Describe your change"
   git push origin feature/<short-description>
   ```

4. **Open a pull request (PR)** to the main branch on the upstream repository.

Please link any related issues in your PR description.

## Reporting Issues

- Use the GitHub Issues tab to report bugs or request features.
- Include steps to reproduce, expected behavior, actual behavior, and your platform details.

## Code of Conduct

Be respectful, constructive, and professional in all interactions. We're building something to help people, so let's treat each other the same way.

## Questions?

Open an issue or reach out through the repository's discussions section.

Thank you for helping make ArkAngel better!