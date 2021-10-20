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
  config: SSHConfig;
}

interface Comment {
  type: ELine.COMMENT;
  content: string;
}

type Line = Directive | Comment;

export default class SSHConfig extends Array {
  static parse(text: string): SSHConfig;
  static stringify(config: SSHConfig): string;

  toString(): string;

  compute(host: string): Record<string, string>;

  find(predicate: (value: any, index: number, obj: any[]) => any);
  find(options: Record<string, string>): Line | Section;

  remove(options: Record<string, string>): Line | Section;

  append(options: Record<string, string>): SSHConfig;
  prepend(options: Record<string, string>): SSHConfig;
}
