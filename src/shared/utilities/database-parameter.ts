class Parameter {
    values: any[];

    history: Record<string, number>;

    constructor() {
        this.values = [];
        this.history = {};
    }

    /**
   * Adds a value to the parameter and returns its index.
   * If a tag is provided and it exists in the history, the index from the history is returned.
   * Otherwise, the value is added to the parameter and its index is returned.
   */

    add(value: any, tag?: string): number {
        if (tag && this.history[tag]) return this.history[tag];

        if (value instanceof Date) this.values.push(value.toISOString());
        else this.values.push(value);

        if (tag) this.history[tag] = this.values.length;
        return this.values.length;
    }

    /**
   * Adds a value to the parameter and returns its index with '$' prefix. example '$3'.
   * If a tag is provided and it exists in the history, the index from the history is returned.
   * Otherwise, the value is added to the parameter and its index is returned.
   */
    i(value: any, tag?: string): string {
        return `$${this.add(value, tag)}`;
    }

    /**
   * Clears the parameter values and history.
   */
    clear(): void {
        this.values = [];
        this.history = {};
    }
}

export default Parameter;
