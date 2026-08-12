#!/bin/bash
#
# create-codegoat-user.sh
#
# Creates a restricted macOS user ("codegoat") and a dedicated group
# ("codegoatshared") intended to be scoped to a single project directory.
#
# This script ONLY creates the user + group. It does NOT grant access to
# any directory — run a separate scoping script (per target directory)
# after this one.
#
# Must be run with sudo:
#   sudo ./create-codegoat-user.sh

set -euo pipefail

USERNAME="codegoat"
GROUPNAME="codegoatshared"

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run with sudo." >&2
  exit 1
fi

# --- Safety check: don't clobber an existing account/group ---
if dscl . -read "/Users/${USERNAME}" >/dev/null 2>&1; then
  echo "Error: user '${USERNAME}' already exists. Aborting." >&2
  echo "If you want to recreate it, delete it first with:" >&2
  echo "  sudo dscl . -delete /Users/${USERNAME}" >&2
  exit 1
fi

if dscl . -read "/Groups/${GROUPNAME}" >/dev/null 2>&1; then
  echo "Error: group '${GROUPNAME}' already exists. Aborting." >&2
  echo "If you want to recreate it, delete it first with:" >&2
  echo "  sudo dscl . -delete /Groups/${GROUPNAME}" >&2
  exit 1
fi

# --- Find unused UID (>= 600 to stay clear of real user accounts) ---
LAST_UID=$(dscl . -list /Users UniqueID | awk '{print $2}' | sort -n | tail -1)
NEW_UID=$(( LAST_UID > 600 ? LAST_UID + 1 : 601 ))

# --- Find unused GID (>= 700 to stay clear of system groups) ---
LAST_GID=$(dscl . -list /Groups PrimaryGroupID | awk '{print $2}' | sort -n | tail -1)
NEW_GID=$(( LAST_GID > 700 ? LAST_GID + 1 : 701 ))

echo "Creating group '${GROUPNAME}' (GID ${NEW_GID})..."
dscl . -create "/Groups/${GROUPNAME}"
dscl . -create "/Groups/${GROUPNAME}" PrimaryGroupID "${NEW_GID}"
dscl . -append "/Groups/${GROUPNAME}" GroupMembership "${USERNAME}"

echo "Creating user '${USERNAME}' (UID ${NEW_UID})..."
dscl . -create "/Users/${USERNAME}"
dscl . -create "/Users/${USERNAME}" UserShell /usr/bin/false
dscl . -create "/Users/${USERNAME}" RealName "Codegoat Agent User"
dscl . -create "/Users/${USERNAME}" UniqueID "${NEW_UID}"
dscl . -create "/Users/${USERNAME}" PrimaryGroupID "${NEW_GID}"
# No real home directory: points at the shared empty system path so macOS
# never creates /Users/codegoat.
dscl . -create "/Users/${USERNAME}" NFSHomeDirectory /var/empty
# Random password satisfies macOS password policy (empty "-" is rejected on
# recent macOS). Interactive login is blocked by UserShell /usr/bin/false.
dscl . -passwd "/Users/${USERNAME}" "$(openssl rand -base64 32)"
dscl . -create "/Users/${USERNAME}" AuthenticationAuthority ";DisabledUser;"

# --- Also add your own admin/dev account to the group, so you can access
#     shared target directories without sudo. Edit ADMIN_USER as needed. ---
ADMIN_USER="${SUDO_USER:-$(logname)}"
if [ -n "$ADMIN_USER" ]; then
  echo "Adding '${ADMIN_USER}' to group '${GROUPNAME}'..."
  dscl . -append "/Groups/${GROUPNAME}" GroupMembership "${ADMIN_USER}"
fi

echo
echo "Done."
echo "  User:  ${USERNAME} (UID ${NEW_UID}), shell disabled, no home directory"
echo "  Group: ${GROUPNAME} (GID ${NEW_GID}), members: ${USERNAME}, ${ADMIN_USER}"
echo
echo "Verify with:"
echo "  id ${USERNAME}"
echo "  dscl . -read /Users/${USERNAME}"
echo
echo "Next step: run a scoping script against your target directory to grant"
echo "'${USERNAME}' traverse access to its parent folders and read/write access"
echo "to the target directory itself."