import { execFileSync } from 'node:child_process';
import { CODEGOAT_GROUP } from './constants';

const MIN_UID = 601;
const MIN_GID = 701;
const USERNAME_PATTERN = /^[a-z_][a-z0-9_-]*$/i;

export interface RemoveUserResult {
  userRemoved: boolean;
  groupRemoved: boolean;
}

function dsclExists(recordPath: string): boolean {
  try {
    execFileSync('dscl', ['.', '-read', recordPath], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function readNumericAttr(recordPath: string, attribute: string): number | null {
  const out = execFileSync('dscl', ['.', '-read', recordPath, attribute], {
    encoding: 'utf8',
  });
  const match = out.match(new RegExp(`${attribute}:\\s*(\\d+)`));
  return match ? Number.parseInt(match[1], 10) : null;
}

function sudoDscl(args: string[]): void {
  execFileSync('sudo', ['dscl', '.', ...args], { stdio: 'inherit' });
}

export function removeUserIfExists(
  username: string,
  groupName: string = CODEGOAT_GROUP,
): RemoveUserResult {
  if (process.platform !== 'darwin') {
    throw new Error('The CodeGoat sandbox user can only be removed on macOS.');
  }

  if (!USERNAME_PATTERN.test(username) || !USERNAME_PATTERN.test(groupName)) {
    throw new Error(`Invalid username or group name: ${username}, ${groupName}`);
  }

  const userPath = `/Users/${username}`;
  const groupPath = `/Groups/${groupName}`;

  let userRemoved = false;
  if (dsclExists(userPath)) {
    const uid = readNumericAttr(userPath, 'UniqueID');
    if (uid !== null && uid < MIN_UID) {
      throw new Error(
        `Refusing to delete '${username}': UID ${uid} is below ${MIN_UID}, which ` +
          'suggests this is not a CodeGoat-managed account.',
      );
    }
    sudoDscl(['-delete', userPath]);
    userRemoved = true;
  }

  let groupRemoved = false;
  if (dsclExists(groupPath)) {
    const gid = readNumericAttr(groupPath, 'PrimaryGroupID');
    if (gid !== null && gid < MIN_GID) {
      throw new Error(
        `Refusing to delete group '${groupName}': GID ${gid} is below ${MIN_GID}, ` +
          'which suggests this is not a CodeGoat-managed group.',
      );
    }
    sudoDscl(['-delete', groupPath]);
    groupRemoved = true;
  }

  return { userRemoved, groupRemoved };
}
