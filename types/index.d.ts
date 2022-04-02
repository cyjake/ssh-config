declare enum ELine {
  DIRECTIVE = 1,
  COMMENT = 2,
}

interface Directive {
  type: ELine.DIRECTIVE;
  before: string;
  after: string;
  param: string;
  separator: ' ' | '=';
  value: string;
}

interface Section extends Directive {
  config: SSHConfig<Line>;
}

interface Comment {
  type: ELine.COMMENT;
  content: string;
}

type Line = Section | Directive | Comment;

declare class SSHConfig<T> extends Array<T> {
  static parse(text: string): SSHConfig<Line>;
  static stringify(config: SSHConfig<Line>): string;

  static DIRECTIVE: ELine.DIRECTIVE;
  static COMMENT: ELine.COMMENT;

  toString(): string;

  compute(host: string): Record<string, string>;

  find<T>(this: SSHConfig<T>, predicate: (line: T, index: number, config: T[]) => boolean): T;
  find(options: Record<string, string>): Line | Section;

  remove(options: Record<string, string>): Line | Section;

  append(options: Record<string, string>): SSHConfig<Line>;
  prepend(options: Record<string, string>): SSHConfig<Line>;
}

export default class extends SSHConfig<Line> {}
