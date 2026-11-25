declare module "onnxruntime-web" {
  export interface OrtEnvironment {
    logLevel?: "verbose" | "info" | "warning" | "error" | "fatal";
    debug?: boolean;
  }

  export interface OrtNamespace {
    env: OrtEnvironment;
  }

  export const env: OrtEnvironment;
  const ortDefault: OrtNamespace;
  export default ortDefault;
}

declare module "onnxruntime-web/webgpu" {
  export * from "onnxruntime-web";
  export { default } from "onnxruntime-web";
}
