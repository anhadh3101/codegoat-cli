# System Setup Notes

This package modifies real macOS system state (directory service records, filesystem
ACLs). This file tracks exactly what gets touched, so it can be reviewed before this
moves out of dev mode into whatever the real deployment story ends up being.

## Directory service (dscl)

`src/mac/createUser.ts` and `src/mac/deleteUser.ts` shell out to `dscl` (via `sudo`)
to manage a restricted local macOS user/group used to run the sandboxed agent process.

- `dscl . -create /Users/<username> ...` — creates the user record (UID >= 601,
  shell `/usr/bin/false`, home `/var/empty`, disabled password auth).
- `dscl . -create /Groups/<groupname> ...` — creates the group record (GID >= 701).
- `dscl . -append /Groups/<groupname> GroupMembership <member>` — adds the sandbox
  user (and the invoking admin user) to the group.
- `dscl . -delete /Users/<username>` / `dscl . -delete /Groups/<groupname>` — removes
  the records. Guarded by UID/GID floor checks so it refuses to delete accounts that
  don't look CodeGoat-managed.

None of this is dev-mode-gated today — it always makes real system changes on
macOS. Review before broader rollout: should this require an explicit opt-in flag,
or a dry-run mode?

## Filesystem ACLs (scopeAccess)

`src/mac/scopeAccess.ts` scopes a target directory to the sandbox group and grants
traverse (`search`) permission on its ancestor directories, so the restricted user
can reach it without broader access:

- `chgrp -R <group> <targetDir>` + `chmod -R u+rwX,g+rwX,o-rwx <targetDir>` +
  `chmod g+s <targetDir>` + `chmod +t <targetDir>` — scopes the target directory.
- `chmod +a "group:<group> allow search" <dir>` — grants traverse-only access on
  each ancestor directory that isn't already world-traversable.
- `chmod -a "group:<group> allow search" <dir>` — revokes those grants
  (`revokeTraverseGrants`).

These ACL changes affect real directories outside the project (e.g. the user's home
directory ancestor chain), not just the sandboxed workspace.

## Grant-tracking state file (dev mode)

**Current path: `~/.codegoat-dev/granted-dirs.json`**

`revokeTraverseGrants()` needs to know which ancestor directories had a traverse ACE
granted, so it can strip them later. That list used to live in an in-memory array,
which only worked within a single process — a separate CLI invocation (e.g.
`codegoat reset user`) started with an empty list and could never actually revoke
anything.

It's now persisted to a JSON file (an array of absolute directory paths) at a fixed
per-user path:

- `scopeAccess()` → `grantTraverse()` appends a directory to the file when it grants
  a traverse ACE (skips duplicates).
- `revokeTraverseGrants()` reads the file, attempts to strip the ACE from every
  listed directory (best-effort, in reverse order), then clears the file.

**This path (`~/.codegoat-dev/`) is a placeholder for development.** Things to
revisit before this is considered final:

- Naming: should this live under a more conventional location (e.g.
  `~/.config/codegoat/` or an XDG-style path) once out of dev mode?
- Multi-workspace safety: the file is a single flat list shared across every
  invocation for a given user — concurrent `codegoat` runs against different
  target directories will interleave writes to the same file. No locking is
  implemented yet.
- Cleanup ordering: `revokeTraverseGrants()` must run *before* the sandbox group is
  deleted (`removeUserIfExists`) — once the group's dscl record is gone, the ACE's
  underlying GUID can no longer be resolved by name, and revoking becomes unreliable.
  This ordering is not currently enforced by any caller; it's a manual invariant.
- Failure handling: writes are unconditional last-write-wins; a crash between
  `appendGrantedDir` and the actual `chmod` isn't reconciled — the file could disagree with
  real on-disk ACL state after a crash.
