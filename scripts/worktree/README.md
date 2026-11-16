# Worktrees

Optional, for working on several branches at once. Each worktree gets its own
checkout, dependencies and ports, using [Worktrunk](https://worktrunk.dev/)
and the project config in `.config/wt.toml`.

- `wt switch --create <branch>` creates the worktree, installs dependencies,
  builds the packages and starts the site and playground on ports derived from
  the branch name. Add `--base @` to stack it on the current branch.
- `wt urls` prints the site, playground and docs URLs. `wt dev` starts the site
  and playground again, `wt docs` starts the docs, and `wt remove` deletes the
  worktree and stops its servers.
- In a worktree, use `wt dev` rather than `pnpm dev`, which uses the shared
  default ports.
- A worktree made another way (`git worktree add`, or a tool that makes its
  own): run `bash scripts/worktree/setup.sh` once inside it. It refuses to run
  in the main checkout.
- The first `wt` command asks you to approve the project's commands. A
  non-interactive shell (an agent, CI) can't answer the prompt; approve them
  once with `wt config approvals add`.
- The servers listen on localhost only.
