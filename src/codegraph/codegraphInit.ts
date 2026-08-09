import CodeGraph, { isInitialized } from '@colbymchenry/codegraph';
import * as p from '@clack/prompts';

export async function initializeCodeGraph(): Promise<boolean> {
  const projectRoot = process.cwd();

  if (isInitialized(projectRoot)) {
    return true;
  }

  const s = p.spinner();
  s.start('Building code graph…');

  try {
    const cg = await CodeGraph.init(projectRoot, { index: false });
    await cg.indexAll({
      onProgress: (progress) => {
        s.message(`${progress.phase}: ${progress.current}/${progress.total}`);
      },
    });
    cg.close();
    s.stop('Code graph ready.');
    return true;
  } catch (err) {
    s.stop('Failed to build code graph.');
    p.log.error(err instanceof Error ? err.message : String(err));
    return false;
  }
}
