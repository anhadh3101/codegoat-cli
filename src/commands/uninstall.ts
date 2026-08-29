import { Command } from 'commander';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as p from '@clack/prompts';
import {
  resolveUsername,
  resolveGroup,
  resolveAppName,
  removeUserIfExists,
  removeGroupIfExists,
  revokeTraverseGrants,
} from '@codegoat-cli/agentrail';

export const uninstallCommand = new Command('uninstall')
  .description('Remove all CodeGoat sandbox state: ACL grants, sandbox user/group, and local app data')
  .action(async () => {
    const confirmed = await p.confirm({
      message:
        'This removes the CodeGoat sandbox user, group, ACL grants, and local app data. Continue?',
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel('Uninstall cancelled.');
      return;
    }

    try {
      // 1. Strip every ACE this tool granted. Must run before the group's dscl record is
      //    deleted below — once the group is gone, the ACE's GUID can't be resolved by name.
      revokeTraverseGrants();
      console.log('Revoked ACL grants.');

      // 2. Remove the sandbox user and group.
      const username = resolveUsername();
      const group = resolveGroup();
      const { userRemoved } = removeUserIfExists(username);
      const { groupRemoved } = removeGroupIfExists(group);
      if (userRemoved) console.log(`Removed user '${username}'.`);
      if (groupRemoved) console.log(`Removed group '${group}'.`);
      if (!userRemoved && !groupRemoved) {
        console.log(`'${username}' user and '${group}' group did not exist.`);
      }

      // 3. Delete the local app data dir (~/.${APP_NAME}), including granted-dirs.json.
      const appDir = path.join(os.homedir(), `.${resolveAppName()}`);
      if (fs.existsSync(appDir)) {
        fs.rmSync(appDir, { recursive: true, force: true });
        console.log(`Removed ${appDir}.`);
      }

      console.log('CodeGoat uninstall complete.');
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'Uninstall failed.');
      process.exit(1);
    }
  });
