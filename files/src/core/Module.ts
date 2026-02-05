export default abstract class Module {
  public name: string;
  public bot: any;
  constructor(bot: any, name?: string) {
    this.bot = bot;
    this.name = name || (this.constructor && this.constructor.name.toLowerCase());
  }

  // Called when module is loaded
  public register(): void | Promise<void> {}

  // Called when module should cleanup
  public unload(): void | Promise<void> {}
}