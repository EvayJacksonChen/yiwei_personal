# AGENTS.md

## Cursor Cloud specific instructions

This repository is a **Jekyll static site** (a personal academic website built on the
`mmistakes/minimal-mistakes` remote theme, deployed via GitHub Pages to `yiweichen.org`).
There is a single "service": the local Jekyll dev server. There is no backend, database, or JS build.

### Ruby version (important, non-obvious)
- The site must be built with **Ruby 3.1.x**, not the system's default Ruby 3.2.
  The resolved `github-pages`/`jekyll` stack pulls a `liquid` version that calls the
  `String#tainted?` method, which was **removed in Ruby 3.2**, so builds fail on 3.2 with
  `undefined method 'tainted?'`.
- The environment has **Ruby 3.1.6** installed at `/opt/ruby-3.1.6` and symlinked into
  `/usr/local/bin` (ahead of `/usr/bin` on `PATH`), so `ruby`, `gem`, and `bundle` resolve
  to 3.1.6 automatically in both interactive and non-interactive shells. No shell init needed.
- Gems install to a global Bundler path (`~/.bundle-gems`, set via `bundle config --global path`),
  so nothing is written under the repo. `Gemfile.lock` is gitignored.

### Install / run / build
- Install deps: `bundle install` (this is also the startup update script).
- Run dev server: `bundle exec jekyll serve --host 0.0.0.0 --port 4000 --livereload`
  (serves at `http://127.0.0.1:4000/`; content edits hot-reload automatically).
- Build: `bundle exec jekyll build` (output goes to gitignored `_site/`).
- Editing `_config.yml` is **not** hot-reloaded — restart the server after changing it.
- The remote theme (`mmistakes/minimal-mistakes@4.27.3`) is fetched from the network on the
  first build, so the initial build requires internet access.

### Lint / test
- There is **no linter and no test suite** configured. "Testing" means the site builds
  successfully and pages render (e.g. `/`, `/biography/`, `/publications/`).
