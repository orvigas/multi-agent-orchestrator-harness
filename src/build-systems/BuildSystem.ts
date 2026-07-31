export interface BuildResult {
  success: boolean;
  stdout: string;
  stderr: string;
  duration: number;
}

export interface BuildSystem {
  name: string;

  /**
   * Detect if this build system is being used in a directory.
   */
  detect(rootPath: string): boolean;

  /**
   * Install dependencies.
   */
  install(rootPath: string): BuildResult;

  /**
   * Run build command.
   */
  build(rootPath: string): BuildResult;

  /**
   * Get build output directory.
   */
  getOutputDir(rootPath: string): string;
}
