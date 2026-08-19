export const START = '__start__';
export const END = '__end__';

export type NodeFn<S> = (state: S) => Promise<Partial<S>> | Partial<S>;

export class StateGraph<S> {
  private nodes = new Map<string, NodeFn<S>>();
  private edges = new Map<string, string>();

  addNode(name: string, fn: NodeFn<S>): this {
    this.nodes.set(name, fn);
    return this;
  }

  addEdge(from: string, to: string): this {
    this.edges.set(from, to);
    return this;
  }

  compile() {
    const nodes = this.nodes;
    const edges = this.edges;

    return {
      async invoke(initialState: S): Promise<S> {
        let state = initialState;
        let current = edges.get(START);

        while (current && current !== END) {
          const fn = nodes.get(current);
          if (!fn) {
            throw new Error(`Unknown node: ${current}`);
          }

          const update = await fn(state);
          state = { ...state, ...update };
          current = edges.get(current);
        }

        return state;
      },
    };
  }
}
